package com.offlineknowledge.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.offlineknowledge.app.data.HistoryEntity
import com.offlineknowledge.app.repository.OfflineMindRepository
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(
    repository: OfflineMindRepository,
    onSelectQuestion: (String) -> Unit
) {
    val scope = rememberCoroutineScope()
    var selectedTab by remember { mutableIntStateOf(0) }

    val historyList by repository.getHistory().collectAsState(initial = emptyList())
    val favoritesList by repository.getFavorites().collectAsState(initial = emptyList())

    val displayedItems = if (selectedTab == 0) historyList else favoritesList

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("История и избранное", fontWeight = FontWeight.Bold, fontSize = 18.sp) },
                actions = {
                    if (selectedTab == 0 && historyList.isNotEmpty()) {
                        IconButton(onClick = { scope.launch { repository.clearHistory() } }) {
                            Icon(Icons.Outlined.Delete, contentDescription = "Очистить историю")
                        }
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            TabRow(selectedTabIndex = selectedTab) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("История (${historyList.size})") }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("Избранное (${favoritesList.size})") }
                )
            }

            if (displayedItems.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        if (selectedTab == 0) "История запросов пуста" else "Нет сохранённых в избранное ответов",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(displayedItems, key = { it.id }) { item ->
                        HistoryCard(
                            entity = item,
                            onToggleFavorite = {
                                scope.launch { repository.setFavorite(item.id, !item.isFavorite) }
                            },
                            onDelete = {
                                scope.launch { repository.deleteHistory(item.id) }
                            },
                            onAskAgain = { onSelectQuestion(item.query) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun HistoryCard(
    entity: HistoryEntity,
    onToggleFavorite: () -> Unit,
    onDelete: () -> Unit,
    onAskAgain: () -> Unit
) {
    val dateFormatted = remember(entity.timestamp) {
        val sdf = SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault())
        sdf.format(Date(entity.timestamp))
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = dateFormatted,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Row {
                    IconButton(onClick = onToggleFavorite, modifier = Modifier.size(28.dp)) {
                        Icon(
                            if (entity.isFavorite) Icons.Default.Bookmark else Icons.Outlined.BookmarkBorder,
                            contentDescription = "Избранное",
                            tint = if (entity.isFavorite) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Удалить",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            Spacer(Modifier.height(4.dp))

            Text(
                text = entity.query,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(Modifier.height(6.dp))

            Text(
                text = entity.answerText,
                fontSize = 13.sp,
                lineHeight = 18.sp,
                maxLines = 3,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "TTFT: ${entity.ttftMs} мс • ${entity.tokensPerSec} токенов/с",
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                TextButton(onClick = onAskAgain) {
                    Text("Задать снова", fontSize = 12.sp)
                }
            }
        }
    }
}
