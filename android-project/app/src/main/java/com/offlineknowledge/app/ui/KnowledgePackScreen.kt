package com.offlineknowledge.app.ui

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.offlineknowledge.app.data.KnowledgeEntity
import com.offlineknowledge.app.download.PackDownloadState
import com.offlineknowledge.app.repository.OfflineMindRepository
import com.offlineknowledge.app.repository.PackRuntimeState
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KnowledgePackScreen(
    repository: OfflineMindRepository,
    onSelectQuestion: (String) -> Unit
) {
    val scope = rememberCoroutineScope()
    val packState by repository.packState.collectAsState()
    val manifest by repository.packManifest.collectAsState()
    val entries by repository.getKnowledgeCategories().collectAsState(initial = emptyList())

    var isDeleting by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Справочник знаний (Knowledge Pack)", fontWeight = FontWeight.Bold, fontSize = 18.sp) }
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
            // Status Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = when (packState) {
                            is PackRuntimeState.Ready -> Color(0xFF10B981).copy(alpha = 0.1f)
                            is PackRuntimeState.Downloading, is PackRuntimeState.Verifying, is PackRuntimeState.Importing -> Color(0xFF0284C7).copy(alpha = 0.1f)
                            is PackRuntimeState.Error -> Color(0xFFEF4444).copy(alpha = 0.1f)
                            else -> MaterialTheme.colorScheme.surfaceVariant
                        }
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.MenuBook,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(28.dp)
                                )
                                Spacer(Modifier.width(10.dp))
                                Column {
                                    Text(
                                        "Knowledge Pack v${manifest.version}",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 16.sp
                                    )
                                    Text(
                                        "Файл: ${manifest.filename} • ${(manifest.sizeBytes / 1024).toInt()} КБ",
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            when (packState) {
                                is PackRuntimeState.Ready -> {
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = Color(0xFF10B981).copy(alpha = 0.2f),
                                        contentColor = Color(0xFF10B981)
                                    ) {
                                        Text(
                                            "Установлен",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                                is PackRuntimeState.NotInstalled -> {
                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = Color(0xFFF59E0B).copy(alpha = 0.2f),
                                        contentColor = Color(0xFFF59E0B)
                                    ) {
                                        Text(
                                            "Не загружен",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                                else -> {}
                            }
                        }

                        Spacer(Modifier.height(12.dp))

                        Text(
                            text = "Справочник не вшит в APK и скачивается отдельно. Включает 18 проверенных математических понятий и ${manifest.chunksCount} учебных фрагментов (6–11 классы dive-math-ru).",
                            fontSize = 13.sp,
                            lineHeight = 18.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Spacer(Modifier.height(14.dp))

                        when (val state = packState) {
                            is PackRuntimeState.Downloading -> {
                                Column {
                                    LinearProgressIndicator(
                                        progress = { state.progress.percent / 100f },
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    Spacer(Modifier.height(6.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(state.progress.stepDescription, fontSize = 11.sp)
                                        Text("${state.progress.percent}%", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    OutlinedButton(
                                        onClick = { repository.cancelPackDownload() },
                                        modifier = Modifier.align(Alignment.End)
                                    ) {
                                        Text("Отмена")
                                    }
                                }
                            }

                            is PackRuntimeState.Verifying -> {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Проверка SHA-256...", fontSize = 12.sp)
                                }
                            }

                            is PackRuntimeState.Importing -> {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Импорт записей в локальную базу Room...", fontSize = 12.sp)
                                }
                            }

                            is PackRuntimeState.Ready -> {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "Импортировано: ${state.entriesCount} тем • ${state.chunksCount} глав",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color(0xFF10B981)
                                    )

                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        OutlinedButton(
                                            onClick = {
                                                scope.launch {
                                                    isDeleting = true
                                                    repository.deletePack()
                                                    isDeleting = false
                                                }
                                            },
                                            enabled = !isDeleting,
                                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                                        ) {
                                            Icon(Icons.Outlined.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text("Удалить")
                                        }

                                        Button(
                                            onClick = {
                                                scope.launch {
                                                    repository.startPackDownload().collect {}
                                                }
                                            }
                                        ) {
                                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text("Обновить")
                                        }
                                    }
                                }
                            }

                            is PackRuntimeState.NotInstalled -> {
                                Button(
                                    onClick = {
                                        scope.launch {
                                            repository.startPackDownload().collect {}
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Default.Download, contentDescription = null)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Скачать справочник v${manifest.version}")
                                }
                            }

                            is PackRuntimeState.Error -> {
                                Column {
                                    Text(
                                        "Ошибка: ${state.message}",
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.error
                                    )
                                    Spacer(Modifier.height(8.dp))
                                    Button(
                                        onClick = {
                                            scope.launch {
                                                repository.startPackDownload().collect {}
                                            }
                                        }
                                    ) {
                                        Text("Повторить загрузку")
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // SHA-256 info card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("Контрольная сумма SHA-256", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = manifest.sha256,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = "Дата сборки pack: ${manifest.updatedAt} • Локаль: ru",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Entries List preview
            if (entries.isNotEmpty()) {
                item {
                    Text(
                        "Записи в локальной базе (${entries.size}):",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }

                items(entries) { entry ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    entry.canonicalTitle,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 14.sp
                                )
                                Text(
                                    entry.categoryRu,
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                entry.definition,
                                fontSize = 12.sp,
                                maxLines = 2,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.height(6.dp))
                            TextButton(
                                onClick = { onSelectQuestion("Объясни понятие: ${entry.canonicalTitle}") },
                                contentPadding = PaddingValues(0.dp)
                            ) {
                                Text("Спросить у модели →", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
