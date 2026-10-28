package com.example

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import com.example.ui.theme.MyApplicationTheme
import java.io.File
import java.io.FileOutputStream

class MainActivity : ComponentActivity() {

    private var webView: WebView? = null
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    private val filePickerLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val uris = if (result.resultCode == RESULT_OK && result.data != null) {
                val data = result.data
                val clipData = data?.clipData
                when {
                    clipData != null -> {
                        Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
                    }
                    data?.data != null -> arrayOf(data.data!!)
                    else -> null
                }
            } else {
                null
            }
            fileUploadCallback?.onReceiveValue(uris)
            fileUploadCallback = null
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val wv = webView
                if (wv != null) {
                    wv.evaluateJavascript(
                        "(function(){ if (window.handleAndroidBack) { return window.handleAndroidBack(); } return false; })()"
                    ) { result ->
                        if (result != "true" && result != "\"true\"") {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                            isEnabled = true
                        }
                    }
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        setContent {
            MyApplicationTheme {
                DrawingAppContainer(
                    modifier = Modifier.fillMaxSize(),
                    onWebViewCreated = { wv ->
                        webView = wv
                        setupWebView(wv)
                    }
                )
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(wv: WebView) {
        wv.isVerticalScrollBarEnabled = false
        wv.isHorizontalScrollBarEnabled = false
        wv.overScrollMode = View.OVER_SCROLL_NEVER

        val settings = wv.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        @Suppress("DEPRECATION")
        settings.allowFileAccessFromFileURLs = true
        @Suppress("DEPRECATION")
        settings.allowUniversalAccessFromFileURLs = true
        settings.useWideViewPort = false
        settings.loadWithOverviewMode = false
        settings.textZoom = 100
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        wv.addJavascriptInterface(AndroidBridge(this), "AndroidBridge")

        wv.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                android.util.Log.d("VecturaJS", "${consoleMessage?.message()} -- From line ${consoleMessage?.lineNumber()} of ${consoleMessage?.sourceId()}")
                return true
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                try {
                    filePickerLauncher.launch(intent)
                } catch (e: Exception) {
                    fileUploadCallback = null
                    return false
                }
                return true
            }
        }

        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("file:///android_asset/")) {
                    return false
                }
                // External links or shares open in browser
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                } catch (e: Exception) {
                    // Ignore
                }
                return true
            }

            override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Renderer refreshed. Recovering canvas...", Toast.LENGTH_SHORT).show()
                    view?.loadUrl("file:///android_asset/index.html")
                }
                return true
            }
        }

        wv.loadUrl("file:///android_asset/index.html")
    }

    override fun onPause() {
        super.onPause()
        webView?.evaluateJavascript("window.onAndroidPause?.()", null)
        webView?.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        webView?.evaluateJavascript("window.onAndroidResume?.()", null)
    }

    override fun onDestroy() {
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    inner class AndroidBridge(private val context: Context) {

        private var currentExportTempFile: File? = null
        private var currentExportFileOutputStream: FileOutputStream? = null
        private var currentExportFilename: String = ""
        private var currentExportMimeType: String = ""

        @JavascriptInterface
        fun isAndroid(): Boolean = true

        @JavascriptInterface
        fun hapticTick() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                    vm?.defaultVibrator?.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK))
                } else {
                    @Suppress("DEPRECATION")
                    val v = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        v?.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK))
                    } else {
                        @Suppress("DEPRECATION")
                        v?.vibrate(12L)
                    }
                }
            } catch (e: Exception) {
                // Ignore if permission or vibrator not available
            }
        }

        @JavascriptInterface
        fun vibrate(durationMs: Long) {
            try {
                val dur = durationMs.coerceIn(5L, 500L)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                    vm?.defaultVibrator?.vibrate(VibrationEffect.createOneShot(dur, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    val v = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v?.vibrate(VibrationEffect.createOneShot(dur, VibrationEffect.DEFAULT_AMPLITUDE))
                    } else {
                        @Suppress("DEPRECATION")
                        v?.vibrate(dur)
                    }
                }
            } catch (e: Exception) {
                // Ignore
            }
        }

        @JavascriptInterface
        fun beginFile(filename: String, mimeType: String) {
            try {
                try {
                    currentExportFileOutputStream?.close()
                } catch (_: Exception) {}
                currentExportTempFile?.delete()

                currentExportFilename = sanitizeFilename(filename)
                currentExportMimeType = mimeType

                val tempDir = File(context.cacheDir, "export_temp").apply { if (!exists()) mkdirs() }
                val tempFile = File(tempDir, "export_${System.currentTimeMillis()}.bin")
                currentExportTempFile = tempFile
                currentExportFileOutputStream = FileOutputStream(tempFile)
            } catch (e: Exception) {
                showToast("Export error: ${e.localizedMessage ?: "initialization failed"}")
            }
        }

        @JavascriptInterface
        fun appendChunk(base64Chunk: String) {
            try {
                val fos = currentExportFileOutputStream ?: return
                val cleanChunk = if (base64Chunk.contains(",")) base64Chunk.substringAfter(",") else base64Chunk
                if (cleanChunk.isNotEmpty()) {
                    val bytes = Base64.decode(cleanChunk, Base64.DEFAULT)
                    fos.write(bytes)
                }
            } catch (e: Exception) {
                showToast("Export write error: ${e.localizedMessage ?: "chunk failed"}")
            }
        }

        @JavascriptInterface
        fun finishFile(filename: String, mimeType: String) {
            try {
                try {
                    currentExportFileOutputStream?.flush()
                    currentExportFileOutputStream?.close()
                } catch (_: Exception) {}
                currentExportFileOutputStream = null

                val tempFile = currentExportTempFile
                if (tempFile == null || !tempFile.exists() || tempFile.length() == 0L) {
                    showToast("Export failed: empty file")
                    tempFile?.delete()
                    currentExportTempFile = null
                    return
                }

                val safeName = sanitizeFilename(filename.ifEmpty { currentExportFilename })
                val safeMime = mimeType.ifEmpty { currentExportMimeType.ifEmpty { "image/png" } }

                var mediaStoreSucceeded = false

                // Save to MediaStore Pictures/Vectura without permissions on API 29+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        val contentValues = android.content.ContentValues().apply {
                            put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, safeName)
                            put(android.provider.MediaStore.MediaColumns.MIME_TYPE, safeMime)
                            put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/Vectura")
                            put(android.provider.MediaStore.MediaColumns.IS_PENDING, 1)
                        }
                        val collection = if (safeMime.startsWith("image/")) {
                            android.provider.MediaStore.Images.Media.getContentUri(android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY)
                        } else {
                            android.provider.MediaStore.Downloads.getContentUri(android.provider.MediaStore.VOLUME_EXTERNAL_PRIMARY)
                        }
                        val savedUri = context.contentResolver.insert(collection, contentValues)
                        if (savedUri != null) {
                            var bytesCopied = 0L
                            context.contentResolver.openOutputStream(savedUri)?.use { outStream ->
                                tempFile.inputStream().use { inStream ->
                                    bytesCopied = inStream.copyTo(outStream)
                                }
                            }
                            contentValues.clear()
                            contentValues.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 0)
                            context.contentResolver.update(savedUri, contentValues, null, null)
                            if (bytesCopied > 0L) {
                                mediaStoreSucceeded = true
                            }
                        }
                    } catch (e: Exception) {
                        mediaStoreSucceeded = false
                    }
                }

                // Copy to cacheDir/shared for instant FileProvider share sheet
                val sharedDir = File(context.cacheDir, "shared").apply { if (!exists()) mkdirs() }
                val shareFile = File(sharedDir, safeName)
                tempFile.copyTo(shareFile, overwrite = true)
                tempFile.delete()
                currentExportTempFile = null

                val shareUri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    shareFile
                )

                if (mediaStoreSucceeded) {
                    showToast("Saved $safeName to Pictures/Vectura")
                } else {
                    showToast("Export ready: sharing $safeName")
                }

                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = safeMime
                    putExtra(Intent.EXTRA_STREAM, shareUri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                val chooser = Intent.createChooser(shareIntent, "Share $safeName").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(chooser)
            } catch (e: Exception) {
                showToast("Export failed: ${e.localizedMessage ?: "Unknown error"}")
                try {
                    currentExportFileOutputStream?.close()
                } catch (_: Exception) {}
                currentExportFileOutputStream = null
                currentExportTempFile?.delete()
                currentExportTempFile = null
            }
        }

        @JavascriptInterface
        fun shareFile(base64Data: String, mimeType: String, filename: String) {
            beginFile(filename, mimeType)
            appendChunk(base64Data)
            finishFile(filename, mimeType)
        }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
            }
        }

        private fun sanitizeFilename(name: String): String {
            val sanitized = name.replace(Regex("[^a-zA-Z0-9._-]"), "_")
            return if (sanitized.isBlank()) "artwork_${System.currentTimeMillis()}" else sanitized
        }
    }
}

@Composable
fun DrawingAppContainer(
    modifier: Modifier = Modifier,
    onWebViewCreated: (WebView) -> Unit
) {
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            WebView(ctx).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                onWebViewCreated(this)
            }
        }
    )
}
