package com.nuclearplayer

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ActivityInfo
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {

    override val handleBackNavigation: Boolean = false
    private var webViewRef: WebView? = null

    companion object {
        var instance: MainActivity? = null
        var isMediaActive: Boolean = false
        var isMediaPlaying: Boolean = false

        fun dispatchActionToNuclear(action: String) {
            instance?.runOnUiThread {
                instance?.let { activity ->
                    val js = "window.dispatchEvent(new CustomEvent('nuclear:hyperisland:action', { detail: { action: '$action' } }));"
                    val wv = activity.webViewRef ?: activity.findWebView()
                    wv?.evaluateJavascript(js, null)
                }
            }
        }
    }

    override fun shouldPauseWebView(): Boolean {
        return !(isMediaActive || isMediaPlaying)
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        webViewRef = webView
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.domStorageEnabled = true
        webView.settings.javaScriptEnabled = true
        webView.addJavascriptInterface(NuclearBridge(), "NuclearAndroid")
    }

    fun forceWebViewGC() {
        // No-op: previously called freeMemory() and System.gc() which provoked native memory corruption
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        androidx.lifecycle.ProcessLifecycleOwner.get().lifecycle.removeObserver(WryLifecycleObserver)
        instance = this

        requestNotificationPermission()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val wv = webViewRef ?: findWebView()
                if (wv != null) {
                    wv.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('nuclear:android:back'));",
                        null
                    )
                } else {
                    moveTaskToBack(true)
                }
            }
        })

        window.decorView.post {
            setupBridge()
        }
    }

    fun keepWebViewActive() {
        val action = Runnable {
            val wv = webViewRef ?: findWebView()
            if (wv != null) {
                wv.onResume()
                wv.resumeTimers()
            }
        }
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            action.run()
        } else {
            runOnUiThread(action)
        }
    }

    override fun onPause() {
        super.onPause()
        if (isMediaActive || isMediaPlaying) {
            keepWebViewActive()
        }
    }

    override fun onResume() {
        super.onResume()
        keepWebViewActive()
    }

    override fun onStop() {
        super.onStop()
        if (isMediaActive || isMediaPlaying) {
            keepWebViewActive()
        }
    }

    override fun onStart() {
        super.onStart()
        keepWebViewActive()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (isMediaActive || isMediaPlaying) {
            keepWebViewActive()
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (isMediaActive || isMediaPlaying) {
            keepWebViewActive()
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            val wv = webViewRef ?: findWebView()
            if (wv != null) {
                wv.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('nuclear:android:back'));",
                    null
                )
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }
    }

    fun findWebView(): WebView? {
        return findWebViewInView(window.decorView)
    }

    private fun findWebViewInView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                val child = findWebViewInView(view.getChildAt(i))
                if (child != null) return child
            }
        }
        return null
    }

    private fun setupBridge() {
        findWebView()?.addJavascriptInterface(NuclearBridge(), "NuclearAndroid")
    }

    inner class NuclearBridge {
        @JavascriptInterface
        fun updatePlayback(
            title: String,
            artist: String,
            coverUrl: String,
            isPlaying: Boolean,
            positionMs: Long,
            durationMs: Long
        ) {
            isMediaActive = true
            isMediaPlaying = isPlaying
            runOnUiThread {
                try {
                    val intent = Intent(this@MainActivity, NuclearMediaService::class.java).apply {
                        putExtra("title", title)
                        putExtra("artist", artist)
                        putExtra("coverUrl", coverUrl)
                        putExtra("isPlaying", isPlaying)
                        putExtra("positionMs", positionMs)
                        putExtra("durationMs", durationMs)
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(intent)
                    } else {
                        startService(intent)
                    }
                } catch (_: Exception) {
                }
            }
        }

        @JavascriptInterface
        fun forceGC() {
            forceWebViewGC()
        }

        @JavascriptInterface
        fun isHyperOS(): Boolean {
            return HyperIslandNotificationManager.isHyperOS()
        }

        @JavascriptInterface
        fun isHyperIslandSupported(): Boolean {
            return HyperIslandNotificationManager.isHyperIslandSupported(this@MainActivity)
        }

        @JavascriptInterface
        fun minimizeApp() {
            runOnUiThread {
                moveTaskToBack(true)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) {
            instance = null
            isMediaActive = false
            isMediaPlaying = false
        }
    }
}
