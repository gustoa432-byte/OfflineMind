package com.offlineknowledge.app.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.offlineknowledge.app.repository.OfflineMindRepository

sealed class Screen(val route: String, val title: String, val selectedIcon: ImageVector, val unselectedIcon: ImageVector) {
    object Chat : Screen("chat", "Чат", Icons.Default.Chat, Icons.Outlined.Chat)
    object Knowledge : Screen("knowledge", "Справочник", Icons.Default.MenuBook, Icons.Outlined.MenuBook)
    object History : Screen("history", "История", Icons.Default.History, Icons.Outlined.History)
    object ModelSettings : Screen("model", "Модель", Icons.Default.Memory, Icons.Outlined.Memory)
}

val NAV_ITEMS = listOf(Screen.Chat, Screen.Knowledge, Screen.History, Screen.ModelSettings)

@Composable
fun OfflineMindApp(repository: OfflineMindRepository) {
    var currentScreen by remember { mutableStateOf<Screen>(Screen.Chat) }
    var initialQuestionForChat by remember { mutableStateOf<String?>(null) }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NAV_ITEMS.forEach { screen ->
                    val isSelected = currentScreen.route == screen.route
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { currentScreen = screen },
                        icon = {
                            Icon(
                                if (isSelected) screen.selectedIcon else screen.unselectedIcon,
                                contentDescription = screen.title
                            )
                        },
                        label = { Text(screen.title) }
                    )
                }
            }
        }
    ) { padding ->
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            color = MaterialTheme.colorScheme.background
        ) {
            when (currentScreen) {
                is Screen.Chat -> {
                    ChatScreen(
                        repository = repository,
                        onNavigateToModelSettings = { currentScreen = Screen.ModelSettings }
                    )
                }
                is Screen.Knowledge -> {
                    KnowledgeScreen(
                        repository = repository,
                        onSelectQuestion = { q ->
                            currentScreen = Screen.Chat
                        }
                    )
                }
                is Screen.History -> {
                    HistoryScreen(
                        repository = repository,
                        onSelectQuestion = { q ->
                            currentScreen = Screen.Chat
                        }
                    )
                }
                is Screen.ModelSettings -> {
                    ModelSettingsScreen(
                        repository = repository,
                        onTestQueryRequested = { q ->
                            currentScreen = Screen.Chat
                        }
                    )
                }
            }
        }
    }
}
