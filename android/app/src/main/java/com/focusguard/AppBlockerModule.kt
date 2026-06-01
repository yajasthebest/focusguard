package com.focusguard

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = AppBlockerModule.NAME)
class AppBlockerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AppBlocker"
    }

    override fun getName() = NAME

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
