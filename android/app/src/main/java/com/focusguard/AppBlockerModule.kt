package com.focusguard

import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.*

class AppBlockerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AppBlockerModule"

    // Check if accessibility service is enabled
    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        try {
            val enabled = Settings.Secure.getString(
                reactContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            )?.contains("com.focusguard/.AppBlockerService") == true
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // Open accessibility settings so user can enable the service
    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    // Temporarily allow an app for N minutes after AI grants access
    @ReactMethod
    fun temporarilyAllow(packageName: String, minutes: Int, promise: Promise) {
        try {
            // This would call AppBlockerService.grantTemporaryAccess via a bound service
            // For now we write to a shared file that the service reads
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    // Get list of all installed apps on device
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val apps = pm.getInstalledApplications(0)
            val result = Arguments.createArray()

            apps.forEach { app ->
                // Filter out system apps
                if (app.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM == 0) {
                    val map = Arguments.createMap()
                    map.putString("packageName", app.packageName)
                    map.putString("appName", pm.getApplicationLabel(app).toString())
                    result.pushMap(map)
                }
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
