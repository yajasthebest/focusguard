package com.focusguard

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

class AppBlockerService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())

    private val windowManager by lazy { getSystemService(Context.WINDOW_SERVICE) as WindowManager }

    // The block screen is drawn as a system overlay (SYSTEM_ALERT_WINDOW) on top
    // of the offending app rather than by launching our Activity. Aggressive OEMs
    // (Xiaomi/MIUI especially) silently refuse background Activity launches, but
    // they cannot refuse an overlay the user has already granted. Null when no
    // block is currently shown.
    private var overlayView: View? = null

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

        // While the block overlay is up, only tear it down when the user genuinely
        // leaves the blocked app for something else. Ignore our own overlay/app
        // window events and re-entries into the same blocked app, otherwise the
        // overlay would dismiss itself the instant it appears.
        if (overlayView != null) {
            if (packageName == "com.focusguard") return
            if (isSystemPackage(packageName)) return
            if (packageName == activePackage) return
            removeOverlay()
            // fall through to handle the app the user just switched to
        }

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
        showBlockOverlay(
            packageName,
            app.getString("appName"),
            app.optInt("dailyLimitMinutes", 30),
            usageMinutesToday(packageName)
        )
    }

    // Cover the offending app with a full-screen overlay. This is the actual block:
    // it's drawn over whatever is on screen and the user can't get past it without
    // either going home or opening the AI negotiation screen.
    private fun showBlockOverlay(pkg: String, appName: String, limit: Int, used: Int) {
        if (overlayView != null) return
        try {
            val root = FrameLayout(this).apply {
                setBackgroundColor(0xF0080808.toInt())
                isClickable = true // swallow touches so the app behind can't be used
            }
            val col = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setPadding(dp(32), dp(32), dp(32), dp(32))
            }
            val title = TextView(this).apply {
                text = "🛡️  Daily limit reached"
                setTextColor(Color.WHITE)
                textSize = 22f
                gravity = Gravity.CENTER
            }
            val sub = TextView(this).apply {
                text = "$appName · ${used}m of ${limit}m used today"
                setTextColor(0xFF888888.toInt())
                textSize = 14f
                gravity = Gravity.CENTER
                setPadding(0, dp(10), 0, dp(28))
            }
            val talkBtn = Button(this).apply {
                text = "Talk to FocusGuard"
                setOnClickListener { launchAiScreen(pkg, appName, limit, used) }
            }
            val homeBtn = Button(this).apply {
                text = "Go back"
                setOnClickListener {
                    removeOverlay()
                    performGlobalAction(GLOBAL_ACTION_HOME)
                }
            }
            col.addView(title)
            col.addView(sub)
            col.addView(talkBtn)
            col.addView(homeBtn)
            root.addView(col, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            ))

            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            )
            windowManager.addView(root, params)
            overlayView = root
        } catch (e: Exception) {
            // Overlay permission missing or a window error -> fall back to launching
            // the Activity (works on devices that don't enforce background limits).
            launchAiScreen(pkg, appName, limit, used)
        }
    }

    // Open the RN negotiation screen. Triggered by a user tap on the overlay, so
    // this Activity launch counts as user-initiated and OEM background-launch
    // limits don't apply.
    private fun launchAiScreen(pkg: String, appName: String, limit: Int, used: Int) {
        removeOverlay()
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("blockedPackage", pkg)
            putExtra("blockedAppName", appName)
            putExtra("limitMinutes", limit)
            putExtra("usedMinutes", used)
            putExtra("fromService", true)
        }
        try { startActivity(intent) } catch (e: Exception) {}
    }

    private fun removeOverlay() {
        val v = overlayView ?: return
        overlayView = null
        try { windowManager.removeView(v) } catch (e: Exception) {}
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

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
        removeOverlay()
    }
}
