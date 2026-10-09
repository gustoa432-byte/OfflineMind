package com.offlineknowledge.app.bridge

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
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

/**
 * JavaScript Bridge exposed as `window.OfflineMindNative` inside the Android WebView.
 * Provides direct access to llama.cpp JNI engine and native file storage.
 */
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
    fun startModelDownload(
        url: String,
        filename: String,
        expectedSha256: String,
        expectedBytes: Long
    ) {
        downloadJob?.cancel()
        downloadJob = scope.launch(Dispatchers.Main) {
            downloadManager.downloadModel(url, filename, expectedSha256, expectedBytes).collect { state ->
                val json = JSONObject()
                when (state) {
                    is DownloadState.Idle -> {
                        json.put("type", "idle")
                    }
                    is DownloadState.CheckingSpace -> {
                        json.put("type", "checking_space")
                        json.put("freeBytes", state.freeBytes)
                        json.put("requiredBytes", state.requiredBytes)
                    }
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
            val escaped = jsonPayload.replace("'", "\\'").replace("\n", "\\n")
            val js = "if (window.dispatchEvent) { window.dispatchEvent(new CustomEvent('$eventName', { detail: JSON.parse('$escaped') })); }"
            webView.evaluateJavascript(js, null)
        }
    }
}
