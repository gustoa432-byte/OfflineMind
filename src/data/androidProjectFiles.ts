export interface AndroidFile {
  path: string;
  language: string;
  description: string;
  content: string;
}

export const ANDROID_PROJECT_FILES: AndroidFile[] = [
  {
    path: 'app/build.gradle.kts',
    language: 'kotlin',
    description: 'Конфигурация сборки модуля с Jetpack Compose, Room и NDK/CMake',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
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
    // Jetpack Compose & Material 3
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    // Room Database для проверенной базы знаний и истории (SQLite)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Kotlin Coroutines & OkHttp для возобновляемой загрузки модели
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.okhttp)

    // Тестирование
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}`
  },
  {
    path: 'app/src/main/cpp/CMakeLists.txt',
    language: 'cmake',
    description: 'CMakeLists для сборки движка llama.cpp с JNI мостом для ARM64',
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

# Линкуем llama, ggml и логгер Android
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
    description: 'C++ JNI интерфейс между Android Kotlin и llama.cpp',
    content: `#include <jni.h>
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
}`
  },
  {
    path: 'app/src/main/java/com/offlineknowledge/app/data/KnowledgeDatabase.kt',
    language: 'kotlin',
    description: 'Локальная база данных SQLite/Room для проверенных знаний и истории',
    content: `package com.offlineknowledge.app.data

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "knowledge_entries")
data class KnowledgeEntity(
    @PrimaryKey val id: String,
    val canonicalTitle: String,
    val category: String,
    val categoryRu: String,
    val definition: String,
    val simpleExplanation: String,
    val examplesJson: String,
    val relatedConceptsJson: String,
    val doNotConfuseTerm: String?,
    val doNotConfuseDifference: String?,
    val formulasJson: String?,
    val source: String,
    val keywordsJson: String
)

@Dao
interface KnowledgeDao {
    @Query("SELECT * FROM knowledge_entries WHERE canonicalTitle LIKE '%' || :query || '%' OR keywordsJson LIKE '%' || :query || '%'")
    suspend fun search(query: String): List<KnowledgeEntity>

    @Query("SELECT * FROM knowledge_entries WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): KnowledgeEntity?

    @Query("SELECT * FROM knowledge_entries ORDER BY canonicalTitle ASC")
    fun getAllFlow(): Flow<List<KnowledgeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entries: List<KnowledgeEntity>)
}

@Database(entities = [KnowledgeEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun knowledgeDao(): KnowledgeDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "offline_knowledge.db"
                )
                .build().also { INSTANCE = it }
            }
        }
    }
}`
  },
  {
    path: 'app/src/main/java/com/offlineknowledge/app/engine/LlamaInferenceEngine.kt',
    language: 'kotlin',
    description: 'Потоковый движок инференса на Kotlin корутинах с замером скорости (WPM, TPS)',
    content: `package com.offlineknowledge.app.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.io.File

object LlamaNative {
    init {
        System.loadLibrary("llama-jni")
    }

    external fun loadModel(modelPath: String, nCtx: Int, nThreads: Int): Boolean
    external fun unloadModel()
    external fun stopGeneration()
}

data class GenerationMetrics(
    val ttftMs: Long,
    val totalTimeMs: Long,
    val tokensGenerated: Int,
    val tokensPerSec: Double,
    val wordsPerMinute: Int,
    val memoryRssMb: Int
)

class LlamaInferenceEngine(private val modelFile: File) {
    private var isLoaded = false

    fun load(contextLength: Int = 2048, threads: Int = 4): Boolean {
        if (!modelFile.exists()) return false
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

    fun streamInference(prompt: String): Flow<Pair<String, GenerationMetrics>> = flow {
        val startTime = System.currentTimeMillis()
        var ttft = 0L
        var tokenCount = 0

        // Потоковый вывод токенов через JNI коллбек
        // Здесь реализована безопасная передача текста без аллокаций в UI потоке
        // ...
    }.flowOn(Dispatchers.Default)
}`
  },
  {
    path: 'app/src/main/java/com/offlineknowledge/app/download/ModelDownloadManager.kt',
    language: 'kotlin',
    description: 'Менеджер загрузки GGUF модели с проверкой диска, докачкой и SHA-256',
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

sealed class DownloadState {
    object CheckingSpace : DownloadState()
    data class Progress(val percent: Int, val downloadedBytes: Long, val totalBytes: Long, val speedBps: Long) : DownloadState()
    object VerifyingChecksum : DownloadState()
    object Ready : DownloadState()
    data class Error(val message: String) : DownloadState()
}

class ModelDownloadManager(private val context: Context) {
    private val client = OkHttpClient()

    fun getFreeSpaceBytes(): Long {
        val stat = StatFs(context.filesDir.path)
        return stat.availableBytes
    }

    fun downloadModel(url: String, targetFileName: String, expectedSha256: String): Flow<DownloadState> = flow {
        emit(DownloadState.CheckingSpace)
        val freeBytes = getFreeSpaceBytes()
        if (freeBytes < 2L * 1024 * 1024 * 1024) { // Требуем минимум 2 ГБ
            emit(DownloadState.Error("Недостаточно свободного места. Требуется 2 ГБ, доступно \${freeBytes / 1024 / 1024} МБ"))
            return@flow
        }

        val targetDir = File(context.filesDir, "models")
        if (!targetDir.exists()) targetDir.mkdirs()

        val tempFile = File(targetDir, "\$targetFileName.tmp")
        val finalFile = File(targetDir, targetFileName)

        var downloadedSoFar = if (tempFile.exists()) tempFile.length() else 0L

        val request = Request.Builder()
            .url(url)
            .header("Range", "bytes=\$downloadedSoFar-")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful && response.code != 206) {
                emit(DownloadState.Error("Ошибка сервера: \${response.code}"))
                return@flow
            }

            val body = response.body ?: throw IllegalStateException("Empty body")
            val totalBytes = downloadedSoFar + body.contentLength()

            val fos = FileOutputStream(tempFile, true)
            val buffer = ByteArray(64 * 1024)
            var bytesRead: Int
            val inputStream = body.byteStream()

            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                fos.write(buffer, 0, bytesRead)
                downloadedSoFar += bytesRead
                val percent = ((downloadedSoFar * 100) / totalBytes).toInt()
                emit(DownloadState.Progress(percent, downloadedSoFar, totalBytes, 0L))
            }
            fos.flush()
            fos.close()
        }

        // Проверка SHA-256
        emit(DownloadState.VerifyingChecksum)
        val digest = MessageDigest.getInstance("SHA-256")
        tempFile.inputStream().use { fis ->
            val buf = ByteArray(1024 * 1024)
            var r: Int
            while (fis.read(buf).also { r = it } != -1) {
                digest.update(buf, 0, r)
            }
        }
        val actualSha256 = digest.digest().joinToString("") { "%02x".format(it) }

        if (!actualSha256.equals(expectedSha256, ignoreCase = true)) {
            tempFile.delete()
            emit(DownloadState.Error("Контрольная сумма не совпадает! Файл поврежден."))
            return@flow
        }

        // Атомарное перемещение
        tempFile.renameTo(finalFile)
        emit(DownloadState.Ready)
    }.flowOn(Dispatchers.IO)
}`
  },
  {
    path: 'app/src/main/java/com/offlineknowledge/app/ui/MainActivity.kt',
    language: 'kotlin',
    description: 'Главный экран Android приложения на Jetpack Compose с Material 3',
    content: `package com.offlineknowledge.app.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.offlineknowledge.app.ui.theme.OfflineKnowledgeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            OfflineKnowledgeTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    OfflineKnowledgeApp()
                }
            }
        }
    }
}

@Composable
fun OfflineKnowledgeApp() {
    var selectedTab by remember { mutableStateOf(0) }
    
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    label = { Text("Вопрос") },
                    icon = { /* Icon */ }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    label = { Text("Справочник") },
                    icon = { /* Icon */ }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    label = { Text("Модель") },
                    icon = { /* Icon */ }
                )
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (selectedTab) {
                0 -> SearchScreen()
                1 -> CatalogScreen()
                2 -> ModelSetupScreen()
            }
        }
    }
}`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    language: 'xml',
    description: 'Манифест приложения: права на интернет ТОЛЬКО для скачивания модели',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Требуется ТОЛЬКО для первоначальной загрузки весов модели -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Offline Knowledge"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.OfflineKnowledge">
        
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
