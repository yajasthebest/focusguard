import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';

const { AppBlocker } = NativeModules;

const KEYS = {
  BLOCKED_APPS: 'blockedApps',
  USAGE_TODAY: 'usageToday',
  LAST_USAGE_DATE: 'lastUsageDate',
};

// Blocked apps format: { packageName, appName, dailyLimitMinutes }.
// Loosening a restriction (raising a limit or removing an app) is held until the
// next midnight so it can't be done on impulse — the change is parked on the app
// as { pendingLimit, pendingEffective } or { pendingRemove, pendingEffective }
// and applied once that time passes. Tightening (lower a limit, add an app) is
// always instant.
const DEFAULT_LIMIT_MINUTES = 240;

function nextMidnightMs() {
  const d = new Date();
  d.setHours(24, 0, 0, 0); // rolls to 00:00 tomorrow
  return d.getTime();
}

// Apply any parked change whose effective time has passed. Pure: returns the new
// list and whether anything changed. `force` applies regardless of time (test).
function applyDuePending(apps, force = false) {
  const now = Date.now();
  let changed = false;
  const out = [];
  for (const app of apps) {
    if (app.pendingEffective && (force || now >= app.pendingEffective)) {
      changed = true;
      if (app.pendingRemove) continue; // removal lands -> drop from list
      const { pendingLimit, pendingEffective, pendingRemove, ...rest } = app;
      out.push({ ...rest, dailyLimitMinutes: pendingLimit ?? rest.dailyLimitMinutes });
    } else {
      out.push(app);
    }
  }
  return { apps: out, changed };
}

export async function getBlockedApps() {
  const data = await AsyncStorage.getItem(KEYS.BLOCKED_APPS);
  const apps = data ? JSON.parse(data) : [];
  // Settle any parked changes whose midnight has passed before handing the list out.
  const { apps: settled, changed } = applyDuePending(apps);
  if (changed) { await saveBlockedApps(settled); return settled; }
  return apps;
}

export async function saveBlockedApps(apps) {
  const json = JSON.stringify(apps);
  await AsyncStorage.setItem(KEYS.BLOCKED_APPS, json);
  // Mirror the list into native SharedPreferences so the AccessibilityService
  // knows which packages to intercept. No-op if the native module is absent.
  // Note: a pending-removal app stays in this list (still enforced) until its
  // midnight, which is exactly what we want — loosening is delayed.
  try { AppBlocker?.setBlockedApps?.(json); } catch {}
}

export async function addBlockedApp(app) {
  const apps = await getBlockedApps();
  const exists = apps.find(a => a.packageName === app.packageName);
  if (!exists) {
    // Tightening -> instant. Strip any junk; keep only the known fields.
    apps.push({
      packageName: app.packageName,
      appName: app.appName,
      dailyLimitMinutes: app.dailyLimitMinutes ?? DEFAULT_LIMIT_MINUTES,
    });
    await saveBlockedApps(apps);
  }
}

// Removing an app is loosening -> parked until midnight. `immediate` (test only)
// drops it right away.
export async function removeBlockedApp(packageName, { immediate = false } = {}) {
  const apps = await getBlockedApps();
  let changed = false;
  const out = apps.flatMap((a) => {
    if (a.packageName !== packageName) return [a];
    changed = true;
    if (immediate) return [];
    return [{ ...a, pendingRemove: true, pendingEffective: nextMidnightMs() }];
  });
  if (changed) await saveBlockedApps(out);
}

// Lowering a limit (or `immediate`) applies now and cancels any parked change.
// Raising a limit is loosening -> parked until midnight.
export async function updateAppLimit(packageName, dailyLimitMinutes, { immediate = false } = {}) {
  const apps = await getBlockedApps();
  const out = apps.map((a) => {
    if (a.packageName !== packageName) return a;
    if (dailyLimitMinutes <= a.dailyLimitMinutes || immediate) {
      const { pendingLimit, pendingEffective, pendingRemove, ...rest } = a;
      return { ...rest, dailyLimitMinutes };
    }
    return { ...a, pendingLimit: dailyLimitMinutes, pendingEffective: nextMidnightMs() };
  });
  await saveBlockedApps(out);
}

// TEST ONLY: force every parked change to apply right now, skipping the midnight
// wait. Wired to a hidden dashboard button so the delay can be exercised quickly.
export async function flushPendingChanges() {
  const data = await AsyncStorage.getItem(KEYS.BLOCKED_APPS);
  const apps = data ? JSON.parse(data) : [];
  const { apps: settled, changed } = applyDuePending(apps, true);
  if (changed) await saveBlockedApps(settled);
}

export function hasPendingChange(app) {
  return !!app?.pendingEffective;
}

// Usage tracking - resets daily
export async function getUsageToday() {
  const today = new Date().toDateString();
  const lastDate = await AsyncStorage.getItem(KEYS.LAST_USAGE_DATE);
  if (lastDate !== today) {
    await AsyncStorage.setItem(KEYS.USAGE_TODAY, JSON.stringify({}));
    await AsyncStorage.setItem(KEYS.LAST_USAGE_DATE, today);
    return {};
  }
  const data = await AsyncStorage.getItem(KEYS.USAGE_TODAY);
  return data ? JSON.parse(data) : {};
}

export async function addUsageMinutes(packageName, minutes) {
  const usage = await getUsageToday();
  usage[packageName] = (usage[packageName] || 0) + minutes;
  await AsyncStorage.setItem(KEYS.USAGE_TODAY, JSON.stringify(usage));
  return usage[packageName];
}

export async function getAppUsageMinutes(packageName) {
  const usage = await getUsageToday();
  return usage[packageName] || 0;
}

export async function isAppLimitReached(packageName) {
  const apps = await getBlockedApps();
  const app = apps.find(a => a.packageName === packageName);
  if (!app) return false;
  const used = await getAppUsageMinutes(packageName);
  return used >= app.dailyLimitMinutes;
}
