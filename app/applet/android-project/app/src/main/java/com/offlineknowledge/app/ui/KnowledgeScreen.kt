package com.offlineknowledge.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.offlineknowledge.app.data.KnowledgeEntity
import com.offlineknowledge.app.repository.OfflineMindRepository

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KnowledgeScreen(
    repository: OfflineMindRepository,
    onSelectQuestion: (String) -> Unit
) {
    val entries by repository.getKnowledgeCategories().collectAsState(initial = emptyList())
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("all") }

    val categories = remember(entries) {
        listOf("all" to "Все") + entries.map { it.category to it.categoryRu }.distinct()
    }

    val filteredEntries = remember(entries, searchQuery, selectedCategory) {
        entries.filter { entry ->
            val matchesCat = selectedCategory == "all" || entry.category == selectedCategory
            val matchesQuery = searchQuery.isBlank() ||
                    entry.canonicalTitle.contains(searchQuery, ignoreCase = true) ||
                    entry.definition.contains(searchQuery, ignoreCase = true) ||
                    entry.keywordsJson.contains(searchQuery, ignoreCase = true)
            matchesCat && matchesQuery
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Локальный справочник", fontWeight = FontWeight.Bold, fontSize = 18.sp) }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Поиск по понятиям и терминам...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Clear, contentDescription = "Очистить")
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                shape = RoundedCornerShape(16.dp)
            )

            // Category Chips
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(bottom = 8.dp)
            ) {
                items(categories) { (catId, catTitle) ->
                    FilterChip(
                        selected = selectedCategory == catId,
                        onClick = { selectedCategory = catId },
                        label = { Text(catTitle, fontSize = 12.sp) }
                    )
                }
            }

            // Entries List
            if (filteredEntries.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Ничего не найдено в справочнике",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredEntries, key = { it.id }) { item ->
                        KnowledgeCard(
                            entity = item,
                            onAskQuestion = { onSelectQuestion("Объясни подробно понятие: ${item.canonicalTitle}") }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun KnowledgeCard(
    entity: KnowledgeEntity,
    onAskQuestion: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = entity.canonicalTitle,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = entity.categoryRu,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(Modifier.height(8.dp))

            Text(
                text = entity.definition,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            if (!entity.formulasJson.isNullOrBlank() && entity.formulasJson != "[]") {
                Spacer(Modifier.height(8.dp))
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surface,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        Text(
                            text = "Формулы и правила:",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = entity.formulasJson.replace("[\"", "").replace("\"]", "").replace("\",\"", "\n"),
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }

            if (entity.doNotConfuseTerm != null) {
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFDC2626).copy(alpha = 0.1f))
                        .padding(8.dp)
                ) {
                    Icon(
                        Icons.Default.Info,
                        contentDescription = null,
                        tint = Color(0xFFDC2626),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "Не путать с: ${entity.doNotConfuseTerm} — ${entity.doNotConfuseDifference}",
                        fontSize = 11.sp,
                        color = Color(0xFFDC2626)
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            OutlinedButton(
                onClick = onAskQuestion,
                modifier = Modifier.align(Alignment.End),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Default.Chat, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Объяснить нейросетью", fontSize = 12.sp)
            }
        }
    }
}
