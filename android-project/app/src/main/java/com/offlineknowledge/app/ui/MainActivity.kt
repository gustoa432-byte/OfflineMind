package com.offlineknowledge.app.ui

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.lifecycleScope
import com.offlineknowledge.app.bridge.OfflineMindBridge

class MainActivity : ComponentActivity() {

    private var webView: WebView? = null
    private var bridge: OfflineMindBridge? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { ctx ->
                            WebView(ctx).apply {
                                layoutParams = ViewGroup.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT
                                )
                                settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    databaseEnabled = true
                                    allowFileAccess = true
                                    allowContentAccess = true
                                    cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                                }

                                val nativeBridge = OfflineMindBridge(ctx, this, lifecycleScope)
                                bridge = nativeBridge
                                addJavascriptInterface(nativeBridge, "OfflineMindNative")

                                webViewClient = object : WebViewClient() {}
                                webView = this

                                // Try to load local assets if packaged, otherwise local host or cached URL
                                val assetUrl = "file:///android_asset/dist/index.html"
                                loadUrl(assetUrl)
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        bridge?.unloadModel()
        webView?.destroy()
        webView = null
    }
}
