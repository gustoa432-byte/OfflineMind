package com.offlineknowledge.app.repository

import android.content.Context
import com.offlineknowledge.app.data.AppDatabase
import com.offlineknowledge.app.data.HistoryEntity
import com.offlineknowledge.app.data.KnowledgeChunkEntity
import com.offlineknowledge.app.data.KnowledgeEntity
import com.offlineknowledge.app.download.DEFAULT_PACK_MANIFEST
import com.offlineknowledge.app.download.DownloadState
import com.offlineknowledge.app.download.KnowledgePackDownloader
import com.offlineknowledge.app.download.ModelDownloadManager
import com.offlineknowledge.app.download.PackDownloadState
import com.offlineknowledge.app.download.PackManifest
import com.offlineknowledge.app.engine.GenerationMetrics
import com.offlineknowledge.app.engine.KnowledgeSearchResult
import com.offlineknowledge.app.engine.LlamaInferenceEngine
import com.offlineknowledge.app.engine.OfflineKnowledgeSearchEngine
import com.offlineknowledge.app.engine.StreamChunk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.withContext
import org.json.JSONArray
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
        id = "qwen2.5-1.5b-instruct-q4_k_m",
        name = "Qwen 2.5 1.5B Instruct",
        tag = "Основная модель (Рекомендуется)",
        filename = "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        sizeBytes = 1117320736L,
        sizeFormatted = "1.04 ГБ",
        parameters = "1.54 млрд",
        contextLength = 2048,
        expectedRamMb = 1350,
        sha256 = "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e",
        downloadUrl = "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        isRecommended = true,
        description = "Основной интеллект офлайн-помощника. Высокая точность математических определений и формул для 6 ГБ RAM устройства HONOR NIC-LX1."
    ),
    ModelSpec(
        id = "qwen2.5-0.5b-instruct-q4_k_m",
        name = "Qwen 2.5 0.5B Instruct",
        tag = "Запасная компактная модель",
        filename = "qwen2.5-0.5b-instruct-q4_k_m.gguf",
        sizeBytes = 491400032L,
        sizeFormatted = "468.6 МБ",
        parameters = "0.49 млрд",
        contextLength = 2048,
        expectedRamMb = 550,
        sha256 = "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db",
        downloadUrl = "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        isRecommended = false,
        description = "Запасная модель для устройств с дефицитом памяти или максимальной скорости инференса. Занимает всего ~400-550 МБ RAM."
    )
)

sealed class ModelRuntimeState {
    object NotInstalled : ModelRuntimeState()
    data class Downloading(val progress: DownloadState.Progress) : ModelRuntimeState()
    data class Verifying(val expectedSha256: String) : ModelRuntimeState()
    data class Ready(val isLoadedInRam: Boolean, val memoryRssMb: Long) : ModelRuntimeState()
    data class Error(val message: String) : ModelRuntimeState()
}

sealed class PackRuntimeState {
    object NotInstalled : PackRuntimeState()
    data class Downloading(val progress: PackDownloadState.Progress) : PackRuntimeState()
    data class Verifying(val expectedSha256: String) : PackRuntimeState()
    object Importing : PackRuntimeState()
    data class Ready(val entriesCount: Int, val chunksCount: Int, val version: Int) : PackRuntimeState()
    data class Error(val message: String) : PackRuntimeState()
}

data class AnswerQueryResult(
    val chunk: StreamChunk,
    val matchedEntry: KnowledgeEntity? = null,
    val matchedChunk: KnowledgeChunkEntity? = null,
    val isNotFoundInPack: Boolean = false
)

class OfflineMindRepository(private val context: Context) {
    private val db = AppDatabase.getInstance(context)
    val downloadManager = ModelDownloadManager(context)
    val packDownloader = KnowledgePackDownloader(context)

    private val _selectedModel = MutableStateFlow(SUPPORTED_MODELS[0])
    val selectedModel: StateFlow<ModelSpec> = _selectedModel.asStateFlow()

    private val _runtimeState = MutableStateFlow<ModelRuntimeState>(ModelRuntimeState.NotInstalled)
    val runtimeState: StateFlow<ModelRuntimeState> = _runtimeState.asStateFlow()

    private val _packState = MutableStateFlow<PackRuntimeState>(PackRuntimeState.NotInstalled)
    val packState: StateFlow<PackRuntimeState> = _packState.asStateFlow()

    private val _packManifest = MutableStateFlow(DEFAULT_PACK_MANIFEST)
    val packManifest: StateFlow<PackManifest> = _packManifest.asStateFlow()

    private var activeEngine: LlamaInferenceEngine? = null

    init {
        refreshModelStatus()
        refreshPackStatus()
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

    fun refreshPackStatus() {
        if (packDownloader.isPackInstalled()) {
            // Count rows in Room
            kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launchSilently {
                val entries = db.knowledgeDao().getAllEntries()
                val chunks = db.knowledgeChunkDao().getAllChunks()
                withContext(Dispatchers.Main) {
                    if (entries.isNotEmpty() || chunks.isNotEmpty()) {
                        _packState.value = PackRuntimeState.Ready(
                            entriesCount = entries.size,
                            chunksCount = chunks.size,
                            version = _packManifest.value.version
                        )
                    } else {
                        _packState.value = PackRuntimeState.NotInstalled
                    }
                }
            }
        } else {
            _packState.value = PackRuntimeState.NotInstalled
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

    fun startPackDownload(): Flow<PackDownloadState> {
        val manifest = _packManifest.value
        return packDownloader.downloadAndImportPack(
            url = manifest.downloadUrl,
            targetFileName = manifest.filename,
            expectedSha256 = manifest.sha256,
            expectedBytes = manifest.sizeBytes
        ).onEach { state ->
            when (state) {
                is PackDownloadState.Progress -> _packState.value = PackRuntimeState.Downloading(state)
                is PackDownloadState.VerifyingChecksum -> _packState.value = PackRuntimeState.Verifying(state.expectedSha256)
                is PackDownloadState.Importing -> _packState.value = PackRuntimeState.Importing
                is PackDownloadState.Ready -> _packState.value = PackRuntimeState.Ready(state.entriesCount, state.chunksCount, state.version)
                is PackDownloadState.Error -> _packState.value = PackRuntimeState.Error(state.message)
                else -> {}
            }
        }
    }

    fun cancelPackDownload() {
        packDownloader.cancelActiveDownload()
        refreshPackStatus()
    }

    suspend fun deletePack(): Boolean {
        packDownloader.clearImportedKnowledge()
        val success = packDownloader.deletePack()
        refreshPackStatus()
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

    /**
     * Core math assistant inference query:
     * 1. Search entries & chunks with scoring and intent synonyms
     * 2. If nothing found -> strict refusal without hallucination
     * 3. If found -> strictly grounded prompt -> local Qwen inference
     */
    fun answerQuestion(query: String): Flow<AnswerQueryResult> = flow {
        // Step 1: Search facts in local Room DB
        val (entries, chunks) = withContext(Dispatchers.IO) {
            val allEntries = db.knowledgeDao().getAllEntries()
            val allChunks = db.knowledgeChunkDao().getAllChunks()
            Pair(allEntries, allChunks)
        }

        val searchResult = OfflineKnowledgeSearchEngine.findBestMatch(query, entries, chunks)

        // Strict behavior when facts are not found in offline pack
        if (searchResult is KnowledgeSearchResult.NotFound) {
            val notFoundText = "В локальном справочнике этого понятия пока нет.\nПопробуйте сформулировать иначе или скачать обновление справочника, когда оно появится."
            val dummyMetrics = GenerationMetrics(
                ttftMs = 5,
                totalTimeMs = 10,
                tokensGenerated = 0,
                tokensPerSec = 0.0,
                wordsPerMinute = 0,
                memoryRssMb = activeEngine?.getMemoryRssMb()?.toInt() ?: 0,
                isComplete = true
            )
            emit(AnswerQueryResult(
                chunk = StreamChunk(deltaText = notFoundText, fullText = notFoundText, metrics = dummyMetrics),
                isNotFoundInPack = true
            ))
            return@flow
        }

        // Step 2: Ensure LLM is loaded
        val engine = activeEngine
        if (engine == null || !engine.isModelLoaded()) {
            val ok = loadModel()
            if (!ok) {
                throw IllegalStateException("Модель не загружена в память. Проверьте статус во вкладке «Модель».")
            }
        }

        // Step 3: Construct strictly grounded prompt
        val (prompt, matchedEntry, matchedChunk) = when (searchResult) {
            is KnowledgeSearchResult.EntryFound -> {
                val entry = searchResult.entry
                val facts = buildString {
                    appendLine("ПОНЯТИЕ: ${entry.canonicalTitle}")
                    appendLine("ОПРЕДЕЛЕНИЕ: ${entry.definition}")
                    appendLine("ПРОСТОЕ ОБЪЯСНЕНИЕ: ${entry.simpleExplanation}")
                    if (!entry.formulasJson.isNullOrBlank() && entry.formulasJson != "[]") {
                        try {
                            val formulas = JSONArray(entry.formulasJson)
                            val fList = (0 until formulas.length()).map { formulas.getString(it) }
                            appendLine("ФОРМУЛЫ: ${fList.joinToString("; ")}")
                        } catch (e: Exception) {
                            appendLine("ФОРМУЛЫ: ${entry.formulasJson}")
                        }
                    }
                    if (entry.doNotConfuseTerm != null) {
                        appendLine("НЕ ПУТАТЬ С: ${entry.doNotConfuseTerm} (${entry.doNotConfuseDifference})")
                    }
                    try {
                        val exArr = JSONArray(entry.examplesJson)
                        if (exArr.length() > 0) {
                            appendLine("ПРИМЕР: ${exArr.getString(0)}")
                        }
                    } catch (e: Exception) {}
                }

                val p = """<|im_start|>system
Ты — OfflineMind, офлайн-справочник по математике на устройстве пользователя.
Отвечай ТОЛЬКО на русском языке.
Используй ТОЛЬКО приведённые ниже факты. Ничего не выдумывай и не добавляй от себя.
Если фактов недостаточно для полного ответа — скажи об этом прямо.

Структура ответа:
1) Простыми словами
2) Правило или формула (если есть)
3) Короткий пример (если уместно)

ФАКТЫ:
$facts<|im_end|>
<|im_start|>user
$query<|im_end|>
<|im_start|>assistant
"""
                Triple(p, entry, null)
            }

            is KnowledgeSearchResult.ChunkFound -> {
                val chunk = searchResult.chunk
                val p = """<|im_start|>system
Ты — OfflineMind, офлайн-справочник по математике на устройстве пользователя.
Отвечай ТОЛЬКО на русском языке.
Используй ТОЛЬКО приведённые ниже факты. Ничего не выдумывай и не добавляй от себя.
Если фактов недостаточно для полного ответа — скажи об этом прямо.

Структура ответа:
1) Простыми словами
2) Правило или формула (если есть)
3) Короткий пример (если уместно)

ФАКТЫ:
РАЗДЕЛ: ${chunk.title} (Класс: ${chunk.grade}, Источник: ${chunk.source})
ТЕКСТ: ${chunk.text}<|im_end|>
<|im_start|>user
$query<|im_end|>
<|im_start|>assistant
"""
                Triple(p, null, chunk)
            }

            else -> Triple("", null, null)
        }

        var finalChunk: StreamChunk? = null
        engine!!.streamInference(prompt, maxTokens = 384, temperature = 0.6f).collect { chunk ->
            finalChunk = chunk
            emit(AnswerQueryResult(
                chunk = chunk,
                matchedEntry = matchedEntry,
                matchedChunk = matchedChunk,
                isNotFoundInPack = false
            ))
        }

        finalChunk?.let { chunk ->
            val historyRecord = HistoryEntity(
                id = UUID.randomUUID().toString(),
                timestamp = System.currentTimeMillis(),
                query = query,
                answerText = chunk.fullText,
                matchedEntryTitle = matchedEntry?.canonicalTitle ?: matchedChunk?.title,
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

private fun kotlinx.coroutines.CoroutineScope.launchSilently(block: suspend () -> Unit) {
    this.launch(Dispatchers.IO) {
        try {
            block()
        } catch (e: Exception) {}
    }
}
