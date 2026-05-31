import { NativeModules } from 'react-native';

// These native modules only exist in a real dev/release build (registered via
// AppBlockerPackage). In Expo Go or any build without the native code they are
// undefined, so every call below degrades gracefully.
const { UsageStats, AppBlocker } = NativeModules;

export const nativeAvailable = !!UsageStats && !!AppBlocker;

// --- Usage access (PACKAGE_USAGE_STATS) ---
export async function hasUsagePermission() {
  if (!UsageStats?.hasUsagePermission) return false;
  try { return await UsageStats.hasUsagePermission(); } catch { return false; }
}

export function openUsageSettings() {
  UsageStats?.openUsageSettings?.();
}

// Returns { [packageName]: minutesUsedToday } from the device, or null if the
// native module / permission isn't available (caller can fall back).
export async function getDeviceUsageToday() {
  if (!UsageStats?.getUsageStats) return null;
  try {
    const granted = await hasUsagePermission();
    if (!granted) return null;
    return await UsageStats.getUsageStats();
  } catch {
    return null;
  }
}

// --- Accessibility (detect app opens) ---
export async function isAccessibilityEnabled() {
  if (!AppBlocker?.isAccessibilityEnabled) return false;
  try { return await AppBlocker.isAccessibilityEnabled(); } catch { return false; }
}

export function openAccessibilitySettings() {
  AppBlocker?.openAccessibilitySettings?.();
}

// --- Display over other apps (SYSTEM_ALERT_WINDOW) ---
export async function canDrawOverlays() {
  if (!AppBlocker?.canDrawOverlays) return false;
  try { return await AppBlocker.canDrawOverlays(); } catch { return false; }
}

export function openOverlaySettings() {
  AppBlocker?.openOverlaySettings?.();
}
