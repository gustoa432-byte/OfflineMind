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
        if (freeBytes < 2L * 1024 * 1024 * 1024) {
            emit(DownloadState.Error("Недостаточно места на диске! Доступно: \${freeBytes / 1024 / 1024} МБ"))
            return@flow
        }

        val targetDir = File(context.filesDir, "models")
        if (!targetDir.exists()) targetDir.mkdirs()

        val tempFile = File(targetDir, "$targetFileName.tmp")
        val finalFile = File(targetDir, targetFileName)

        var downloadedSoFar = if (tempFile.exists()) tempFile.length() else 0L

        val request = Request.Builder()
            .url(url)
            .header("Range", "bytes=$downloadedSoFar-")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful && response.code != 206) {
                emit(DownloadState.Error("HTTP ошибка: \${response.code}"))
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

        // Проверка контрольной суммы SHA-256
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
            emit(DownloadState.Error("Контрольная сумма SHA-256 повреждена!"))
            return@flow
        }

        tempFile.renameTo(finalFile)
        emit(DownloadState.Ready)
    }.flowOn(Dispatchers.IO)
}
