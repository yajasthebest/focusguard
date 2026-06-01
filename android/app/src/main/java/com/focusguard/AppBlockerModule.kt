package com.focusguard

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = AppBlockerModule.NAME)
class AppBlockerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        contextRef = reactContext
    }

    companion object {
        const val NAME = "AppBlocker"

        // Held so the AccessibilityService -> MainActivity.onNewIntent path can push
        // a block target into JS even while the app is already foregrounded.
        private var contextRef: ReactApplicationContext? = null

        fun emitBlockTarget(packageName: String?, appName: String?, limitMinutes: Int, usedMinutes: Int) {
            val ctx = contextRef ?: return
            if (!ctx.hasActiveReactInstance()) return
            val map = Arguments.createMap().apply {
                putString("packageName", packageName)
                putString("appName", appName)
                putInt("limitMinutes", limitMinutes)
                putInt("usedMinutes", usedMinutes)
            }
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onBlockedApp", map)
        }
    }

    override fun getName() = NAME

    // Read the block target carried by the activity's launch intent (cold start).
    // Returns null when the app was opened normally (not via the blocker service).
    @ReactMethod
    fun getInitialBlockTarget(promise: Promise) {
        try {
            val intent = currentActivity?.intent
            if (intent != null && intent.getBooleanExtra("fromService", false)) {
                val map = Arguments.createMap().apply {
                    putString("packageName", intent.getStringExtra("blockedPackage"))
                    putString("appName", intent.getStringExtra("blockedAppName"))
                    putInt("limitMinutes", intent.getIntExtra("limitMinutes", 30))
                    putInt("usedMinutes", intent.getIntExtra("usedMinutes", 0))
                }
                promise.resolve(map)
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    // Clear the fromService flag so a later launch from the home screen (or a JS
    // re-render) doesn't re-trigger the block screen for a stale intent.
    @ReactMethod
    fun clearBlockTarget() {
        currentActivity?.intent?.removeExtra("fromService")
    }

    // Open a temporary allow-window for the package. While it's active the
    // AccessibilityService lets the app through without interrupting.
    @ReactMethod
    fun grantAccess(packageName: String, minutes: Int) {
        val prefs = reactApplicationContext.getSharedPreferences("focusguard", 0)
        val until = System.currentTimeMillis() + minutes * 60_000L
        prefs.edit().putLong("grant_$packageName", until).apply()
    }

    // Launch a package by name, used by the "Open <app>" button after a grant so
    // the user lands back in the app they were trying to reach.
    @ReactMethod
    fun launchApp(packageName: String) {
        val intent = reactApplicationContext.packageManager.getLaunchIntentForPackage(packageName)
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        }
    }

    // Required so NativeEventEmitter doesn't warn on iOS-style listener bookkeeping.
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    @ReactMethod
    fun setBlockedApps(appsJson: String) {
        val prefs = reactApplicationContext.getSharedPreferences("focusguard", 0)
        prefs.edit().putString("blockedApps", appsJson).apply()
    }

    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        try {
            val enabled = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            // Android may store the service as either the fully-qualified name
            // (com.focusguard/com.focusguard.AppBlockerService) or the short form
            // (com.focusguard/.AppBlockerService). Match either, case-insensitively.
            val cn = ComponentName(reactApplicationContext, AppBlockerService::class.java)
            val flat = cn.flattenToString()
            val shortFlat = cn.flattenToShortString()
            val match = enabled.split(':').any {
                it.equals(flat, ignoreCase = true) || it.equals(shortFlat, ignoreCase = true)
            }
            promise.resolve(match)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        try {
            promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openOverlaySettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + reactApplicationContext.packageName)
        ).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactApplicationContext.startActivity(intent)
    }
}
