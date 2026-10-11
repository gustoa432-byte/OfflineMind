package com.offlineknowledge.app.download

import android.content.Context
import android.os.StatFs
import com.offlineknowledge.app.data.AppDatabase
import com.offlineknowledge.app.data.KnowledgeChunkEntity
import com.offlineknowledge.app.data.KnowledgeEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

sealed class PackDownloadState {
    object Idle : PackDownloadState()
    data class Progress(
        val percent: Int,
        val downloadedBytes: Long,
        val totalBytes: Long,
        val speedBytesPerSec: Long,
        val stepDescription: String
    ) : PackDownloadState()
    data class VerifyingChecksum(val expectedSha256: String) : PackDownloadState()
    object Importing : PackDownloadState()
    data class Ready(val entriesCount: Int, val chunksCount: Int, val version: Int) : PackDownloadState()
    data class Error(val message: String) : PackDownloadState()
}

data class PackManifest(
    val version: Int,
    val filename: String,
    val sizeBytes: Long,
    val sha256: String,
    val downloadUrl: String,
    val entriesCount: Int,
    val chunksCount: Int,
    val updatedAt: String
)

val DEFAULT_PACK_MANIFEST = PackManifest(
    version = 2,
    filename = "knowledge_pack_v1.json",
    sizeBytes = 163432L,
    sha256 = "776da5184936fe2a77a7873798dd4cbc542d7f68fe9dd3b8a09b22b0f34b90d4",
    downloadUrl = "https://raw.githubusercontent.com/fedorovichevvv/OfflineMind/main/data/knowledge_pack_v1.json",
    entriesCount = 54,
    chunksCount = 20,
    updatedAt = "2026-10-11"
)

class KnowledgePackDownloader(private val context: Context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    private var activeCall: okhttp3.Call? = null
    private val db = AppDatabase.getInstance(context)

    fun getPacksDirectory(): File {
        val dir = File(context.filesDir, "packs")
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    fun getPackFile(filename: String = "knowledge_pack_v1.json"): File {
        return File(getPacksDirectory(), filename)
    }

    fun isPackInstalled(filename: String = "knowledge_pack_v1.json"): Boolean {
        val file = getPackFile(filename)
        return file.exists() && file.length() > 0
    }

    fun deletePack(filename: String = "knowledge_pack_v1.json"): Boolean {
        val file = getPackFile(filename)
        var deleted = false
        if (file.exists()) {
            deleted = file.delete()
        }
        return deleted
    }

    suspend fun clearImportedKnowledge() = withContext(Dispatchers.IO) {
        db.knowledgeDao().clearEntries()
        db.knowledgeChunkDao().clearChunks()
    }

    fun downloadAndImportPack(
        url: String,
        targetFileName: String = "knowledge_pack_v1.json",
        expectedSha256: String,
        expectedBytes: Long
    ): Flow<PackDownloadState> = flow {
        emit(PackDownloadState.Progress(0, 0, expectedBytes, 0, "Подключение к источнику данных..."))

        val targetFile = getPackFile(targetFileName)
        val tempFile = File(getPacksDirectory(), "$targetFileName.tmp")

        if (tempFile.exists()) {
            tempFile.delete()
        }

        val request = Request.Builder()
            .url(url)
            .header("User-Agent", "OfflineMind-PackDownloader/1.0 (Android)")
            .build()

        val call = client.newCall(request)
        activeCall = call

        var outputStream: FileOutputStream? = null
        try {
            val response = call.execute()
            if (!response.isSuccessful) {
                emit(PackDownloadState.Error("Сервер вернул ошибку HTTP ${response.code}"))
                return@flow
            }

            val body = response.body ?: run {
                emit(PackDownloadState.Error("Пустой ответ от сервера"))
                return@flow
            }

            val contentLength = if (body.contentLength() > 0) body.contentLength() else expectedBytes
            outputStream = FileOutputStream(tempFile, false)

            val buffer = ByteArray(8192)
            var bytesRead: Int
            var downloadedBytes = 0L
            var lastUpdateTime = System.currentTimeMillis()
            var bytesSinceLastUpdate = 0L

            body.byteStream().use { input ->
                while (input.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                    downloadedBytes += bytesRead
                    bytesSinceLastUpdate += bytesRead

                    val now = System.currentTimeMillis()
                    if (now - lastUpdateTime >= 250) {
                        val elapsed = maxOf(1L, now - lastUpdateTime)
                        val speed = (bytesSinceLastUpdate * 1000) / elapsed
                        val pct = if (contentLength > 0) ((downloadedBytes * 100) / contentLength).toInt().coerceIn(0, 99) else 0

                        emit(PackDownloadState.Progress(
                            percent = pct,
                            downloadedBytes = downloadedBytes,
                            totalBytes = contentLength,
                            speedBytesPerSec = speed,
                            stepDescription = "Загрузка: ${(downloadedBytes / 1024)} КБ из ${(contentLength / 1024)} КБ ($pct%)"
                        ))

                        lastUpdateTime = now
                        bytesSinceLastUpdate = 0L
                    }
                }
            }

            outputStream.flush()
            outputStream.close()
            outputStream = null

            // Verifying checksum
            emit(PackDownloadState.VerifyingChecksum(expectedSha256))
            val actualSha256 = calculateSha256(tempFile)
            if (!actualSha256.equals(expectedSha256, ignoreCase = true)) {
                tempFile.delete()
                emit(PackDownloadState.Error("Несовпадение хэш-суммы SHA-256. Ожидалось: $expectedSha256, получено: $actualSha256"))
                return@flow
            }

            // Move temp to target
            if (targetFile.exists()) {
                targetFile.delete()
            }
            if (!tempFile.renameTo(targetFile)) {
                emit(PackDownloadState.Error("Не удалось переместить временный файл справочника"))
                return@flow
            }

            // Import to Room DB
            emit(PackDownloadState.Importing)
            val jsonContent = targetFile.readText(Charsets.UTF_8)
            val root = JSONObject(jsonContent)
            val version = root.optInt("version", 1)

            val entriesArray = root.getJSONArray("entries")
            val chunksArray = root.getJSONArray("chunks")

            val entriesList = mutableListOf<KnowledgeEntity>()
            for (i in 0 until entriesArray.length()) {
                val item = entriesArray.getJSONObject(i)
                val doNotConfuse = item.optJSONObject("doNotConfuseWith")
                entriesList.add(
                    KnowledgeEntity(
                        id = item.getString("id"),
                        canonicalTitle = item.getString("canonicalTitle"),
                        category = item.getString("category"),
                        categoryRu = item.getString("categoryNameRu"),
                        definition = item.getString("definition"),
                        simpleExplanation = item.getString("simpleExplanation"),
                        examplesJson = item.getJSONArray("examples").toString(),
                        relatedConceptsJson = item.getJSONArray("relatedConcepts").toString(),
                        doNotConfuseTerm = doNotConfuse?.optString("term"),
                        doNotConfuseDifference = doNotConfuse?.optString("difference"),
                        formulasJson = item.optJSONArray("formulas")?.toString(),
                        source = item.getString("source"),
                        keywordsJson = item.getJSONArray("keywords").toString()
                    )
                )
            }

            val chunksList = mutableListOf<KnowledgeChunkEntity>()
            for (i in 0 until chunksArray.length()) {
                val item = chunksArray.getJSONObject(i)
                chunksList.add(
                    KnowledgeChunkEntity(
                        id = item.getString("id"),
                        title = item.getString("title"),
                        source = item.getString("source"),
                        grade = item.getString("grade"),
                        text = item.getString("text")
                    )
                )
            }

            withContext(Dispatchers.IO) {
                db.knowledgeDao().clearEntries()
                db.knowledgeChunkDao().clearChunks()
                db.knowledgeDao().insertAll(entriesList)
                db.knowledgeChunkDao().insertAll(chunksList)
            }

            emit(PackDownloadState.Ready(
                entriesCount = entriesList.size,
                chunksCount = chunksList.size,
                version = version
            ))
        } catch (e: Exception) {
            outputStream?.close()
            tempFile.delete()
            emit(PackDownloadState.Error("Сбой при загрузке справочника: ${e.message}"))
        } finally {
            activeCall = null
        }
    }.flowOn(Dispatchers.IO)

    fun cancelActiveDownload() {
        activeCall?.cancel()
        activeCall = null
    }

    private fun calculateSha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(8192)
            var read: Int
            while (input.read(buf).also { read = it } != -1) {
                digest.update(buf, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
