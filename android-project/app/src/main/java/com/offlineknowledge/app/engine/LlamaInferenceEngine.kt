package com.offlineknowledge.app.engine

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
        // Потоковый вывод токенов через JNI коллбек в Android
    }.flowOn(Dispatchers.Default)
}
