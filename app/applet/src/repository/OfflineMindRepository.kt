package com.offlineknowledge.app.repository

import android.content.Context
import com.offlineknowledge.app.data.AppDatabase
import com.offlineknowledge.app.data.HistoryEntity
import com.offlineknowledge.app.data.KnowledgeEntity
import com.offlineknowledge.app.download.DownloadState
import com.offlineknowledge.app.download.ModelDownloadManager
import com.offlineknowledge.app.engine.GenerationMetrics
import com.offlineknowledge.app.engine.LlamaInferenceEngine
import com.offlineknowledge.app.engine.StreamChunk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

data class ModelSpec(
    val id: String,
    val name: String,
    val tag: String,
    val filename: String,
    val sizeBytes: Long,
    val sizeFormatted: String,
    val parameters: String,
    val contextLength: Int,
    val expectedRamMb: Int,
    val sha256: String,
    val downloadUrl: String,
    val isRecommended: Boolean,
    val description: String
)

val SUPPORTED_MODELS = listOf(
    ModelSpec(
        id = "qwen2.5-0.5b-instruct-q4_k_m",
        name = "Qwen 2.5 0.5B Instruct",
        tag = "Компактный тестовый кандидат (Рекомендуется)",
        filename = "qwen2.5-0.5b-instruct-q4_k_m.gguf",
        sizeBytes = 491400032L,
        sizeFormatted = "468.6 МБ",
        parameters = "0.49 млрд",
        contextLength = 2048,
        expectedRamMb = 550,
        sha256 = "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db",
        downloadUrl = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        isRecommended = true,
        description = "Ультра-быстрый инференс на процессоре MediaTek Helio G81 Ultra. Занимает ~300-550 МБ RAM из 6 ГБ устройства HONOR NIC-LX1."
    ),
    ModelSpec(
        id = "qwen2.5-1.5b-instruct-q4_k_m",
        name = "Qwen 2.5 1.5B Instruct",
        tag = "Основной кандидат (1.5B)",
        filename = "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        sizeBytes = 1117320736L,
        sizeFormatted = "1.04 ГБ",
        parameters = "1.54 млрд",
        contextLength = 2048,
        expectedRamMb = 1350,
        sha256 = "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e",
        downloadUrl = "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        isRecommended = false,
        description = "Более глубокие формулировки сложных определений. Требует ~1.3 ГБ RAM. Проверен на совместимость с архитектурой ARM64."
    )
)

sealed class ModelRuntimeState {
    object NotInstalled : ModelRuntimeState()
    data class Downloading(val progress: DownloadState.Progress) : ModelRuntimeState()
    data class Verifying(val expectedSha256: String) : ModelRuntimeState()
    data class Ready(val isLoadedInRam: Boolean, val memoryRssMb: Long) : ModelRuntimeState()
    data class Error(val message: String) : ModelRuntimeState()
}

class OfflineMindRepository(private val context: Context) {
    private val db = AppDatabase.getInstance(context)
    val downloadManager = ModelDownloadManager(context)

    private val _selectedModel = MutableStateFlow(SUPPORTED_MODELS[0])
    val selectedModel: StateFlow<ModelSpec> = _selectedModel.asStateFlow()

    private val _runtimeState = MutableStateFlow<ModelRuntimeState>(ModelRuntimeState.NotInstalled)
    val runtimeState: StateFlow<ModelRuntimeState> = _runtimeState.asStateFlow()

    private var activeEngine: LlamaInferenceEngine? = null

    init {
        refreshModelStatus()
    }

    fun selectModel(spec: ModelSpec) {
        if (_selectedModel.value.id != spec.id) {
            unloadModel()
            _selectedModel.value = spec
            refreshModelStatus()
        }
    }

    fun refreshModelStatus() {
        val model = _selectedModel.value
        val file = downloadManager.getModelFile(model.filename)
        if (file.exists() && file.length() == model.sizeBytes) {
            val isLoaded = activeEngine?.isModelLoaded() ?: false
            val rss = activeEngine?.getMemoryRssMb() ?: 0L
            _runtimeState.value = ModelRuntimeState.Ready(isLoaded, rss)
        } else {
            _runtimeState.value = ModelRuntimeState.NotInstalled
        }
    }

    fun startModelDownload(): Flow<DownloadState> {
        val model = _selectedModel.value
        return downloadManager.downloadModel(
            url = model.downloadUrl,
            targetFileName = model.filename,
            expectedSha256 = model.sha256,
            expectedBytes = model.sizeBytes
        ).onEach { state ->
            when (state) {
                is DownloadState.Progress -> _runtimeState.value = ModelRuntimeState.Downloading(state)
                is DownloadState.VerifyingChecksum -> _runtimeState.value = ModelRuntimeState.Verifying(state.expectedSha256)
                is DownloadState.Ready -> {
                    val loaded = loadModel()
                    if (loaded) {
                        _runtimeState.value = ModelRuntimeState.Ready(true, activeEngine?.getMemoryRssMb() ?: 0L)
                    } else {
                        _runtimeState.value = ModelRuntimeState.Error("Файл модели скачан, но не смог загрузиться в память движком llama.cpp.")
                    }
                }
                is DownloadState.Error -> _runtimeState.value = ModelRuntimeState.Error(state.message)
                else -> {}
            }
        }
    }

    fun cancelDownload() {
        downloadManager.cancelActiveDownload()
        refreshModelStatus()
    }

    fun deleteModel(): Boolean {
        unloadModel()
        val success = downloadManager.deleteModel(_selectedModel.value.filename)
        refreshModelStatus()
        return success
    }

    fun loadModel(): Boolean {
        val model = _selectedModel.value
        val file = downloadManager.getModelFile(model.filename)
        if (!file.exists()) return false

        if (activeEngine == null) {
            activeEngine = LlamaInferenceEngine(file)
        }
        val success = activeEngine?.load(contextLength = model.contextLength, threads = 4) ?: false
        val rss = activeEngine?.getMemoryRssMb() ?: 0L
        _runtimeState.value = ModelRuntimeState.Ready(success, rss)
        return success
    }

    fun unloadModel() {
        activeEngine?.unload()
        activeEngine = null
        refreshModelStatus()
    }

    fun stopInference() {
        activeEngine?.stop()
    }

    fun answerQuestion(query: String): Flow<Pair<StreamChunk, KnowledgeEntity?>> = flow {
        val engine = activeEngine
        if (engine == null || !engine.isModelLoaded()) {
            val ok = loadModel()
            if (!ok) {
                throw IllegalStateException("Модель не загружена в память. Проверьте статус в настройках.")
            }
        }

        val matches = withContext(Dispatchers.IO) {
            db.knowledgeDao().search(query.trim())
        }
        val matchedEntry = matches.firstOrNull()

        val prompt = if (matchedEntry != null) {
            val facts = buildString {
                appendLine("ПОНЯТИЕ: ${matchedEntry.canonicalTitle}")
                appendLine("ОПРЕДЕЛЕНИЕ: ${matchedEntry.definition}")
                if (!matchedEntry.formulasJson.isNullOrBlank()) appendLine("ФОРМУЛЫ: ${matchedEntry.formulasJson}")
                if (!matchedEntry.conversionsJson.isNullOrBlank()) appendLine("СООТНОШЕНИЯ: ${matchedEntry.conversionsJson}")
                if (matchedEntry.doNotConfuseTerm != null) appendLine("НЕ ПУТАТЬ С: ${matchedEntry.doNotConfuseTerm} (${matchedEntry.doNotConfuseDifference})")
            }
            "<|im_start|>system\nТы — OfflineMind, персональный справочник на устройстве HONOR NIC-LX1. Используй приведённые проверенные сведения для точного и понятного объяснения на русском языке:\n$facts<|im_end|>\n<|im_start|>user\n$query<|im_end|>\n<|im_start|>assistant\n"
        } else {
            "<|im_start|>system\nТы — OfflineMind, персональный справочник по точным наукам. Ответь на вопрос пользователя чётко и понятно на русском языке.<|im_end|>\n<|im_start|>user\n$query<|im_end|>\n<|im_start|>assistant\n"
        }

        var finalChunk: StreamChunk? = null
        engine!!.streamInference(prompt, maxTokens = 256, temperature = 0.7f).collect { chunk ->
            finalChunk = chunk
            emit(Pair(chunk, matchedEntry))
        }

        finalChunk?.let { chunk ->
            val historyRecord = HistoryEntity(
                id = UUID.randomUUID().toString(),
                timestamp = System.currentTimeMillis(),
                query = query,
                answerText = chunk.fullText,
                matchedEntryTitle = matchedEntry?.canonicalTitle,
                ttftMs = chunk.metrics.ttftMs,
                totalTimeMs = chunk.metrics.totalTimeMs,
                tokensGenerated = chunk.metrics.tokensGenerated,
                tokensPerSec = chunk.metrics.tokensPerSec,
                memoryRssMb = chunk.metrics.memoryRssMb,
                isFavorite = false
            )
            withContext(Dispatchers.IO) {
                db.historyDao().insert(historyRecord)
            }
        }
    }.flowOn(Dispatchers.Default)

    fun getKnowledgeCategories(): Flow<List<KnowledgeEntity>> = db.knowledgeDao().getAllFlow()
    fun getHistory(): Flow<List<HistoryEntity>> = db.historyDao().getAllHistoryFlow()
    fun getFavorites(): Flow<List<HistoryEntity>> = db.historyDao().getFavoritesFlow()

    suspend fun setFavorite(id: String, isFav: Boolean) = withContext(Dispatchers.IO) {
        db.historyDao().setFavorite(id, isFav)
    }

    suspend fun deleteHistory(id: String) = withContext(Dispatchers.IO) {
        db.historyDao().deleteById(id)
    }

    suspend fun clearHistory() = withContext(Dispatchers.IO) {
        db.historyDao().clearAll()
    }
}
