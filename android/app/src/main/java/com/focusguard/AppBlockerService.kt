package com.focusguard

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class AppBlockerService : AccessibilityService() {

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var lastBlockedPackage: String? = null
    private var lastBlockedTime: Long = 0
    private val temporaryAllowances = mutableMapOf<String, Long>() // packageName -> allowedUntil timestamp

    override fun onServiceConnected() {
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            notificationTimeout = 100
        }
        serviceInfo = info
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return

        // Don't block our own app
        if (packageName == "com.focusguard") return
        if (packageName == "android") return

        scope.launch {
            checkAndBlock(packageName)
        }
    }

    private suspend fun checkAndBlock(packageName: String) = withContext(Dispatchers.IO) {
        // Check temporary allowance
        val allowedUntil = temporaryAllowances[packageName]
        if (allowedUntil != null && System.currentTimeMillis() < allowedUntil) return@withContext

        // Avoid spamming the block screen
        if (packageName == lastBlockedPackage && System.currentTimeMillis() - lastBlockedTime < 3000) return@withContext

        // Read blocked apps from storage (shared with React Native via file)
        val blockedApps = getBlockedApps()
        val blockedApp = blockedApps.find { it.getString("packageName") == packageName } ?: return@withContext

        // Check usage
        val usedMinutes = getUsageMinutes(packageName)
        val limitMinutes = blockedApp.getInt("dailyLimitMinutes")

        if (usedMinutes >= limitMinutes) {
            // Limit reached — always block
            withContext(Dispatchers.Main) { launchBlockScreen(packageName, blockedApp.getString("appName"), usedMinutes, limitMinutes) }
        }
    }

    private fun launchBlockScreen(packageName: String, appName: String, usedMinutes: Int, limitMinutes: Int) {
        lastBlockedPackage = packageName
        lastBlockedTime = System.currentTimeMillis()

        val intent = Intent(this, Class.forName("com.focusguard.MainActivity"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        intent.putExtra("screen", "Blocked")
        intent.putExtra("packageName", packageName)
        intent.putExtra("appName", appName)
        intent.putExtra("usedMinutes", usedMinutes)
        intent.putExtra("limitMinutes", limitMinutes)
        startActivity(intent)
    }

    // Reads blocked apps JSON file written by React Native
    private fun getBlockedApps(): List<JSONObject> {
        return try {
            val file = File(filesDir.parent, "files/blockedApps.json")
            if (!file.exists()) return emptyList()
            val json = JSONArray(file.readText())
            (0 until json.length()).map { json.getJSONObject(it) }
        } catch (e: Exception) { emptyList() }
    }

    private fun getUsageMinutes(packageName: String): Int {
        return try {
            val file = File(filesDir.parent, "files/usageToday.json")
            if (!file.exists()) return 0
            val json = JSONObject(file.readText())
            json.optInt(packageName, 0)
        } catch (e: Exception) { 0 }
    }

    // Called from React Native when user is granted access
    fun grantTemporaryAccess(packageName: String, minutes: Int) {
        val until = System.currentTimeMillis() + (minutes * 60 * 1000L)
        temporaryAllowances[packageName] = until
    }

    override fun onInterrupt() {
        scope.cancel()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
