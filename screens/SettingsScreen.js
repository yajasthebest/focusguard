import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBlockedApps, removeBlockedApp } from '../services/storage';
import { useGoogleAuth, handleAuthResponse, signOut, getStoredUser } from '../services/calendar';
import {
  nativeAvailable,
  hasUsagePermission, openUsageSettings,
  isAccessibilityEnabled, openAccessibilitySettings,
  canDrawOverlays, openOverlaySettings,
} from '../services/usage';

function PermissionRow({ granted, title, desc, onPress }) {
  return (
    <View style={s.setupCard}>
      <View style={s.row}>
        <Text style={s.cardTitle}>{title}</Text>
        <View style={[s.statusPill, granted ? s.statusOn : s.statusOff]}>
          <Text style={[s.statusText, granted ? s.statusTextOn : s.statusTextOff]}>
            {granted ? 'GRANTED' : 'NEEDED'}
          </Text>
        </View>
      </View>
      <Text style={s.noteText}>{desc}</Text>
      <TouchableOpacity style={[s.setupBtn, granted && s.setupBtnDone]} onPress={onPress}>
        <Text style={[s.setupBtnText, granted && s.setupBtnTextDone]}>
          {granted ? 'Granted — open settings' : 'Grant permission'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const [blockedApps, setBlockedApps] = useState([]);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState({ usage: false, accessibility: false, overlay: false });

  const { request, response, promptAsync } = useGoogleAuth();

  React.useEffect(() => {
    if (response) {
      handleAuthResponse(response).then(result => {
        if (result) setUser(result.user);
      });
    }
  }, [response]);

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    const [apps, u, usage, accessibility, overlay] = await Promise.all([
      getBlockedApps(),
      getStoredUser(),
      hasUsagePermission(),
      isAccessibilityEnabled(),
      canDrawOverlays(),
    ]);
    setBlockedApps(apps);
    setUser(u);
    setPerms({ usage, accessibility, overlay });
  };

  // Each opener checks if the native module is present; if not (Expo Go / old
  // build) it explains the manual path instead of silently doing nothing.
  const openOrExplain = (opener, manualPath) => () => {
    if (nativeAvailable) opener();
    else Alert.alert('Open it manually', `On your phone: ${manualPath}`);
  };

  const handleRemove = (app) => {
    Alert.alert('Remove', `Remove ${app.appName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await removeBlockedApp(app.packageName); load(); } },
    ]);
  };

  const handleGoogle = async () => {
    if (user) {
      await signOut();
      setUser(null);
    } else {
      try {
        await promptAsync();
      } catch (e) {
        Alert.alert('Error', 'Could not sign in.');
      }
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}><Text style={s.title}>Settings ⚙️</Text></View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>GOOGLE ACCOUNT</Text>
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Calendar & Tasks</Text>
              <Text style={s.cardSub}>{user ? `Connected: ${user.email}` : 'Connect to let AI see your schedule'}</Text>
            </View>
            <TouchableOpacity style={[s.btn, user && s.btnDanger]} onPress={handleGoogle}>
              <Text style={[s.btnText, user && s.btnDangerText]}>{user ? 'Disconnect' : 'Connect'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.row}>
            <Text style={s.sectionTitle}>BLOCKED APPS ({blockedApps.length})</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('AppPicker')}>
              <Text style={s.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {blockedApps.length === 0
            ? <View style={s.card}><Text style={s.empty}>No apps blocked yet.</Text></View>
            : blockedApps.map(app => (
              <View key={app.packageName} style={s.appRow}>
                <View style={s.appIcon}><Text style={s.appIconText}>{app.appName[0]}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.appName}>{app.appName}</Text>
                  <Text style={s.appLimit}>{app.dailyLimitMinutes} min/day limit</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemove(app)}><Text style={s.remove}>✕</Text></TouchableOpacity>
              </View>
            ))
          }
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>ANDROID SETUP</Text>
          <Text style={s.setupIntro}>FocusGuard needs three permissions to track screen time and block apps. Grant all three:</Text>

          <PermissionRow
            granted={perms.usage}
            title="Usage access"
            desc="Lets FocusGuard read how long you've used each app today."
            onPress={openOrExplain(openUsageSettings, 'Settings → Apps → Special access → Usage access → FocusGuard')}
          />
          <PermissionRow
            granted={perms.accessibility}
            title="Accessibility"
            desc="Detects the moment a blocked app opens so the AI gate can appear."
            onPress={openOrExplain(openAccessibilitySettings, 'Settings → Accessibility → FocusGuard → turn it on')}
          />
          <PermissionRow
            granted={perms.overlay}
            title="Display over other apps"
            desc="Lets the block screen show on top of the app you opened."
            onPress={openOrExplain(openOverlaySettings, 'Settings → Apps → Special access → Display over other apps → FocusGuard')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#111' },
  title: { color: 'white', fontSize: 22, fontWeight: '700' },
  section: { gap: 8 },
  sectionTitle: { color: '#555', fontSize: 11, letterSpacing: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { backgroundColor: '#111', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1a1a1a', flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { color: 'white', fontWeight: '600', fontSize: 14 },
  cardSub: { color: '#444', fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: '#7c3aed22', borderWidth: 1, borderColor: '#7c3aed44', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  btnText: { color: '#7c3aed', fontWeight: '700', fontSize: 12 },
  btnDanger: { backgroundColor: '#ef444422', borderColor: '#ef444444' },
  btnDangerText: { color: '#ef4444' },
  addBtn: { backgroundColor: '#7c3aed22', borderWidth: 1, borderColor: '#7c3aed44', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { color: '#7c3aed', fontSize: 12, fontWeight: '700' },
  empty: { color: '#444', fontSize: 13 },
  appRow: { backgroundColor: '#111', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#1a1a1a' },
  appIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  appIconText: { color: '#7c3aed', fontWeight: '700' },
  appName: { color: 'white', fontWeight: '600', fontSize: 14 },
  appLimit: { color: '#444', fontSize: 11, marginTop: 2 },
  remove: { color: '#444', fontSize: 16, padding: 4 },
  noteText: { color: '#555', fontSize: 12, lineHeight: 18, marginBottom: 4 },
  noteStep: { color: '#7c3aed', fontSize: 12, marginVertical: 4 },
  setupIntro: { color: '#555', fontSize: 12, lineHeight: 18, marginBottom: 2 },
  setupCard: { backgroundColor: '#111', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1a1a1a', gap: 10 },
  statusPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  statusOn: { backgroundColor: '#14532d', borderColor: '#22c55e44' },
  statusOff: { backgroundColor: '#1a0808', borderColor: '#ef444444' },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  statusTextOn: { color: '#22c55e' },
  statusTextOff: { color: '#ef4444' },
  setupBtn: { backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  setupBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  setupBtnDone: { backgroundColor: '#11210f', borderWidth: 1, borderColor: '#22c55e33' },
  setupBtnTextDone: { color: '#22c55e' },
});
