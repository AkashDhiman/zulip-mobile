package com.zulipmobile

import android.content.Intent
import android.content.ClipData
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.WebView   
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.ReactRootView;
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.ReadableArray
import com.swmansion.gesturehandler.react.RNGestureHandlerEnabledRootView;
import com.zulipmobile.notifications.*
import com.zulipmobile.sharing.SharingModule

const val TAG = "MainActivity"

open class MainActivity : ReactActivity() {
    /**
     * Returns the name of the main component registered from JavaScript.
     * This is used to schedule rendering of the component.
     */
    override fun getMainComponentName(): String {
        return "ZulipMobile"
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return object : ReactActivityDelegate(this, mainComponentName) {
            override fun createRootView(): ReactRootView {
                return RNGestureHandlerEnabledRootView(this@MainActivity)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)
        // Intent is reused after quitting, skip it.
        if ((getIntent().flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) {
            return;
        }
        
        maybeHandleIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        if (maybeHandleIntent(intent)) {
            return
        }
        super.onNewIntent(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (reactNativeHost.hasInstance()) {
            reactNativeHost.clear()
        }
    }

    /* Returns true just if we did handle the intent. */
    private fun maybeHandleIntent(intent: Intent?): Boolean {
        // We handle intents from "sharing" something to Zulip.
        if (intent != null) {
            if ((intent.action == Intent.ACTION_SEND) or (intent.action == Intent.ACTION_SEND_MULTIPLE)) {
                handleSend(intent)
                return true
            }
        }

        // For other intents, let RN handle it.  In particular this is
        // important for VIEW intents with zulip: URLs.
        return false
    }

    private fun handleSend(intent: Intent) {
        val params: WritableMap = try {
            getParamsFromIntent(intent)
        } catch (e: ShareParamsParseException) {
            Log.w(TAG, "Ignoring malformed share Intent: ${e.message}")
            return
        }

        // TODO deduplicate this with notifyReact.
        // Until then, keep in sync when changing.
        val application = application as ReactApplication
        val host = application.reactNativeHost
        val reactContext = host.tryGetReactInstanceManager()?.currentReactContext
        val appStatus = reactContext?.appStatus
        Log.d(TAG, "app status is $appStatus")
        when (appStatus) {
            null, ReactAppStatus.NOT_RUNNING ->
                // Either there's no JS environment running, or we haven't yet reached
                // foreground.  Expect the app to check initialSharedData on launch.
                SharingModule.initialSharedData = params
            ReactAppStatus.BACKGROUND, ReactAppStatus.FOREGROUND ->
                // JS is running and has already reached foreground. It won't check
                // initialSharedData again, but it will see a shareReceived event.
                emit(reactContext, "shareReceived", params)
        }
    }

    private fun getParamsFromIntent(intent: Intent): WritableMap {
        // For documentation of what fields to expect here, see:
        //   https://developer.android.com/reference/android/content/Intent#ACTION_SEND
        val params = Arguments.createMap()
        
        if ("text/plain" == intent.type) {
            val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
            params.putBoolean("isText", true)
            params.putString("sharedText", sharedText)
        } else {
            val content = Arguments.createArray();
            val url = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            val urls = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            val cr = this.contentResolver

            if (url != null) {
                val singleContent = Arguments.createMap()
                singleContent.putString("url", url.toString())
                singleContent.putString("type", cr.getType(url))
                content.pushMap(singleContent)
            } else if (urls != null) {
                for (u in urls) {
                    val singleContent = Arguments.createMap()
                    singleContent.putString("url", u.toString())
                    singleContent.putString("type", cr.getType(u))
                    content.pushMap(singleContent)
                }
            }

            params.putBoolean("isText", false)
            params.putArray("content", content)
        }
        return params
    }
}

class ShareParamsParseException(errorMessage: String) : RuntimeException(errorMessage)
