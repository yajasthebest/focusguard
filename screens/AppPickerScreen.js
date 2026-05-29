import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ActivityIndicator, NativeModules, Alert } from 'react-native';
import { addBlockedApp } from '../services/storage';

const { UsageStats } = NativeModules;

// Fallback list if native module not available
const FALLBACK_APPS = [
  { appName: 'Instagram', packageName: 'com.instagram.android' },
  { appName: 'YouTube', packageName: 'com.google.android.youtube' },
  { appName: 'TikTok', packageName: 'com.zhiliaoapp.musically' },
  { appName: 'Twitter / X', packageName: 'com.twitter.android' },
  { appName: 'Snapchat', packageName: 'com.snapchat.android' },
  { appName: 'Facebook', packageName: 'com.facebook.katana' },
  { appName: 'Reddit', packageName: 'com.reddit.frontpage' },
  { appName: 'WhatsApp', packageName: 'com.whatsapp' },
  { appName: 'Telegram', packageName: 'org.telegram.messenger' },
  { appName: 'Netflix', packageName: 'com.netflix.mediaclient' },
];

export default function AppPickerScreen({ navigation }) {
  const [apps, setApps] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState('30');

  useEffect(() => {
    loadApps();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(apps.filter(a => a.appName.toLowerCase().includes(q)));
  }, [search, apps]);

  const loadApps = async () => {
    setLoading(true);
    try {
      if (UsageStats?.getInstalledApps) {
        const installed = await UsageStats.getInstalledApps();
        setApps(installed);
        setFiltered(installed);
      } else {
        setApps(FALLBACK_APPS);
        setFiltered(FALLBACK_APPS);
      }
    } catch {
      setApps(FALLBACK_APPS);
      setFiltered(FALLBACK_APPS);
    }
    setLoading(false);
  };

  const handleAdd = async (app) => {
    const mins = parseInt(limit);
    if (!mins || mins < 1) {
      Alert.alert('Invalid limit', 'Please enter a valid number of minutes.');
      return;
    }
    await addBlockedApp({ ...app, dailyLimitMinutes: mins });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Add App</Text>
      </View>

      <View style={s.limitRow}>
        <Text style={s.limitLabel}>Daily limit (minutes):</Text>
        <TextInput
          style={s.limitInput}
          value={limit}
          onChangeText={setLimit}
          keyboardType="numeric"
          placeholderTextColor="#444"
        />
      </View>

      <TextInput
        style={s.search}
        placeholder="Search apps..."
        placeholderTextColor="#333"
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <View style={s.center}><ActivityIndicator color="#7c3aed" size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.packageName}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => handleAdd(item)}>
              <View style={s.icon}><Text style={s.iconText}>{item.appName[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.appName}>{item.appName}</Text>
                <Text style={s.pkg}>{item.packageName}</Text>
              </View>
              <Text style={s.add}>+ Add</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#111', gap: 12 },
  back: { color: '#7c3aed', fontSize: 14, fontWeight: '600' },
  title: { color: 'white', fontSize: 18, fontWeight: '700' },
  limitRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: '#111' },
  limitLabel: { color: '#555', fontSize: 13, flex: 1 },
  limitInput: { backgroundColor: '#111', color: 'white', borderWidth: 1, borderColor: '#7c3aed33', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, width: 70, textAlign: 'center' },
  search: { margin: 12, backgroundColor: '#111', borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: 'white', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#111', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 9, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#7c3aed22' },
  iconText: { color: '#7c3aed', fontWeight: '700', fontSize: 16 },
  appName: { color: 'white', fontSize: 14, fontWeight: '600' },
  pkg: { color: '#333', fontSize: 10, marginTop: 1 },
  add: { color: '#7c3aed', fontSize: 12, fontWeight: '700' },
});
