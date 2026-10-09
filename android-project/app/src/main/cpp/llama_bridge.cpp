#include <jni.h>
#include <string>
#include <android/log.h>
#include "llama.h"

#define TAG "OfflineKnowledgeNative"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

static llama_model* g_model = nullptr;
static llama_context* g_ctx = nullptr;
static bool g_should_stop = false;

extern "C" JNIEXPORT jboolean JNICALL
Java_com_offlineknowledge_app_engine_LlamaNative_loadModel(
    JNIEnv* env, jobject thiz, jstring modelPath, jint nCtx, jint nThreads) {

    const char* path = env->GetStringUTFChars(modelPath, nullptr);
    LOGI("Loading GGUF model from: %s with context: %d", path, nCtx);

    llama_backend_init();

    llama_model_params mparams = llama_model_default_params();
    g_model = llama_load_model_from_file(path, mparams);

    env->ReleaseStringUTFChars(modelPath, path);

    if (!g_model) {
        LOGE("Failed to load model from file");
        return JNI_FALSE;
    }

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx = nCtx;
    cparams.n_threads = nThreads;

    g_ctx = llama_new_context_with_model(g_model, cparams);
    if (!g_ctx) {
        LOGE("Failed to create llama context");
        llama_free_model(g_model);
        g_model = nullptr;
        return JNI_FALSE;
    }

    LOGI("Model loaded successfully into RAM");
    return JNI_TRUE;
}

extern "C" JNIEXPORT void JNICALL
Java_com_offlineknowledge_app_engine_LlamaNative_stopGeneration(
    JNIEnv* env, jobject thiz) {
    g_should_stop = true;
}

extern "C" JNIEXPORT void JNICALL
Java_com_offlineknowledge_app_engine_LlamaNative_unloadModel(
    JNIEnv* env, jobject thiz) {
    if (g_ctx) {
        llama_free(g_ctx);
        g_ctx = nullptr;
    }
    if (g_model) {
        llama_free_model(g_model);
        g_model = nullptr;
    }
    llama_backend_free();
    LOGI("Model unloaded from memory");
}
