package com.focusguard

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class AppBlockerService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())

    // The package currently in the foreground that we're watching. While it stays
    // under its limit we re-check on a timer so crossing the limit *during* a
    // session (not just on the next open) still triggers the block.
    private var activePackage: String? = null

    // Whether a re-check timer is already queued. Used so a busy app's stream of
    // window events doesn't keep restarting the timer (which would push it past
    // its interval forever and it would never fire).
    private var polling = false

    private val pollRunnable = object : Runnable {
        override fun run() {
            val pkg = activePackage
            if (pkg == null) { polling = false; return }
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

        // A real app switch (not just another window inside the same app): drop
        // any poll for the previous app and start fresh.
        if (packageName != activePackage) {
            stopPolling()
            activePackage = packageName
        }

        // Not a blocked app -> nothing to watch.
        if (blockedAppConfig(packageName) == null) {
            stopPolling()
            return
        }

        // Re-check on every window event for this app (cheap), so we usually catch
        // the limit crossing the instant the next screen draws. Keep ONE poll
        // running for the idle case (e.g. a playing video that emits no events) —
        // but never restart it here, or a busy app would reset it forever.
        if (shouldBlock(packageName)) {
            blockNow(packageName)
        } else if (!polling) {
            polling = true
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
        // Diagnostic: if this toast shows but FocusGuard never comes to the
        // foreground, the Activity launch is being swallowed by Android 14's
        // background-launch limits (next step would be a full-screen-intent
        // notification). If no toast appears, the block decision never fired.
        Toast.makeText(this, "FocusGuard: limit reached — blocking", Toast.LENGTH_SHORT).show()
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
        polling = false
    }

    private fun isSystemPackage(pkg: String): Boolean {
        return pkg == "android" ||
            pkg == "com.android.systemui" ||
            pkg.contains("inputmethod")
    }

    // Minutes the package has spent in the foreground since midnight. Computed
    // from raw usage *events* rather than queryAndAggregateUsageStats because the
    // aggregate API does NOT include the session that is currently in progress —
    // the minutes you're racking up *right now* sitting inside the app aren't
    // flushed yet. By walking foreground/background events and closing any still-
    // open session at "now", a limit trips mid-session instead of only after you
    // leave the app. Requires the Usage Access permission.
    private fun usageMinutesToday(packageName: String): Int {
        return try {
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val start = startOfTodayMillis()
            val now = System.currentTimeMillis()
            val events = usm.queryEvents(start, now)
            val event = UsageEvents.Event()
            var totalMs = 0L
            var foregroundSince = 0L
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.packageName != packageName) continue
                when (event.eventType) {
                    // MOVE_TO_FOREGROUND == ACTIVITY_RESUMED (same value); guard so a
                    // second resume without an intervening pause doesn't reset the clock.
                    UsageEvents.Event.MOVE_TO_FOREGROUND ->
                        if (foregroundSince == 0L) foregroundSince = event.timeStamp
                    // MOVE_TO_BACKGROUND == ACTIVITY_PAUSED.
                    UsageEvents.Event.MOVE_TO_BACKGROUND ->
                        if (foregroundSince != 0L) {
                            totalMs += event.timeStamp - foregroundSince
                            foregroundSince = 0L
                        }
                }
            }
            // Session still open => the app is in the foreground now. Count up to now.
            if (foregroundSince != 0L) totalMs += now - foregroundSince
            (totalMs / 1000 / 60).toInt()
        } catch (e: Exception) {
            0
        }
    }

    private fun startOfTodayMillis(): Long {
        return Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        super.onDestroy()
        stopPolling()
    }
}
