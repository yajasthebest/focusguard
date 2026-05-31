package com.focusguard

import android.content.Intent
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
            promise.resolve(enabled.contains("com.focusguard/.AppBlockerService"))
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
}
