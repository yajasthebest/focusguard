import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch,
  StyleSheet, SafeAreaView, Alert, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBlockedApps, removeBlockedApp, updateAppLimit } from '../services/storage';
import { signInGoogle } from '../services/calendar';

export default function SettingsScreen({ navigation }) {
  const [blockedApps, setBlockedApps] = useState([]);
  const [editingLimit, setEditingLimit] = useState(null);
  const [limitInput, setLimitInput] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    const apps = await getBlockedApps();
    setBlockedApps(apps);
  };

  const handleRemove = (app) => {
    Alert.alert('Remove App', `Remove ${app.appName} from blocked list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await removeBlockedApp(app.packageName);
        load();
      }},
    ]);
  };

  const handleUpdateLimit = async (packageName) => {
    const mins = parseInt(limitInput);
    if (!isNaN(mins) && mins > 0) {
      await updateAppLimit(packageName, mins);
      setEditingLimit(null);
      load();
    }
  };

  const connectGoogle = async () => {
    const token = await signInGoogle();
    if (token) setGoogleConnected(true);
    else Alert.alert('Error', 'Could not connect Google account. Make sure you have set up your Google Client ID in calendar.js');
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>

        {/* Google integration */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Integrations</Text>
          <View style={s.card}>
            <View style={s.integrationRow}>
              <View>
                <Text style={s.integrationName}>Google Calendar & Tasks</Text>
                <Text style={s.integrationDesc}>AI uses your schedule to make better decisions</Text>
              </View>
              {googleConnected
                ? <View style={s.connectedBadge}><Text style={s.connectedText}>✓ Connected</Text></View>
                : <TouchableOpacity style={s.connectBtn} onPress={connectGoogle}>
                    <Text style={s.connectBtnText}>Connect</Text>
                  </TouchableOpacity>
              }
            </View>
          </View>
        </View>

        {/* Blocked apps */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Blocked Apps ({blockedApps.length})</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => navigation.navigate('AppPicker')}>
              <Text style={s.addBtnText}>+ Add App</Text>
            </TouchableOpacity>
          </View>

          {blockedApps.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>No apps blocked. Tap "+ Add App" to start.</Text>
            </View>
          ) : (
            blockedApps.map(app => (
              <View key={app.packageName} style={s.appCard}>
                <View style={s.appRow}>
                  <View style={s.appIcon}><Text style={s.appIconText}>{app.appName[0]}</Text></View>
                  <View style={s.appInfo}>
                    <Text style={s.appName}>{app.appName}</Text>
                    <Text style={s.packageName}>{app.packageName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemove(app)} style={s.removeBtn}>
                    <Text style={s.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.limitRow}>
                  <Text style={s.limitLabel}>Daily limit:</Text>
                  {editingLimit === app.packageName ? (
                    <View style={s.limitEdit}>
                      <TextInput
                        style={s.limitInput}
                        value={limitInput}
                        onChangeText={setLimitInput}
                        keyboardType="number-pad"
                        autoFocus
                      />
                      <Text style={s.limitUnit}>min</Text>
                      <TouchableOpacity onPress={() => handleUpdateLimit(app.packageName)} style={s.saveLimitBtn}>
                        <Text style={s.saveLimitText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingLimit(null)}>
                        <Text style={s.cancelLimitText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => { setEditingLimit(app.packageName); setLimitInput(String(app.dailyLimitMinutes)); }} style={s.limitValue}>
                      <Text style={s.limitValueText}>{app.dailyLimitMinutes} min/day ✏️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Accessibility service note */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Android Setup Required</Text>
          <View style={s.card}>
            <Text style={s.noteText}>
              To block apps, you need to enable FocusGuard in Android Accessibility Settings.
            </Text>
            <Text style={s.noteText}>
              Settings → Accessibility → FocusGuard → Enable
            </Text>
            <Text style={[s.noteText, { color: '#7c3aed', marginTop: 4 }]}>
              This is how all app blockers work (Regain, Cold Turkey, etc.)
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#111' },
  title: { color: 'white', fontSize: 22, fontWeight: '700', fontFamily: 'monospace' },
  section: { gap: 8 },
  sectionTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  card: { backgroundColor: '#111', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1a1a1a' },
  integrationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  integrationName: { color: 'white', fontFamily: 'monospace', fontWeight: '600', fontSize: 14 },
  integrationDesc: { color: '#444', fontFamily: 'monospace', fontSize: 11, marginTop: 2 },
  connectedBadge: { backgroundColor: '#14532d', borderWidth: 1, borderColor: '#22c55e33', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  connectedText: { color: '#22c55e', fontFamily: 'monospace', fontSize: 11 },
  connectBtn: { backgroundColor: '#7c3aed22', borderWidth: 1, borderColor: '#7c3aed44', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  connectBtnText: { color: '#7c3aed', fontFamily: 'monospace', fontWeight: '700', fontSize: 12 },
  addBtn: { backgroundColor: '#7c3aed22', borderWidth: 1, borderColor: '#7c3aed44', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { color: '#7c3aed', fontSize: 12, fontFamily: 'monospace', fontWeight: '700' },
  emptyCard: { backgroundColor: '#111', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#1a1a1a' },
  emptyText: { color: '#444', fontFamily: 'monospace', fontSize: 13, textAlign: 'center' },
  appCard: { backgroundColor: '#111', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1a1a1a', gap: 10 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#7c3aed33' },
  appIconText: { color: '#7c3aed', fontWeight: '700' },
  appInfo: { flex: 1 },
  appName: { color: 'white', fontFamily: 'monospace', fontWeight: '600', fontSize: 14 },
  packageName: { color: '#333', fontFamily: 'monospace', fontSize: 10, marginTop: 1 },
  removeBtn: { padding: 6 },
  removeBtnText: { color: '#444', fontSize: 14 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 46 },
  limitLabel: { color: '#444', fontFamily: 'monospace', fontSize: 12 },
  limitEdit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  limitInput: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#7c3aed44', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, color: 'white', fontFamily: 'monospace', width: 50, textAlign: 'center' },
  limitUnit: { color: '#444', fontFamily: 'monospace', fontSize: 12 },
  saveLimitBtn: { backgroundColor: '#7c3aed', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  saveLimitText: { color: 'white', fontFamily: 'monospace', fontSize: 11, fontWeight: '700' },
  cancelLimitText: { color: '#444', fontFamily: 'monospace', fontSize: 11 },
  limitValue: {},
  limitValueText: { color: '#7c3aed', fontFamily: 'monospace', fontSize: 12 },
  noteText: { color: '#555', fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});
