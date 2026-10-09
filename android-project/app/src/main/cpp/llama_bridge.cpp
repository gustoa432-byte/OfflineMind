#include <jni.h>
#include <string>
#include <vector>
#include <unistd.h>
#include <android/log.h>
#include <atomic>
#include "llama.h"

#define TAG "OfflineKnowledgeNative"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

static llama_model* g_model = nullptr;
static llama_context* g_ctx = nullptr;
static std::atomic<bool> g_should_stop(false);

extern "C" JNIEXPORT jboolean JNICALL
Java_com_offlineknowledge_app_engine_LlamaNative_loadModel(
    JNIEnv* env, jobject /* thiz */, jstring modelPath, jint nCtx, jint nThreads) {

    // If already loaded, unload first
    if (g_ctx != nullptr) {
        llama_free(g_ctx);
        g_ctx = nullptr;
    }
    if (g_model != nullptr) {
        llama_model_free(g_model);
        g_model = nullptr;
    }

    const char* path = env->GetStringUTFChars(modelPath, nullptr);
    if (!path) return JNI_FALSE;
    std::string path_str(path);
    env->ReleaseStringUTFChars(modelPath, path);

    LOGI("Loading GGUF model from: %s (n_ctx: %d, n_threads: %d)", path_str.c_str(), nCtx, nThreads);

    llama_backend_init();

    llama_model_params mparams = llama_model_default_params();
    // In ARM / mobile Helio G81 Ultra, CPU threads 4-6
    g_model = llama_model_load_from_file(path_str.c_str(), mparams);

    if (!g_model) {
        LOGE("Failed to load model from file: %s", path_str.c_str());
        return JNI_FALSE;
    }

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx = nCtx > 0 ? (uint32_t)nCtx : 2048;
    cparams.n_threads = nThreads > 0 ? (int32_t)nThreads : 4;
    cparams.n_batch = 512;
    cparams.no_perf = false;

    g_ctx = llama_init_from_model(g_model, cparams);
    if (!g_ctx) {
        LOGE("Failed to create llama context");
        llama_model_free(g_model);
        g_model = nullptr;
        return JNI_FALSE;
    }

    g_should_stop.store(false);
    LOGI("Model loaded successfully into RAM");
    return JNI_TRUE;
}

extern "C" JNIEXPORT void JNICALL
Java_com_offlineknowledge_app_engine_LlamaNative_stopGeneration(
    JNIEnv* /* env */, jobject /* thiz */) {
    g_should_stop.store(true);
    LOGI("Stop generation requested");
}

extern "C" JNIEXPORT void JNICALL
Java_com_offlineknowledge_app_engine_LlamaNative_unloadModel(
    JNIEnv* /* env */, jobject /* thiz */) {
    g_should_stop.store(true);
    if (g_ctx) {
        llama_free(g_ctx);
        g_ctx = nullptr;
    }
    if (g_model) {
        llama_model_free(g_model);
        g_model = nullptr;
    }
    llama_backend_free();
    LOGI("Model unloaded from memory");
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_offlineknowledge_app_engine_LlamaNative_getMemoryRssMb(
    JNIEnv* /* env */, jobject /* thiz */) {
    long rss_pages = 0;
    FILE* fp = fopen("/proc/self/statm", "r");
    if (fp) {
        long dummy = 0;
        if (fscanf(fp, "%ld %ld", &dummy, &rss_pages) == 2) {
            long page_size_kb = sysconf(_SC_PAGESIZE) / 1024;
            fclose(fp);
            return (jlong)((rss_pages * page_size_kb) / 1024);
        }
        fclose(fp);
    }
    return 0;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_offlineknowledge_app_engine_LlamaNative_generateStream(
    JNIEnv* env, jobject /* thiz */, jstring promptStr, jint maxTokens, jfloat temperature, jobject callback) {

    if (!g_model || !g_ctx) {
        LOGE("Cannot generate: model or context is null");
        return JNI_FALSE;
    }

    jclass callbackClass = env->GetObjectClass(callback);
    jmethodID onTokenMethod = env->GetMethodID(callbackClass, "onToken", "(Ljava/lang/String;)Z");
    if (!onTokenMethod) {
        LOGE("Callback onToken method not found");
        return JNI_FALSE;
    }

    const char* promptCStr = env->GetStringUTFChars(promptStr, nullptr);
    std::string prompt(promptCStr);
    env->ReleaseStringUTFChars(promptStr, promptCStr);

    g_should_stop.store(false);

    const llama_vocab* vocab = llama_model_get_vocab(g_model);

    // Tokenize prompt
    int n_prompt = -llama_tokenize(vocab, prompt.c_str(), (int32_t)prompt.length(), nullptr, 0, true, true);
    if (n_prompt <= 0) {
        n_prompt = 1;
    }
    std::vector<llama_token> prompt_tokens(n_prompt);
    if (llama_tokenize(vocab, prompt.c_str(), (int32_t)prompt.length(), prompt_tokens.data(), (int32_t)prompt_tokens.size(), true, true) < 0) {
        LOGE("Failed to tokenize prompt");
        return JNI_FALSE;
    }

    // Sampler initialization
    auto sparams = llama_sampler_chain_default_params();
    llama_sampler* smpl = llama_sampler_chain_init(sparams);
    if (temperature > 0.05f) {
        llama_sampler_chain_add(smpl, llama_sampler_init_temp(temperature));
        llama_sampler_chain_add(smpl, llama_sampler_init_top_p(0.85f, 1));
        llama_sampler_chain_add(smpl, llama_sampler_init_dist(1337));
    } else {
        llama_sampler_chain_add(smpl, llama_sampler_init_greedy());
    }

    // Initialize batch
    llama_batch_ext* batch = llama_batch_ext_init(g_ctx);
    llama_batch_ext_clear(batch);

    for (size_t i = 0; i < prompt_tokens.size(); ++i) {
        int32_t idx = llama_batch_ext_add_token(batch, 0, prompt_tokens[i]);
        llama_pos pos = (llama_pos)i;
        llama_batch_ext_set_pos(batch, idx, &pos);
    }
    llama_batch_ext_set_output_logits(batch, (int32_t)(prompt_tokens.size() - 1), true);

    // Decode initial prompt batch
    if (llama_process(g_ctx, LLAMA_PROCESS_TYPE_DECODE, batch) != 0) {
        LOGE("Failed to eval initial prompt tokens");
        llama_batch_ext_free(batch);
        llama_sampler_free(smpl);
        return JNI_FALSE;
    }

    // Autoregressive generation loop
    int n_decode = 0;
    llama_pos current_pos = (llama_pos)prompt_tokens.size();

    while (n_decode < maxTokens && !g_should_stop.load()) {
        llama_token new_token_id = llama_sampler_sample(smpl, g_ctx, -1);

        if (llama_vocab_is_eog(vocab, new_token_id)) {
            break;
        }

        char piece_buf[256];
        int n_piece = llama_token_to_piece(vocab, new_token_id, piece_buf, sizeof(piece_buf), 0, true);
        if (n_piece > 0) {
            std::string piece_str(piece_buf, n_piece);
            jstring jpiece = env->NewStringUTF(piece_str.c_str());
            jboolean cont = env->CallBooleanMethod(callback, onTokenMethod, jpiece);
            env->DeleteLocalRef(jpiece);

            if (!cont || g_should_stop.load()) {
                break;
            }
        }

        // Prepare next single token batch
        llama_batch_ext_clear(batch);
        int32_t idx = llama_batch_ext_add_token(batch, 0, new_token_id);
        llama_batch_ext_set_pos(batch, idx, &current_pos);
        llama_batch_ext_set_output_logits(batch, 0, true);

        if (llama_process(g_ctx, LLAMA_PROCESS_TYPE_DECODE, batch) != 0) {
            LOGE("Failed to eval token in loop");
            break;
        }

        current_pos++;
        n_decode++;
    }

    llama_batch_ext_free(batch);
    llama_sampler_free(smpl);
    return JNI_TRUE;
}
