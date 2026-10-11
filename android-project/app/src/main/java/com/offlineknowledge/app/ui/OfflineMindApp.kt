package com.offlineknowledge.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.offlineknowledge.app.repository.OfflineMindRepository

enum class NavigationTab(val title: String) {
    CHAT("Чат"),
    MODEL("Модель"),
    PACK("Справочник"),
    HISTORY("История")
}

@Composable
fun OfflineMindApp(
    repository: OfflineMindRepository
) {
    var selectedTab by remember { mutableStateOf(NavigationTab.CHAT) }
    var prefilledQuestion by remember { mutableStateOf<String?>(null) }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == NavigationTab.CHAT,
                    onClick = { selectedTab = NavigationTab.CHAT },
                    icon = { Icon(Icons.Default.ChatBubble, contentDescription = "Чат") },
                    label = { Text("Чат") }
                )
                NavigationBarItem(
                    selected = selectedTab == NavigationTab.MODEL,
                    onClick = { selectedTab = NavigationTab.MODEL },
                    icon = { Icon(Icons.Default.Memory, contentDescription = "Модель") },
                    label = { Text("Модель") }
                )
                NavigationBarItem(
                    selected = selectedTab == NavigationTab.PACK,
                    onClick = { selectedTab = NavigationTab.PACK },
                    icon = { Icon(Icons.Default.MenuBook, contentDescription = "Справочник") },
                    label = { Text("Справочник") }
                )
                NavigationBarItem(
                    selected = selectedTab == NavigationTab.HISTORY,
                    onClick = { selectedTab = NavigationTab.HISTORY },
                    icon = { Icon(Icons.Default.History, contentDescription = "История") },
                    label = { Text("История") }
                )
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (selectedTab) {
                NavigationTab.CHAT -> {
                    ChatScreen(
                        repository = repository,
                        onNavigateToModelSettings = { selectedTab = NavigationTab.MODEL },
                        onNavigateToKnowledgePack = { selectedTab = NavigationTab.PACK }
                    )
                }

                NavigationTab.MODEL -> {
                    ModelSettingsScreen(
                        repository = repository,
                        onTestQueryRequested = { q ->
                            prefilledQuestion = q
                            selectedTab = NavigationTab.CHAT
                        }
                    )
                }

                NavigationTab.PACK -> {
                    KnowledgePackScreen(
                        repository = repository,
                        onSelectQuestion = { q ->
                            prefilledQuestion = q
                            selectedTab = NavigationTab.CHAT
                        }
                    )
                }

                NavigationTab.HISTORY -> {
                    HistoryScreen(
                        repository = repository,
                        onSelectQuestion = { q ->
                            prefilledQuestion = q
                            selectedTab = NavigationTab.CHAT
                        }
                    )
                }
            }
        }
    }
}
