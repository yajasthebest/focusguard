package com.focusguard

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import java.util.Calendar

@ReactModule(name = UsageStatsModule.NAME)
class UsageStatsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "UsageStats"
    }

    override fun getName() = NAME

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val intent = Intent(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_LAUNCHER) }
            val apps = pm.queryIntentActivities(intent, 0)
                .filter { it.activityInfo.packageName != "com.focusguard" }
                .sortedBy { it.loadLabel(pm).toString().lowercase() }

            val result = WritableNativeArray()
            for (app in apps) {
                val map = WritableNativeMap()
                map.putString("appName", app.loadLabel(pm).toString())
                map.putString("packageName", app.activityInfo.packageName)
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getUsageStats(promise: Promise) {
        try {
            val usm = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val cal = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val now = System.currentTimeMillis()
            // Walk raw events and sum foreground spans per package, closing any
            // still-open session at "now". Matches AppBlockerService exactly, so the
            // dashboard's "LIMIT HIT" agrees with what actually triggers a block —
            // unlike queryUsageStats(INTERVAL_DAILY), which over-counts by summing
            // overlapping daily buckets and omits the in-progress session.
            val events = usm.queryEvents(cal.timeInMillis, now)
            val event = UsageEvents.Event()
            val totals = HashMap<String, Long>()
            val foregroundSince = HashMap<String, Long>()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                val pkg = event.packageName ?: continue
                when (event.eventType) {
                    UsageEvents.Event.MOVE_TO_FOREGROUND ->
                        if (!foregroundSince.containsKey(pkg)) foregroundSince[pkg] = event.timeStamp
                    UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                        val since = foregroundSince.remove(pkg)
                        if (since != null) totals[pkg] = (totals[pkg] ?: 0L) + (event.timeStamp - since)
                    }
                }
            }
            for ((pkg, since) in foregroundSince) {
                totals[pkg] = (totals[pkg] ?: 0L) + (now - since)
            }
            val result = WritableNativeMap()
            for ((pkg, ms) in totals) {
                val minutes = (ms / 1000 / 60).toInt()
                if (minutes > 0) result.putInt(pkg, minutes)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun hasUsagePermission(promise: Promise) {
        try {
            val usm = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, 0, System.currentTimeMillis())
            promise.resolve(stats != null && stats.isNotEmpty())
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openUsageSettings() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactApplicationContext.startActivity(intent)
    }
}
