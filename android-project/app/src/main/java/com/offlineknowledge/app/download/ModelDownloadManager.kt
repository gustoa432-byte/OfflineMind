package com.offlineknowledge.app.download

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
        if (!dir.exists()) {
            dir.mkdirs()
        }
        return dir
    }

    fun getModelFile(filename: String): File {
        return File(getModelsDirectory(), filename)
    }

    fun getFreeSpaceBytes(): Long {
        val stat = StatFs(context.filesDir.path)
        return stat.availableBytes
    }

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
        val tmp = File(getModelsDirectory(), "$filename.tmp")
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
        val tempFile = File(targetDir, "$targetFileName.tmp")
        val finalFile = File(targetDir, targetFileName)

        if (finalFile.exists() && (expectedBytes <= 0 || finalFile.length() == expectedBytes)) {
            emit(DownloadState.Ready(finalFile))
            return@flow
        }

        // 1. Check disk space
        val freeBytes = getFreeSpaceBytes()
        emit(DownloadState.CheckingSpace(expectedBytes, freeBytes))

        val requiredWithMargin = expectedBytes + (100L * 1024 * 1024) // +100MB margin
        if (freeBytes < requiredWithMargin) {
            emit(DownloadState.Error("Недостаточно места на диске. Доступно: ${freeBytes / 1024 / 1024} МБ, требуется: ${requiredWithMargin / 1024 / 1024} МБ"))
            return@flow
        }

        // 2. Resume support via Range header
        var downloadedSoFar = if (tempFile.exists()) tempFile.length() else 0L
        if (downloadedSoFar >= expectedBytes && expectedBytes > 0) {
            downloadedSoFar = 0L
            tempFile.delete()
        }

        val requestBuilder = Request.Builder().url(url)
        if (downloadedSoFar > 0L) {
            requestBuilder.header("Range", "bytes=$downloadedSoFar-")
        }

        val call = client.newCall(requestBuilder.build())
        activeCall = call

        try {
            call.execute().use { response ->
                if (!response.isSuccessful && response.code != 206) {
                    emit(DownloadState.Error("HTTP ошибка при загрузке модели: ${response.code} ${response.message}"))
                    return@flow
                }

                val appendMode = (response.code == 206 && downloadedSoFar > 0)
                if (!appendMode && downloadedSoFar > 0) {
                    downloadedSoFar = 0L
                    tempFile.delete()
                }

                val body = response.body ?: throw IllegalStateException("Пустой ответ от сервера")
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
                            stepDescription = "Загрузка весов модели (${downloadedSoFar / 1024 / 1024} МБ / ${totalBytes / 1024 / 1024} МБ)"
                        ))
                    }
                }

                outputStream.flush()
                outputStream.close()
            }
        } catch (e: Exception) {
            emit(DownloadState.Error("Прервано: ${e.message}"))
            return@flow
        } finally {
            activeCall = null
        }

        // 3. Verify SHA-256
        emit(DownloadState.VerifyingChecksum(expectedSha256))
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
            emit(DownloadState.Error("Ошибка проверки целостности: хэш SHA-256 не совпал. Ожидался: $expectedSha256, получен: $actualSha256"))
            return@flow
        }

        // 4. Atomic commit to final storage
        if (finalFile.exists()) {
            finalFile.delete()
        }
        if (!tempFile.renameTo(finalFile)) {
            tempFile.copyTo(finalFile, overwrite = true)
            tempFile.delete()
        }

        emit(DownloadState.Ready(finalFile))
    }.flowOn(Dispatchers.IO)
}
