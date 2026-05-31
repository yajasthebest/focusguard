import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getBlockedApps, getUsageToday } from '../services/storage';

export default function HomeScreen({ navigation }) {
  const [blockedApps, setBlockedApps] = useState([]);
  const [usageToday, setUsageToday] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    const [apps, usage] = await Promise.all([getBlockedApps(), getUsageToday()]);
    setBlockedApps(apps);
    setUsageToday(usage);
  };

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalUsed = Object.values(usageToday).reduce((a, b) => a + b, 0);

  // Dev/test: open the AI gate without waiting to hit a real limit.
  // Uses the first blocked app if there is one, otherwise a sensible default.
  const testAI = () => {
    const app = blockedApps[0] || { appName: 'Instagram', packageName: 'com.instagram.android', dailyLimitMinutes: 30 };
    const used = usageToday[app.packageName] ?? 25;
    navigation.navigate('Blocked', {
      appName: app.appName,
      packageName: app.packageName,
      usedMinutes: used,
      limitMinutes: app.dailyLimitMinutes,
    });
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>FocusGuard</Text>
        <Text style={s.subtitle}>AI-powered app blocker</Text>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#7c3aed" />} contentContainerStyle={{ padding: 16, gap: 16 }}>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statNum}>{blockedApps.length}</Text>
            <Text style={s.statLabel}>Apps Blocked</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{totalUsed}m</Text>
            <Text style={s.statLabel}>Used Today</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{blockedApps.filter(a => (usageToday[a.packageName] || 0) >= a.dailyLimitMinutes).length}</Text>
            <Text style={s.statLabel}>Limits Hit</Text>
          </View>
        </View>

        {/* Test the AI gate without hitting a real limit */}
        <TouchableOpacity style={s.testBtn} onPress={testAI}>
          <Text style={s.testBtnText}>🧪 Test AI Response</Text>
        </TouchableOpacity>

        {/* Blocked apps list */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Blocked Apps</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AppPicker')} style={s.addBtn}>
              <Text style={s.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {blockedApps.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyEmoji}>🛡️</Text>
              <Text style={s.emptyTitle}>No apps blocked yet</Text>
              <Text style={s.emptyText}>Add apps you want to limit and the AI will hold you accountable</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('AppPicker')}>
                <Text style={s.emptyBtnText}>Add your first app</Text>
              </TouchableOpacity>
            </View>
          ) : (
            blockedApps.map((app) => {
              const used = usageToday[app.packageName] || 0;
              const percent = Math.min(Math.round((used / app.dailyLimitMinutes) * 100), 100);
              const isOver = used >= app.dailyLimitMinutes;
              return (
                <View key={app.packageName} style={s.appCard}>
                  <View style={s.appIconPlaceholder}>
                    <Text style={s.appIconText}>{app.appName[0]}</Text>
                  </View>
                  <View style={s.appInfo}>
                    <View style={s.appRow}>
                      <Text style={s.appName}>{app.appName}</Text>
                      {isOver && <View style={s.overBadge}><Text style={s.overBadgeText}>LIMIT HIT</Text></View>}
                    </View>
                    <Text style={s.appUsage}>{used}m / {app.dailyLimitMinutes}m used today</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, {
                        width: `${percent}%`,
                        backgroundColor: isOver ? '#ef4444' : percent > 70 ? '#f0a500' : '#7c3aed',
                      }]} />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* How it works */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>How It Works</Text>
          <View style={s.howCard}>
            {[
              ['1', 'Add apps you want to limit'],
              ['2', 'Set your daily time budget'],
              ['3', 'Connect Google Calendar & Tasks'],
              ['4', 'When you open a blocked app, the AI checks your schedule and makes you justify it'],
              ['5', 'Convince the AI or stay focused'],
            ].map(([num, text]) => (
              <View key={num} style={s.howRow}>
                <View style={s.howNum}><Text style={s.howNumText}>{num}</Text></View>
                <Text style={s.howText}>{text}</Text>
              </View>
            ))}
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
  subtitle: { color: '#555', fontSize: 12, fontFamily: 'monospace', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  statNum: { color: '#7c3aed', fontSize: 22, fontWeight: '700', fontFamily: 'monospace' },
  statLabel: { color: '#444', fontSize: 10, fontFamily: 'monospace', marginTop: 2 },
  testBtn: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#7c3aed44', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  testBtnText: { color: '#7c3aed', fontSize: 13, fontFamily: 'monospace', fontWeight: '700' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' },
  addBtn: { backgroundColor: '#7c3aed22', borderWidth: 1, borderColor: '#7c3aed44', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { color: '#7c3aed', fontSize: 12, fontFamily: 'monospace', fontWeight: '700' },
  emptyCard: { backgroundColor: '#111', borderRadius: 16, padding: 28, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#1a1a1a' },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { color: 'white', fontWeight: '700', fontFamily: 'monospace', fontSize: 15 },
  emptyText: { color: '#444', fontSize: 13, textAlign: 'center', fontFamily: 'monospace', lineHeight: 20 },
  emptyBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: '#7c3aed', borderRadius: 10 },
  emptyBtnText: { color: 'white', fontWeight: '700', fontFamily: 'monospace' },
  appCard: { backgroundColor: '#111', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  appIconPlaceholder: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#7c3aed33' },
  appIconText: { color: '#7c3aed', fontWeight: '700', fontSize: 18 },
  appInfo: { flex: 1, gap: 4 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appName: { color: 'white', fontWeight: '600', fontFamily: 'monospace', fontSize: 14 },
  overBadge: { backgroundColor: '#ef444422', borderWidth: 1, borderColor: '#ef444444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  overBadgeText: { color: '#ef4444', fontSize: 9, fontFamily: 'monospace', fontWeight: '700' },
  appUsage: { color: '#444', fontSize: 11, fontFamily: 'monospace' },
  barTrack: { height: 3, backgroundColor: '#1a1a1a', borderRadius: 2 },
  barFill: { height: '100%', borderRadius: 2 },
  howCard: { backgroundColor: '#111', borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  howRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  howNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#7c3aed22', borderWidth: 1, borderColor: '#7c3aed44', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  howNumText: { color: '#7c3aed', fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  howText: { color: '#666', fontSize: 13, fontFamily: 'monospace', flex: 1, lineHeight: 18 },
});
