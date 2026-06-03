package com.focusguard

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class AppBlockerService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())

    // The package currently in the foreground that we're watching. While it stays
    // under its limit we re-check on a timer so crossing the limit *during* a
    // session (not just on the next open) still triggers the block.
    private var activePackage: String? = null

    private val pollRunnable = object : Runnable {
        override fun run() {
            val pkg = activePackage ?: return
            if (shouldBlock(pkg)) {
                blockNow(pkg)
            } else {
                handler.postDelayed(this, POLL_INTERVAL_MS)
            }
        }
    }

    companion object {
        // How often to re-check usage while sitting inside a blocked app. Small
        // enough that even a 1-minute test limit trips promptly.
        private const val POLL_INTERVAL_MS = 15_000L
    }

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

        // Our own UI is showing — stop watching the previous app.
        if (packageName == "com.focusguard") {
            stopPolling()
            activePackage = packageName
            return
        }

        // Ignore transient system windows (notification shade, keyboard) so they
        // don't cancel polling of the app the user is actually still inside.
        if (isSystemPackage(packageName)) return

        // A real app switch: drop any poll for the previous app.
        handler.removeCallbacks(pollRunnable)
        activePackage = packageName

        // Not a blocked app -> nothing to watch.
        if (blockedAppConfig(packageName) == null) return

        if (shouldBlock(packageName)) {
            blockNow(packageName)
        } else {
            // Under the limit / within a grant: let them in, but keep checking so
            // we catch the moment they go over while still in the app.
            handler.postDelayed(pollRunnable, POLL_INTERVAL_MS)
        }
    }

    // Returns the blocked-app config object for this package, or null if it isn't
    // on the blocked list (or the list can't be read).
    private fun blockedAppConfig(packageName: String): JSONObject? {
        val prefs = getSharedPreferences("focusguard", MODE_PRIVATE)
        val json = prefs.getString("blockedApps", "[]") ?: "[]"
        return try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val app = arr.getJSONObject(i)
                if (app.getString("packageName") == packageName) return app
            }
            null
        } catch (e: Exception) {
            null
        }
    }

    // True only when the app is blocked, has no active grant, and today's usage
    // has reached its daily limit.
    private fun shouldBlock(packageName: String): Boolean {
        val app = blockedAppConfig(packageName) ?: return false
        val prefs = getSharedPreferences("focusguard", MODE_PRIVATE)
        val grantUntil = prefs.getLong("grant_$packageName", 0L)
        if (System.currentTimeMillis() < grantUntil) return false
        val limit = app.optInt("dailyLimitMinutes", 30)
        return usageMinutesToday(packageName) >= limit
    }

    private fun blockNow(packageName: String) {
        val app = blockedAppConfig(packageName) ?: return
        stopPolling()
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("blockedPackage", packageName)
            putExtra("blockedAppName", app.getString("appName"))
            putExtra("limitMinutes", app.optInt("dailyLimitMinutes", 30))
            putExtra("usedMinutes", usageMinutesToday(packageName))
            putExtra("fromService", true)
        }
        startActivity(intent)
    }

    private fun stopPolling() {
        handler.removeCallbacks(pollRunnable)
    }

    private fun isSystemPackage(pkg: String): Boolean {
        return pkg == "android" ||
            pkg == "com.android.systemui" ||
            pkg.contains("inputmethod")
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

    override fun onDestroy() {
        super.onDestroy()
        stopPolling()
    }
}
