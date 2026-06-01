package com.focusguard

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import org.json.JSONArray
import java.util.Calendar

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
                    val limit = app.getInt("dailyLimitMinutes")

                    // 1. Active grant window from a successful AI convince -> let
                    //    them through without any interruption until it expires.
                    val grantUntil = prefs.getLong("grant_$packageName", 0L)
                    if (System.currentTimeMillis() < grantUntil) return

                    // 2. Still under today's limit -> don't interrupt in the slightest.
                    val used = usageMinutesToday(packageName)
                    if (used < limit) return

                    // 3. Over the limit with no grant -> open the convince screen.
                    val intent = Intent(this, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra("blockedPackage", packageName)
                        putExtra("blockedAppName", app.getString("appName"))
                        putExtra("limitMinutes", limit)
                        putExtra("usedMinutes", used)
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

    // Minutes the package has spent in the foreground since midnight, read straight
    // from Android's UsageStatsManager (requires the Usage Access permission).
    private fun usageMinutesToday(packageName: String): Int {
        return try {
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val cal = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            // queryAndAggregateUsageStats merges per-package buckets so we don't
            // double-count like a raw queryUsageStats list would.
            val stats = usm.queryAndAggregateUsageStats(cal.timeInMillis, System.currentTimeMillis())
            val ms = stats[packageName]?.totalTimeInForeground ?: 0L
            (ms / 1000 / 60).toInt()
        } catch (e: Exception) {
            0
        }
    }

    override fun onInterrupt() {}
}
