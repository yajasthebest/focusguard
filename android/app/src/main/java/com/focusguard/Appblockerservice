package com.focusguard

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import org.json.JSONArray

class AppBlockerService : AccessibilityService() {

    override fun onServiceConnected() {
        val info = AccessibilityServiceInfo()
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
        info.flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
        serviceInfo = info
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val packageName = event.packageName?.toString() ?: return
        if (packageName == "com.focusguard") return

        val prefs = getSharedPreferences("focusguard", MODE_PRIVATE)
        val blockedAppsJson = prefs.getString("blockedApps", "[]") ?: "[]"

        try {
            val blockedApps = JSONArray(blockedAppsJson)
            for (i in 0 until blockedApps.length()) {
                val app = blockedApps.getJSONObject(i)
                if (app.getString("packageName") == packageName) {
                    val intent = Intent(this, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra("blockedPackage", packageName)
                        putExtra("blockedAppName", app.getString("appName"))
                        putExtra("limitMinutes", app.getInt("dailyLimitMinutes"))
                        putExtra("fromService", true)
                    }
                    startActivity(intent)
                    return
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onInterrupt() {}
}
