package com.offlineknowledge.app.ui

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.offlineknowledge.app.repository.ModelRuntimeState
import com.offlineknowledge.app.repository.ModelSpec
import com.offlineknowledge.app.repository.OfflineMindRepository
import com.offlineknowledge.app.repository.SUPPORTED_MODELS
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelSettingsScreen(
    repository: OfflineMindRepository,
    onTestQueryRequested: (String) -> Unit
) {
    val scope = rememberCoroutineScope()
    val runtimeState by repository.runtimeState.collectAsState()
    val activeModel by repository.selectedModel.collectAsState()
    val freeSpaceMb = remember { repository.downloadManager.getFreeSpaceBytes() / (1024 * 1024) }

    var testQueryResult by remember { mutableStateOf<String?>(null) }
    var isTestingQuery by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Параметры и движок модели", fontWeight = FontWeight.Bold, fontSize = 18.sp) }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Target Device Hardware Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Smartphone, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "Целевое устройство",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(Modifier.height(12.dp))
                        DeviceInfoRow("Модель", "HONOR NIC-LX1")
                        DeviceInfoRow("ОС", "Android 15 (MagicOS 9.0)")
                        DeviceInfoRow("Процессор (SoC)", "MediaTek Helio G81 Ultra")
                        DeviceInfoRow("Архитектура", "ARM64-v8a (ARM Cortex-A75 / A55)")
                        DeviceInfoRow("Физическая RAM", "6.0 ГБ (LPDDR4X)")
                        DeviceInfoRow("Свободно во внутреннем хранилище", "$freeSpaceMb МБ")
                    }
                }
            }

            // Model Selection Section
            item {
                Text(
                    "Выбор модели (формат GGUF Q4_K_M)",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            items(SUPPORTED_MODELS.size) { index ->
                val model = SUPPORTED_MODELS[index]
                ModelSelectionCard(
                    spec = model,
                    isSelected = model.id == activeModel.id,
                    onSelect = { repository.selectModel(model) }
                )
            }

            // Current Model Status Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = when (runtimeState) {
                            is ModelRuntimeState.Ready -> Color(0xFF10B981).copy(alpha = 0.1f)
                            is ModelRuntimeState.Error -> Color(0xFFEF4444).copy(alpha = 0.1f)
                            else -> MaterialTheme.colorScheme.surfaceVariant
                        }
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    when (runtimeState) {
                                        is ModelRuntimeState.Ready -> Icons.Default.CheckCircle
                                        is ModelRuntimeState.Error -> Icons.Default.Error
                                        is ModelRuntimeState.Downloading -> Icons.Default.Download
                                        is ModelRuntimeState.Verifying -> Icons.Default.Verified
                                        else -> Icons.Default.DownloadForOffline
                                    },
                                    contentDescription = null,
                                    tint = when (runtimeState) {
                                        is ModelRuntimeState.Ready -> Color(0xFF10B981)
                                        is ModelRuntimeState.Error -> Color(0xFFEF4444)
                                        else -> MaterialTheme.colorScheme.primary
                                    }
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    when (runtimeState) {
                                        is ModelRuntimeState.Ready -> "Модель готова к офлайн-работе"
                                        is ModelRuntimeState.Error -> "Ошибка"
                                        is ModelRuntimeState.Downloading -> "Загрузка модели по HTTPS"
                                        is ModelRuntimeState.Verifying -> "Проверка SHA-256"
                                        else -> "Модель не установлена"
                                    },
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp
                                )
                            }
                        }

                        Spacer(Modifier.height(8.dp))

                        when (val state = runtimeState) {
                            is ModelRuntimeState.NotInstalled -> {
                                Text(
                                    "Файл модели отсутствует во внутреннем каталоге приложения. Требуется загрузка файла весов (${activeModel.sizeFormatted}) по HTTPS.",
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(Modifier.height(12.dp))
                                Button(
                                    onClick = {
                                        scope.launch {
                                            repository.startModelDownload().collect {}
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Default.Download, contentDescription = null)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Скачать модель (${activeModel.sizeFormatted})")
                                }
                            }

                            is ModelRuntimeState.Downloading -> {
                                val p = state.progress
                                LinearProgressIndicator(
                                    progress = { p.percent / 100f },
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Spacer(Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        "${p.percent}% (${p.downloadedBytes / 1024 / 1024} МБ / ${p.totalBytes / 1024 / 1024} МБ)",
                                        fontSize = 12.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Text(
                                        "${(p.speedBytesPerSec / 1024 / 1024.0).let { String.format(\"%.1f\", it) }} МБ/с",
                                        fontSize = 12.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    "Поддержка возобновления HTTP Range активна. Оставшееся время: ~${p.timeRemainingSec} с.",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(Modifier.height(12.dp))
                                OutlinedButton(
                                    onClick = { repository.cancelDownload() },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Default.Pause, contentDescription = null)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Приостановить загрузку")
                                }
                            }

                            is ModelRuntimeState.Verifying -> {
                                CircularProgressIndicator(modifier = Modifier.size(24.dp))
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    "Вычисление и сверка SHA-256 хэша (${state.expectedSha256.take(16)}...)",
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }

                            is ModelRuntimeState.Ready -> {
                                Text(
                                    "Файл проверен и загружен в приватное хранилище.\nSHA-256: ${activeModel.sha256}",
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(Modifier.height(6.dp))
                                Text(
                                    "Статус в RAM: ${if (state.isLoadedInRam) \"Загружена (${state.memoryRssMb} МБ)\" else \"Выгружена\"}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                Spacer(Modifier.height(12.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    if (state.isLoadedInRam) {
                                        OutlinedButton(
                                            onClick = { repository.unloadModel() },
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Text("Выгрузить из ОЗУ", fontSize = 11.sp)
                                        }
                                    } else {
                                        Button(
                                            onClick = { repository.loadModel() },
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Text("Загрузить в ОЗУ", fontSize = 11.sp)
                                        }
                                    }

                                    OutlinedButton(
                                        onClick = { repository.deleteModel() },
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(4.dp))
                                        Text("Удалить файл", fontSize = 11.sp)
                                    }
                                }

                                Spacer(Modifier.height(12.dp))

                                // Step 9: Local test query button
                                FilledTonalButton(
                                    onClick = {
                                        isTestingQuery = true
                                        testQueryResult = null
                                        scope.launch {
                                            try {
                                                val testPrompt = "В одном дециметре ровно "
                                                var ans = ""
                                                repository.answerQuestion(testPrompt).collect { (c, _) ->
                                                    ans = c.fullText
                                                }
                                                testQueryResult = ans
                                            } catch (e: Exception) {
                                                testQueryResult = "Ошибка: ${e.message}"
                                            } finally {
                                                isTestingQuery = false
                                            }
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth(),
                                    enabled = !isTestingQuery
                                ) {
                                    Icon(Icons.Default.PlayArrow, contentDescription = null)
                                    Spacer(Modifier.width(6.dp))
                                    Text(if (isTestingQuery) "Выполняется тест на устройстве..." else "Запустить локальный тестовый запрос")
                                }

                                if (testQueryResult != null) {
                                    Spacer(Modifier.height(8.dp))
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = MaterialTheme.colorScheme.surface,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Column(modifier = Modifier.padding(10.dp)) {
                                            Text("Результат локального теста:", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            Text(testQueryResult!!, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
                                        }
                                    }
                                }
                            }

                            is ModelRuntimeState.Error -> {
                                Text(
                                    state.message,
                                    fontSize = 13.sp,
                                    color = MaterialTheme.colorScheme.error
                                )
                                Spacer(Modifier.height(12.dp))
                                Button(
                                    onClick = {
                                        scope.launch {
                                            repository.startModelDownload().collect {}
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Повторить загрузку")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DeviceInfoRow(title: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(title, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
fun ModelSelectionCard(
    spec: ModelSpec,
    isSelected: Boolean,
    onSelect: () -> Unit
) {
    Card(
        onClick = onSelect,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = isSelected, onClick = onSelect)
                    Spacer(Modifier.width(6.dp))
                    Text(
                        spec.name,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surface
                ) {
                    Text(
                        spec.sizeFormatted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(
                spec.description,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 36.dp)
            )
        }
    }
}
