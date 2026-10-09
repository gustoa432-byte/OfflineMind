package com.offlineknowledge.app.ui

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.offlineknowledge.app.data.KnowledgeEntity
import com.offlineknowledge.app.engine.GenerationMetrics
import com.offlineknowledge.app.repository.ModelRuntimeState
import com.offlineknowledge.app.repository.OfflineMindRepository
import kotlinx.coroutines.launch

data class ChatMessage(
    val id: String = java.util.UUID.randomUUID().toString(),
    val isUser: Boolean,
    val text: String,
    val matchedEntry: KnowledgeEntity? = null,
    val metrics: GenerationMetrics? = null,
    val isStreaming: Boolean = false
)

val QUICK_SUGGESTIONS = listOf(
    "Чем площадь отличается от периметра?",
    "Сколько метров в дециметре?",
    "Что такое сотка и сколько в ней кв. метров?",
    "Чем акр отличается от гектара?",
    "Как называется число, которое делят?",
    "Какова плотность воды и формула плотности?"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    repository: OfflineMindRepository,
    onNavigateToModelSettings: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    val clipboardManager = LocalClipboardManager.current

    val runtimeState by repository.runtimeState.collectAsState()
    val activeModel by repository.selectedModel.collectAsState()

    var inputText by remember { mutableStateOf("") }
    var isGenerating by remember { mutableStateOf(false) }
    val messages = remember { mutableStateListOf<ChatMessage>() }

    val isModelReady = runtimeState is ModelRuntimeState.Ready

    // Function to submit a question
    val submitQuestion = { question: String ->
        val q = question.trim()
        if (q.isNotBlank() && !isGenerating) {
            messages.add(ChatMessage(isUser = true, text = q))
            val assistantMsgIndex = messages.size
            messages.add(
                ChatMessage(
                    isUser = false,
                    text = "",
                    isStreaming = true
                )
            )

            isGenerating = true
            inputText = ""

            scope.launch {
                listState.animateScrollToItem(messages.size - 1)
                try {
                    repository.answerQuestion(q).collect { (chunk, entry) ->
                        if (assistantMsgIndex < messages.size) {
                            messages[assistantMsgIndex] = ChatMessage(
                                isUser = false,
                                text = chunk.fullText,
                                matchedEntry = entry,
                                metrics = chunk.metrics,
                                isStreaming = !chunk.metrics.isComplete
                            )
                        }
                        listState.animateScrollToItem(messages.size - 1)
                    }
                } catch (e: Exception) {
                    if (assistantMsgIndex < messages.size) {
                        messages[assistantMsgIndex] = ChatMessage(
                            isUser = false,
                            text = "Ошибка инференса: ${e.message}\nПроверьте состояние модели во вкладке «Модель».",
                            isStreaming = false
                        )
                    }
                } finally {
                    isGenerating = false
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "OfflineMind",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp
                            )
                            Spacer(Modifier.width(8.dp))
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isModelReady) Color(0xFF10B981).copy(alpha = 0.2f) else Color(0xFFF59E0B).copy(alpha = 0.2f),
                                contentColor = if (isModelReady) Color(0xFF10B981) else Color(0xFFF59E0B)
                            ) {
                                Text(
                                    text = if (isModelReady) "100% Офлайн" else "Требуется модель",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            text = "${activeModel.name} • MediaTek Helio G81 Ultra",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onNavigateToModelSettings) {
                        Icon(Icons.Default.Memory, contentDescription = "Параметры модели")
                    }
                }
            )
        },
        bottomBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(8.dp)
            ) {
                // Quick suggestions if chat is empty or between queries
                if (messages.isEmpty() && isModelReady) {
                    Text(
                        "Популярные вопросы из справочника:",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 8.dp, bottom = 4.dp)
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(bottom = 8.dp)
                    ) {
                        items(QUICK_SUGGESTIONS) { suggestion ->
                            ActionChip(
                                label = suggestion,
                                onClick = { submitQuestion(suggestion) }
                            )
                        }
                    }
                }

                // Input bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = {
                            Text(if (isModelReady) "Задайте вопрос по математике или физике..." else "Сначала установите модель...")
                        },
                        enabled = isModelReady && !isGenerating,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(24.dp),
                        colors = TextFieldDefaults.colors(
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent,
                            disabledIndicatorColor = Color.Transparent
                        ),
                        maxLines = 3
                    )

                    Spacer(Modifier.width(8.dp))

                    if (isGenerating) {
                        FilledIconButton(
                            onClick = { repository.stopInference() },
                            colors = IconButtonDefaults.filledIconButtonColors(containerColor = MaterialTheme.colorScheme.error)
                        ) {
                            Icon(Icons.Default.Stop, contentDescription = "Остановить")
                        }
                    } else {
                        FilledIconButton(
                            onClick = { submitQuestion(inputText) },
                            enabled = isModelReady && inputText.isNotBlank()
                        ) {
                            Icon(Icons.Default.Send, contentDescription = "Отправить")
                        }
                    }
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (!isModelReady) {
                // Banner warning user to install model
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                        .align(Alignment.Center),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.DownloadForOffline,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "Модель не установлена",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Для автономной работы без интернета требуется однократная загрузка файла модели ${activeModel.name} (${activeModel.sizeFormatted}) с проверкой SHA-256.",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            lineHeight = 18.sp
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = onNavigateToModelSettings) {
                            Icon(Icons.Default.Download, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Перейти к установке")
                        }
                    }
                }
            } else if (messages.isEmpty()) {
                // Empty state greeting
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        Icons.Default.Science,
                        contentDescription = null,
                        modifier = Modifier.size(56.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(Modifier.height(16.dp))
                    Text(
                        "Офлайн-справочник готов",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Все вычисления и поиск выполняются локально на чипе MediaTek Helio G81 Ultra (6 ГБ RAM). Интернет полностью отключён.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 18.sp
                    )
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    items(messages, key = { it.id }) { msg ->
                        ChatMessageItem(
                            message = msg,
                            onCopy = { clipboardManager.setText(AnnotatedString(msg.text)) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun ChatMessageItem(
    message: ChatMessage,
    onCopy: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (message.isUser) Alignment.End else Alignment.Start
    ) {
        if (message.isUser) {
            Surface(
                shape = RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp),
                color = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.widthIn(max = 320.dp)
            ) {
                Text(
                    text = message.text,
                    fontSize = 15.sp,
                    modifier = Modifier.padding(12.dp)
                )
            }
        } else {
            Surface(
                shape = RoundedCornerShape(16.dp, 16.dp, 16.dp, 4.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    // Badge if verified knowledge matched
                    if (message.matchedEntry != null) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color(0xFF0284C7).copy(alpha = 0.15f))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Icon(
                                Icons.Default.Verified,
                                contentDescription = null,
                                tint = Color(0xFF0284C7),
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = "Проверенные данные: ${message.matchedEntry.canonicalTitle}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF0284C7)
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                    }

                    // Answer text
                    Text(
                        text = if (message.text.isBlank() && message.isStreaming) "Обработка запроса на устройстве..." else message.text,
                        fontSize = 14.sp,
                        lineHeight = 21.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    // Generation metrics strip
                    if (message.metrics != null) {
                        Spacer(Modifier.height(10.dp))
                        Divider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                        Spacer(Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "TTFT: ${message.metrics.ttftMs} мс • ${message.metrics.tokensPerSec} токенов/с • RAM: ${message.metrics.memoryRssMb} МБ",
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )

                            IconButton(
                                onClick = onCopy,
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(
                                    Icons.Outlined.ContentCopy,
                                    contentDescription = "Копировать",
                                    modifier = Modifier.size(14.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ActionChip(label: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        contentColor = MaterialTheme.colorScheme.onSurfaceVariant
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}
