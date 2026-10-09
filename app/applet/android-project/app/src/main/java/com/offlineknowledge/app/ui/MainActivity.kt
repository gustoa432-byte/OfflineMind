package com.offlineknowledge.app.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.offlineknowledge.app.repository.OfflineMindRepository

class MainActivity : ComponentActivity() {

    private lateinit var repository: OfflineMindRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        repository = OfflineMindRepository(applicationContext)

        val darkColors = darkColorScheme(
            primary = Color(0xFF38BDF8),
            onPrimary = Color(0xFF0F172A),
            primaryContainer = Color(0xFF0369A1),
            onPrimaryContainer = Color(0xFFE0F2FE),
            surface = Color(0xFF0F172A),
            onSurface = Color(0xFFF1F5F9),
            surfaceVariant = Color(0xFF1E293B),
            onSurfaceVariant = Color(0xFF94A3B8),
            background = Color(0xFF0B1120),
            onBackground = Color(0xFFF1F5F9)
        )

        setContent {
            MaterialTheme(colorScheme = darkColors) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    OfflineMindApp(repository = repository)
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        repository.unloadModel()
    }
}
