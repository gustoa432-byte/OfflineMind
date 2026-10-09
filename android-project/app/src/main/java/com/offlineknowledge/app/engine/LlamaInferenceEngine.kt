package com.offlineknowledge.app.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import java.io.File

/**
 * Native JNI interface to compiled llama.cpp (libllama-jni.so)
 */
object LlamaNative {
    init {
        try {
            System.loadLibrary("llama-jni")
        } catch (e: UnsatisfiedLinkError) {
            System.err.println("Failed to load libllama-jni.so: ${e.message}")
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
    /**
     * Called for each generated token piece.
     * @return true to continue generating, false to stop immediately
     */
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
        if (!modelFile.exists() || modelFile.length() == 0L) {
            isLoaded = false
            return false
        }
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

    fun getMemoryRssMb(): Long {
        return LlamaNative.getMemoryRssMb()
    }

    fun streamInference(
        prompt: String,
        maxTokens: Int = 512,
        temperature: Float = 0.7f
    ): Flow<StreamChunk> = callbackFlow {
        if (!isLoaded && !load()) {
            close(IllegalStateException("Model is not loaded into memory"))
            return@callbackFlow
        }

        val startTime = System.currentTimeMillis()
        var firstTokenTime: Long? = null
        var tokenCount = 0
        val textBuilder = StringBuilder()

        val callback = LlamaTokenCallback { token ->
            val now = System.currentTimeMillis()
            if (firstTokenTime == null) {
                firstTokenTime = now
            }
            tokenCount++
            textBuilder.append(token)

            val elapsedMs = now - startTime
            val ttft = (firstTokenTime ?: now) - startTime
            val elapsedSec = maxOf(0.001, elapsedMs / 1000.0)
            val tokensPerSec = tokenCount / elapsedSec
            val words = textBuilder.split("\\s+".toRegex()).filter { it.isNotBlank() }.size
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

            trySend(StreamChunk(
                deltaText = token,
                fullText = textBuilder.toString(),
                metrics = metrics
            ))

            true // continue generation
        }

        val success = LlamaNative.generateStream(prompt, maxTokens, temperature, callback)

        val totalMs = System.currentTimeMillis() - startTime
        val totalSec = maxOf(0.001, totalMs / 1000.0)
        val finalTokensPerSec = tokenCount / totalSec
        val words = textBuilder.split("\\s+".toRegex()).filter { it.isNotBlank() }.size
        val finalWpm = (words / (totalSec / 60.0)).toInt()
        val finalRss = LlamaNative.getMemoryRssMb().toInt()

        val finalMetrics = GenerationMetrics(
            ttftMs = (firstTokenTime ?: (startTime + totalMs)) - startTime,
            totalTimeMs = totalMs,
            tokensGenerated = tokenCount,
            tokensPerSec = String.format("%.1f", finalTokensPerSec).toDoubleOrNull() ?: finalTokensPerSec,
            wordsPerMinute = finalWpm,
            memoryRssMb = finalRss,
            isComplete = true
        )

        trySend(StreamChunk(
            deltaText = "",
            fullText = textBuilder.toString(),
            metrics = finalMetrics
        ))

        close()
        awaitClose {
            LlamaNative.stopGeneration()
        }
    }.flowOn(Dispatchers.Default)
}
