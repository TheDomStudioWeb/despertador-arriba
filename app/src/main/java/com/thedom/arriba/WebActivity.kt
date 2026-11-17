package com.thedom.arriba

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader

/** Base común: una WebView a pantalla completa que carga la interfaz desde los assets de la app. */
abstract class WebActivity : Activity() {

    protected lateinit var web: WebView
    protected lateinit var bridge: Bridge
    private var pendingCamera: PermissionRequest? = null

    abstract val page: String

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this)
        web.setBackgroundColor(Color.BLACK)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (ContextCompat.checkSelfPermission(this@WebActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                    } else {
                        pendingCamera = request
                        requestPermissions(arrayOf(Manifest.permission.CAMERA), 21)
                    }
                }
            }
        }
        bridge = Bridge(this, web)
        web.addJavascriptInterface(bridge, "Android")
        setContentView(web)
        web.loadUrl("https://appassets.androidplatform.net/assets/$page")
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 21) {
            val req = pendingCamera
            pendingCamera = null
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                req?.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
            } else req?.deny()
        }
        web.evaluateJavascript("window.onResumeApp && window.onResumeApp()", null)
    }

    override fun onResume() {
        super.onResume()
        web.evaluateJavascript("window.onResumeApp && window.onResumeApp()", null)
    }

    override fun onDestroy() {
        bridge.release()
        web.destroy()
        super.onDestroy()
    }
}

class MainActivity : WebActivity() {
    override val page = "index.html"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Si hay una alarma sin resolver, se va directo a la misión
        if (Store.ringingId(this) != -1 && !Store.isSnoozed(this)) {
            startActivity(android.content.Intent(this, RingActivity::class.java))
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("window.onBack ? window.onBack() : false") { r ->
            if (r != "true") {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            }
        }
    }
}

/** Pantalla de la alarma: no se puede salir con "atrás"; si se sale con inicio, vuelve sola. */
class RingActivity : WebActivity() {
    companion object { @Volatile var visible = false }
    override val page = "ring.html"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )
        if (android.os.Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        if (Store.ringingId(this) == -1) finish()
    }

    override fun onResume() { super.onResume(); visible = true }
    override fun onPause() { visible = false; super.onPause() }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { /* bloqueado a propósito */ }
}
