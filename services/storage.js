import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  BLOCKED_APPS: 'blockedApps',
  USAGE_TODAY: 'usageToday',
  LAST_USAGE_DATE: 'lastUsageDate',
};

// Blocked apps format: { packageName, appName, dailyLimitMinutes }
export async function getBlockedApps() {
  const data = await AsyncStorage.getItem(KEYS.BLOCKED_APPS);
  return data ? JSON.parse(data) : [];
}

export async function saveBlockedApps(apps) {
  await AsyncStorage.setItem(KEYS.BLOCKED_APPS, JSON.stringify(apps));
}

export async function addBlockedApp(app) {
  const apps = await getBlockedApps();
  const exists = apps.find(a => a.packageName === app.packageName);
  if (!exists) {
    apps.push({ ...app, dailyLimitMinutes: 30 });
    await saveBlockedApps(apps);
  }
}

export async function removeBlockedApp(packageName) {
  const apps = await getBlockedApps();
  await saveBlockedApps(apps.filter(a => a.packageName !== packageName));
}

export async function updateAppLimit(packageName, dailyLimitMinutes) {
  const apps = await getBlockedApps();
  const updated = apps.map(a => a.packageName === packageName ? { ...a, dailyLimitMinutes } : a);
  await saveBlockedApps(updated);
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
