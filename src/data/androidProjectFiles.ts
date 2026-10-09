export interface AndroidFile {
  path: string;
  language: string;
  description: string;
  content: string;
}

export const ANDROID_PROJECT_FILES: AndroidFile[] = [
  {
    path: 'build.gradle.kts (Root)',
    language: 'kotlin',
    description: 'Корневой конфигурационный файл Gradle с версиями плагинов Android, Kotlin, Compose и KSP',
    content: `// Top-level build file for OfflineMind Android project
plugins {
    id("com.android.application") version "8.7.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    id("com.google.devtools.ksp") version "2.0.21-1.0.27" apply false
}`
  },
  {
    path: 'app/build.gradle.kts',
    language: 'kotlin',
    description: 'Конфигурация модуля с Jetpack Compose, Room и NDK/CMake для MediaTek Helio G81 Ultra',
    content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.offlineknowledge.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.offlineknowledge.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        ndk {
            // Ограничиваем сборку архитектурой ARM64 для устройства HONOR NIC-LX1 (Helio G81 Ultra)
            abiFilters += listOf("arm64-v8a")
        }

        externalNativeBuild {
            cmake {
                cppFlags += "-std=c++17 -O3 -DGGML_USE_CPU"
                arguments += listOf(
                    "-DANDROID_STL=c++_shared",
                    "-DLLAMA_BUILD_EXAMPLES=OFF",
                    "-DLLAMA_BUILD_TESTS=OFF"
                )
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

    // Room Database SQLite
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    // OkHttp & Coroutines
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}`
  },
  {
    path: 'app/src/main/cpp/CMakeLists.txt',
    language: 'cmake',
    description: 'Инструкции CMake для компиляции llama.cpp и сборки JNI-библиотеки libllama-jni.so',
    content: `cmake_minimum_required(VERSION 3.22.1)
project(offline_knowledge_llama)

set(CMAKE_CXX_STANDARD 17)

# Добавляем исходники llama.cpp и GGML
add_subdirectory(llama.cpp)

# Наша JNI библиотека-мост
add_library(llama-jni SHARED
    llama_bridge.cpp
)

target_include_directories(llama-jni PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp/include
    \${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp/common
)

# Линкуем llama, ggml и системные библиотеки Android
target_link_libraries(llama-jni
    PRIVATE
    llama
    ggml
    android
    log
)`
  },
  {
    path: 'app/src/main/cpp/llama_bridge.cpp',
    language: 'cpp',
    description: 'Нативный JNI-мост на C++: загрузка модели в память, потоковая генерация токенов, измерение RSS',
    content: `#include <jni.h>
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

    if (g_ctx != nullptr) {
        llama_free(g_ctx);
        g_ctx = nullptr;
    }
    if (g_model != nullptr) {
        llama_model_free(g_model);
        g_model = nullptr;
    }

    const char* path = env->GetStringUTFChars(modelPath, nullptr);
    LOGI("Loading GGUF model from: %s (n_ctx: %d, n_threads: %d)", path, nCtx, nThreads);

    llama_backend_init();

    llama_model_params mparams = llama_model_default_params();
    g_model = llama_model_load_from_file(path, mparams);

    env->ReleaseStringUTFChars(modelPath, path);

    if (!g_model) {
        LOGE("Failed to load model from file: %s", path);
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
    if (n_prompt <= 0) n_prompt = 1;
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

    llama_batch_ext* batch = llama_batch_ext_init(g_ctx);
    llama_batch_ext_clear(batch);

    for (size_t i = 0; i < prompt_tokens.size(); ++i) {
        int32_t idx = llama_batch_ext_add_token(batch, 0, prompt_tokens[i]);
        llama_pos pos = (llama_pos)i;
        llama_batch_ext_set_pos(batch, idx, &pos);
    }
    llama_batch_ext_set_output_logits(batch, (int32_t)(prompt_tokens.size() - 1), true);

    if (llama_process(g_ctx, LLAMA_PROCESS_TYPE_DECODE, batch) != 0) {
        LOGE("Failed to eval initial prompt tokens");
        llama_batch_ext_free(batch);
        llama_sampler_free(smpl);
        return JNI_FALSE;
    }

    int n_decode = 0;
    llama_pos current_pos = (llama_pos)prompt_tokens.size();

    while (n_decode < maxTokens && !g_should_stop.load()) {
        llama_token new_token_id = llama_sampler_sample(smpl, g_ctx, -1);
        if (llama_vocab_is_eog(vocab, new_token_id)) break;

        char piece_buf[256];
        int n_piece = llama_token_to_piece(vocab, new_token_id, piece_buf, sizeof(piece_buf), 0, true);
        if (n_piece > 0) {
            std::string piece_str(piece_buf, n_piece);
            jstring jpiece = env->NewStringUTF(piece_str.c_str());
            jboolean cont = env->CallBooleanMethod(callback, onTokenMethod, jpiece);
            env->DeleteLocalRef(jpiece);
            if (!cont || g_should_stop.load()) break;
        }

        llama_batch_ext_clear(batch);
        int32_t idx = llama_batch_ext_add_token(batch, 0, new_token_id);
        llama_batch_ext_set_pos(batch, idx, &current_pos);
        llama_batch_ext_set_output_logits(batch, 0, true);

        if (llama_process(g_ctx, LLAMA_PROCESS_TYPE_DECODE, batch) != 0) break;

        current_pos++;
        n_decode++;
    }

    llama_batch_ext_free(batch);
    llama_sampler_free(smpl);
    return JNI_TRUE;
}`
  },
  {
    path: 'app/src/main/java/com/offlineknowledge/app/engine/LlamaInferenceEngine.kt',
    language: 'kotlin',
    description: 'Kotlin сервис инференса: корутины Flow, вычисление TTFT, скорости токенов и потребления памяти',
    content: `package com.offlineknowledge.app.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import java.io.File

object LlamaNative {
    init {
        try {
            System.loadLibrary("llama-jni")
        } catch (e: UnsatisfiedLinkError) {
            System.err.println("Failed to load libllama-jni.so: \${e.message}")
        }
    }

    external fun loadModel(modelPath: String, nCtx: Int, nThreads: Int): Boolean
    external fun unloadModel()
    external fun stopGeneration()
    external fun generateStream(
        prompt: String,
        maxTokens: Int,
        temperature: Float,
        callback: LlamaTokenCallback
    ): Boolean
    external fun getMemoryRssMb(): Long
}

fun interface LlamaTokenCallback {
    fun onToken(token: String): Boolean
}

data class GenerationMetrics(
    val ttftMs: Long,
    val totalTimeMs: Long,
    val tokensGenerated: Int,
    val tokensPerSec: Double,
    val wordsPerMinute: Int,
    val memoryRssMb: Int,
    val isComplete: Boolean = false
)

data class StreamChunk(
    val deltaText: String,
    val fullText: String,
    val metrics: GenerationMetrics
)

class LlamaInferenceEngine(private val modelFile: File) {
    private var isLoaded = false

    fun isModelLoaded(): Boolean = isLoaded

    fun load(contextLength: Int = 2048, threads: Int = 4): Boolean {
        if (!modelFile.exists() || modelFile.length() == 0L) return false
        isLoaded = LlamaNative.loadModel(modelFile.absolutePath, contextLength, threads)
        return isLoaded
    }

    fun stop() {
        LlamaNative.stopGeneration()
    }

    fun unload() {
        LlamaNative.unloadModel()
        isLoaded = false
    }

    fun getMemoryRssMb(): Long = LlamaNative.getMemoryRssMb()

    fun streamInference(
        prompt: String,
        maxTokens: Int = 512,
        temperature: Float = 0.7f
    ): Flow<StreamChunk> = callbackFlow {
        if (!isLoaded && !load()) {
            close(IllegalStateException("Model is not loaded"))
            return@callbackFlow
        }

        val startTime = System.currentTimeMillis()
        var firstTokenTime: Long? = null
        var tokenCount = 0
        val textBuilder = StringBuilder()

        val callback = LlamaTokenCallback { token ->
            val now = System.currentTimeMillis()
            if (firstTokenTime == null) firstTokenTime = now
            tokenCount++
            textBuilder.append(token)

            val elapsedMs = now - startTime
            val ttft = (firstTokenTime ?: now) - startTime
            val elapsedSec = maxOf(0.001, elapsedMs / 1000.0)
            val tokensPerSec = tokenCount / elapsedSec
            val words = textBuilder.split("\\\\s+".toRegex()).filter { it.isNotBlank() }.size
            val wordsPerMin = (words / (elapsedSec / 60.0)).toInt()
            val currentRss = LlamaNative.getMemoryRssMb().toInt()

            val metrics = GenerationMetrics(
                ttftMs = ttft,
                totalTimeMs = elapsedMs,
                tokensGenerated = tokenCount,
                tokensPerSec = String.format("%.1f", tokensPerSec).toDoubleOrNull() ?: tokensPerSec,
                wordsPerMinute = wordsPerMin,
                memoryRssMb = currentRss,
                isComplete = false
            )

            trySend(StreamChunk(deltaText = token, fullText = textBuilder.toString(), metrics = metrics))
            true
        }

        LlamaNative.generateStream(prompt, maxTokens, temperature, callback)

        val totalMs = System.currentTimeMillis() - startTime
        val totalSec = maxOf(0.001, totalMs / 1000.0)
        val finalTokensPerSec = tokenCount / totalSec
        val words = textBuilder.split("\\\\s+".toRegex()).filter { it.isNotBlank() }.size
        val finalWpm = (words / (totalSec / 60.0)).toInt()

        val finalMetrics = GenerationMetrics(
            ttftMs = (firstTokenTime ?: (startTime + totalMs)) - startTime,
            totalTimeMs = totalMs,
            tokensGenerated = tokenCount,
            tokensPerSec = String.format("%.1f", finalTokensPerSec).toDoubleOrNull() ?: finalTokensPerSec,
            wordsPerMinute = finalWpm,
            memoryRssMb = LlamaNative.getMemoryRssMb().toInt(),
            isComplete = true
        )

        trySend(StreamChunk(deltaText = "", fullText = textBuilder.toString(), metrics = finalMetrics))
        close()
        awaitClose { LlamaNative.stopGeneration() }
    }.flowOn(Dispatchers.Default)
}`
  },
  {
    path: 'app/src/main/java/com/offlineknowledge/app/download/ModelDownloadManager.kt',
    language: 'kotlin',
    description: 'Менеджер загрузки GGUF: проверка свободного места, докачка Range, проверка SHA-256',
    content: `package com.offlineknowledge.app.download

import android.content.Context
import android.os.StatFs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

sealed class DownloadState {
    object Idle : DownloadState()
    data class CheckingSpace(val requiredBytes: Long, val freeBytes: Long) : DownloadState()
    data class Progress(
        val percent: Int,
        val downloadedBytes: Long,
        val totalBytes: Long,
        val speedBytesPerSec: Long,
        val timeRemainingSec: Long,
        val stepDescription: String
    ) : DownloadState()
    data class VerifyingChecksum(val expectedSha256: String) : DownloadState()
    data class Ready(val modelFile: File) : DownloadState()
    data class Error(val message: String) : DownloadState()
}

class ModelDownloadManager(private val context: Context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    private var activeCall: okhttp3.Call? = null

    fun getModelsDirectory(): File {
        val dir = File(context.filesDir, "models")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    fun getModelFile(filename: String): File = File(getModelsDirectory(), filename)

    fun getFreeSpaceBytes(): Long = StatFs(context.filesDir.path).availableBytes

    fun isModelInstalled(filename: String, expectedBytes: Long = 0L): Boolean {
        val file = getModelFile(filename)
        if (!file.exists()) return false
        if (expectedBytes > 0L && file.length() != expectedBytes) return false
        return file.length() > 0L
    }

    fun cancelActiveDownload() {
        activeCall?.cancel()
        activeCall = null
    }

    fun deleteModel(filename: String): Boolean {
        val file = getModelFile(filename)
        val tmp = File(getModelsDirectory(), "\$filename.tmp")
        if (tmp.exists()) tmp.delete()
        return if (file.exists()) file.delete() else true
    }

    fun downloadModel(
        url: String,
        targetFileName: String,
        expectedSha256: String,
        expectedBytes: Long
    ): Flow<DownloadState> = flow {
        val targetDir = getModelsDirectory()
        val tempFile = File(targetDir, "\$targetFileName.tmp")
        val finalFile = File(targetDir, targetFileName)

        if (finalFile.exists() && (expectedBytes <= 0 || finalFile.length() == expectedBytes)) {
            emit(DownloadState.Ready(finalFile))
            return@flow
        }

        val freeBytes = getFreeSpaceBytes()
        emit(DownloadState.CheckingSpace(expectedBytes, freeBytes))

        val requiredWithMargin = expectedBytes + (100L * 1024 * 1024)
        if (freeBytes < requiredWithMargin) {
            emit(DownloadState.Error("Недостаточно места: свободно \${freeBytes / 1024 / 1024} МБ"))
            return@flow
        }

        var downloadedSoFar = if (tempFile.exists()) tempFile.length() else 0L
        if (downloadedSoFar >= expectedBytes && expectedBytes > 0) {
            downloadedSoFar = 0L
            tempFile.delete()
        }

        val requestBuilder = Request.Builder().url(url)
        if (downloadedSoFar > 0L) requestBuilder.header("Range", "bytes=\$downloadedSoFar-")

        val call = client.newCall(requestBuilder.build())
        activeCall = call

        try {
            call.execute().use { response ->
                if (!response.isSuccessful && response.code != 206) {
                    emit(DownloadState.Error("HTTP ошибка: \${response.code}"))
                    return@flow
                }

                val appendMode = (response.code == 206 && downloadedSoFar > 0)
                if (!appendMode && downloadedSoFar > 0) {
                    downloadedSoFar = 0L
                    tempFile.delete()
                }

                val body = response.body ?: throw IllegalStateException("Empty body")
                val contentLength = body.contentLength()
                val totalBytes = if (contentLength > 0) downloadedSoFar + contentLength else expectedBytes

                val outputStream = FileOutputStream(tempFile, appendMode)
                val buffer = ByteArray(128 * 1024)
                var bytesRead: Int
                val inputStream = body.byteStream()
                var lastSpeedCalcTime = System.currentTimeMillis()
                var bytesSinceLastCalc = 0L
                var currentSpeedBps = 0L

                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                    downloadedSoFar += bytesRead
                    bytesSinceLastCalc += bytesRead

                    val now = System.currentTimeMillis()
                    val timeDelta = now - lastSpeedCalcTime
                    if (timeDelta >= 500) {
                        currentSpeedBps = (bytesSinceLastCalc * 1000) / timeDelta
                        bytesSinceLastCalc = 0L
                        lastSpeedCalcTime = now

                        val percent = if (totalBytes > 0) ((downloadedSoFar * 100) / totalBytes).toInt().coerceIn(0, 99) else 0
                        val remainingBytes = maxOf(0L, totalBytes - downloadedSoFar)
                        val etaSec = if (currentSpeedBps > 0) remainingBytes / currentSpeedBps else 0L

                        emit(DownloadState.Progress(
                            percent = percent,
                            downloadedBytes = downloadedSoFar,
                            totalBytes = totalBytes,
                            speedBytesPerSec = currentSpeedBps,
                            timeRemainingSec = etaSec,
                            stepDescription = "Загрузка (\${downloadedSoFar / 1024 / 1024} МБ / \${totalBytes / 1024 / 1024} МБ)"
                        ))
                    }
                }
                outputStream.flush()
                outputStream.close()
            }
        } catch (e: Exception) {
            emit(DownloadState.Error("Прервано: \${e.message}"))
            return@flow
        } finally {
            activeCall = null
        }

        emit(DownloadState.VerifyingChecksum(expectedSha256))
        val digest = MessageDigest.getInstance("SHA-256")
        tempFile.inputStream().use { fis ->
            val buf = ByteArray(1024 * 1024)
            var r: Int
            while (fis.read(buf).also { r = it } != -1) digest.update(buf, 0, r)
        }
        val actualSha256 = digest.digest().joinToString("") { "%02x".format(it) }

        if (!actualSha256.equals(expectedSha256, ignoreCase = true)) {
            tempFile.delete()
            emit(DownloadState.Error("Неверный SHA-256: ожидался \$expectedSha256, получен \$actualSha256"))
            return@flow
        }

        if (finalFile.exists()) finalFile.delete()
        if (!tempFile.renameTo(finalFile)) {
            tempFile.copyTo(finalFile, overwrite = true)
            tempFile.delete()
        }

        emit(DownloadState.Ready(finalFile))
    }.flowOn(Dispatchers.IO)
}`
  },
  {
    path: 'app/src/main/java/com/offlineknowledge/app/bridge/OfflineMindBridge.kt',
    language: 'kotlin',
    description: 'JavaScript Bridge (window.OfflineMindNative) для прямой связи WebView UI с JNI и хранилищем',
    content: `package com.offlineknowledge.app.bridge

import android.content.Context
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.offlineknowledge.app.download.DownloadState
import com.offlineknowledge.app.download.ModelDownloadManager
import com.offlineknowledge.app.engine.LlamaInferenceEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONObject

class OfflineMindBridge(
    private val context: Context,
    private val webView: WebView,
    private val scope: CoroutineScope
) {
    private val downloadManager = ModelDownloadManager(context)
    private var inferenceEngine: LlamaInferenceEngine? = null
    private var downloadJob: Job? = null
    private var generationJob: Job? = null

    @JavascriptInterface
    fun isNativeAndroid(): Boolean = true

    @JavascriptInterface
    fun getDeviceInfo(): String {
        val json = JSONObject()
        json.put("deviceModel", "HONOR NIC-LX1")
        json.put("soc", "MediaTek Helio G81 Ultra")
        json.put("ramGb", 6)
        json.put("androidVersion", Build.VERSION.RELEASE ?: "15")
        json.put("freeDiskMb", downloadManager.getFreeSpaceBytes() / (1024 * 1024))
        return json.toString()
    }

    @JavascriptInterface
    fun checkModelStatus(filename: String, expectedBytes: Long): String {
        val file = downloadManager.getModelFile(filename)
        val installed = file.exists() && (expectedBytes <= 0L || file.length() == expectedBytes)
        val loaded = inferenceEngine?.isModelLoaded() ?: false
        val rss = inferenceEngine?.getMemoryRssMb() ?: 0L

        val json = JSONObject()
        json.put("installed", installed)
        json.put("existsOnDisk", file.exists())
        json.put("fileSizeBytes", if (file.exists()) file.length() else 0L)
        json.put("loadedInRam", loaded)
        json.put("memoryRssMb", rss)
        json.put("filePath", file.absolutePath)
        return json.toString()
    }

    @JavascriptInterface
    fun startModelDownload(url: String, filename: String, expectedSha256: String, expectedBytes: Long) {
        downloadJob?.cancel()
        downloadJob = scope.launch(Dispatchers.Main) {
            downloadManager.downloadModel(url, filename, expectedSha256, expectedBytes).collect { state ->
                val json = JSONObject()
                when (state) {
                    is DownloadState.Progress -> {
                        json.put("type", "progress")
                        json.put("percent", state.percent)
                        json.put("downloadedBytes", state.downloadedBytes)
                        json.put("totalBytes", state.totalBytes)
                        json.put("speedBytesPerSec", state.speedBytesPerSec)
                        json.put("timeRemainingSec", state.timeRemainingSec)
                        json.put("stepDescription", state.stepDescription)
                    }
                    is DownloadState.VerifyingChecksum -> {
                        json.put("type", "verifying_checksum")
                        json.put("expectedSha256", state.expectedSha256)
                    }
                    is DownloadState.Ready -> {
                        json.put("type", "ready")
                        json.put("filePath", state.modelFile.absolutePath)
                    }
                    is DownloadState.Error -> {
                        json.put("type", "error")
                        json.put("errorMessage", state.message)
                    }
                    else -> {}
                }
                sendEventToWeb("onDownloadStateChanged", json.toString())
            }
        }
    }

    @JavascriptInterface
    fun cancelDownload() {
        downloadJob?.cancel()
        downloadManager.cancelActiveDownload()
    }

    @JavascriptInterface
    fun deleteModel(filename: String): Boolean {
        unloadModel()
        return downloadManager.deleteModel(filename)
    }

    @JavascriptInterface
    fun loadModel(filename: String, contextLength: Int, threads: Int): Boolean {
        val file = downloadManager.getModelFile(filename)
        if (!file.exists()) return false

        if (inferenceEngine == null || inferenceEngine?.isModelLoaded() == false) {
            inferenceEngine = LlamaInferenceEngine(file)
        }
        val targetThreads = if (threads > 0) threads else 4
        val targetCtx = if (contextLength > 0) contextLength else 2048
        val success = inferenceEngine?.load(targetCtx, targetThreads) ?: false

        val json = JSONObject()
        json.put("success", success)
        json.put("memoryRssMb", inferenceEngine?.getMemoryRssMb() ?: 0L)
        sendEventToWeb("onModelLoadedChanged", json.toString())
        return success
    }

    @JavascriptInterface
    fun unloadModel() {
        inferenceEngine?.unload()
        val json = JSONObject()
        json.put("success", true)
        json.put("memoryRssMb", 0)
        sendEventToWeb("onModelLoadedChanged", json.toString())
    }

    @JavascriptInterface
    fun generateStream(prompt: String, maxTokens: Int, temperature: Float) {
        val engine = inferenceEngine
        if (engine == null || !engine.isModelLoaded()) {
            val errJson = JSONObject()
            errJson.put("error", "Model is not loaded into memory")
            sendEventToWeb("onGenerationError", errJson.toString())
            return
        }

        generationJob?.cancel()
        generationJob = scope.launch(Dispatchers.Main) {
            try {
                engine.streamInference(
                    prompt = prompt,
                    maxTokens = if (maxTokens > 0) maxTokens else 512,
                    temperature = if (temperature > 0f) temperature else 0.7f
                ).collect { chunk ->
                    val json = JSONObject()
                    json.put("deltaText", chunk.deltaText)
                    json.put("fullText", chunk.fullText)
                    json.put("isComplete", chunk.metrics.isComplete)

                    val m = JSONObject()
                    m.put("ttftMs", chunk.metrics.ttftMs)
                    m.put("totalTimeMs", chunk.metrics.totalTimeMs)
                    m.put("tokensGenerated", chunk.metrics.tokensGenerated)
                    m.put("tokensPerSec", chunk.metrics.tokensPerSec)
                    m.put("wordsPerMinute", chunk.metrics.wordsPerMinute)
                    m.put("memoryRssMb", chunk.metrics.memoryRssMb)
                    json.put("metrics", m)

                    sendEventToWeb("onGenerationChunk", json.toString())
                }
            } catch (e: Exception) {
                val errJson = JSONObject()
                errJson.put("error", e.message ?: "Generation error")
                sendEventToWeb("onGenerationError", errJson.toString())
            }
        }
    }

    @JavascriptInterface
    fun stopGeneration() {
        generationJob?.cancel()
        inferenceEngine?.stop()
    }

    private fun sendEventToWeb(eventName: String, jsonPayload: String) {
        webView.post {
            val escaped = jsonPayload.replace("'", "\\\\\\'").replace("\\n", "\\\\\\n")
            val js = "if (window.dispatchEvent) { window.dispatchEvent(new CustomEvent('\$eventName', { detail: JSON.parse('\$escaped') })); }"
            webView.evaluateJavascript(js, null)
        }
    }
}`
  },
  {
    path: 'app/src/main/java/com/offlineknowledge/app/ui/MainActivity.kt',
    language: 'kotlin',
    description: 'Activity: WebView с оффлайн-кэшированием, привязкой JavascriptInterface и жизненным циклом',
    content: `package com.offlineknowledge.app.ui

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.lifecycleScope
import com.offlineknowledge.app.bridge.OfflineMindBridge

class MainActivity : ComponentActivity() {

    private var webView: WebView? = null
    private var bridge: OfflineMindBridge? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { ctx ->
                            WebView(ctx).apply {
                                layoutParams = ViewGroup.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                                )
                                settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    databaseEnabled = true
                                    allowFileAccess = true
                                    allowContentAccess = true
                                    cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                                }

                                val nativeBridge = OfflineMindBridge(ctx, this, lifecycleScope)
                                bridge = nativeBridge
                                addJavascriptInterface(nativeBridge, "OfflineMindNative")

                                webViewClient = object : WebViewClient() {}
                                webView = this

                                loadUrl("file:///android_asset/dist/index.html")
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        bridge?.unloadModel()
        webView?.destroy()
        webView = null
    }
}`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    language: 'xml',
    description: 'Манифест приложения с разрешениями INTERNET и ACCESS_NETWORK_STATE',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Интернет используется исключительно для первой загрузки модели GGUF -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Offline Knowledge"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.NoActionBar">
        
        <activity
            android:name=".ui.MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`
  }
];
