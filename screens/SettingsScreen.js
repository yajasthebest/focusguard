import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Alert, NativeModules } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBlockedApps, removeBlockedApp } from '../services/storage';
import { useGoogleAuth, handleAuthResponse, signOut, getStoredUser } from '../services/calendar';

const { AppBlocker } = NativeModules;

export default function SettingsScreen({ navigation }) {
  const [blockedApps, setBlockedApps] = useState([]);
  const [user, setUser] = useState(null);
  const [accessEnabled, setAccessEnabled] = useState(false);

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
    const [apps, u] = await Promise.all([getBlockedApps(), getStoredUser()]);
    setBlockedApps(apps);
    setUser(u);
    if (AppBlocker?.isAccessibilityEnabled) {
      try { setAccessEnabled(await AppBlocker.isAccessibilityEnabled()); } catch { setAccessEnabled(false); }
    }
  };

  const handleOpenAccessibility = () => {
    if (AppBlocker?.openAccessibilitySettings) {
      AppBlocker.openAccessibilitySettings();
    } else {
      // Native module absent (e.g. Expo Go or an older build) — guide the user manually.
      Alert.alert(
        'Open it manually',
        'On your phone: Settings → Accessibility → FocusGuard → turn it on.',
      );
    }
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
          <View style={s.setupCard}>
            <View style={s.row}>
              <Text style={s.cardTitle}>Accessibility access</Text>
              <View style={[s.statusPill, accessEnabled ? s.statusOn : s.statusOff]}>
                <Text style={[s.statusText, accessEnabled ? s.statusTextOn : s.statusTextOff]}>
                  {accessEnabled ? 'ENABLED' : 'DISABLED'}
                </Text>
              </View>
            </View>
            <Text style={s.noteText}>FocusGuard needs Accessibility access to detect when a blocked app opens. This is how all app blockers work (Regain, Cold Turkey, etc.).</Text>
            <TouchableOpacity style={s.setupBtn} onPress={handleOpenAccessibility}>
              <Text style={s.setupBtnText}>{accessEnabled ? 'Open Accessibility Settings' : 'Enable in Accessibility Settings'}</Text>
            </TouchableOpacity>
          </View>
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
  setupCard: { backgroundColor: '#111', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1a1a1a', gap: 10 },
  statusPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  statusOn: { backgroundColor: '#14532d', borderColor: '#22c55e44' },
  statusOff: { backgroundColor: '#1a0808', borderColor: '#ef444444' },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  statusTextOn: { color: '#22c55e' },
  statusTextOff: { color: '#ef4444' },
  setupBtn: { backgroundColor: '#7c3aed', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  setupBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
});
