import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, SafeAreaView, TextInput, ActivityIndicator,
} from 'react-native';
import { addBlockedApp, getBlockedApps } from '../services/storage';

// Common apps to block - in production this comes from the native module
// which lists all installed apps on the device
const COMMON_APPS = [
  { packageName: 'com.instagram.android', appName: 'Instagram' },
  { packageName: 'com.twitter.android', appName: 'Twitter / X' },
  { packageName: 'com.zhiliaoapp.musically', appName: 'TikTok' },
  { packageName: 'com.snapchat.android', appName: 'Snapchat' },
  { packageName: 'com.reddit.frontpage', appName: 'Reddit' },
  { packageName: 'com.facebook.katana', appName: 'Facebook' },
  { packageName: 'com.youtube.android', appName: 'YouTube' },
  { packageName: 'com.whatsapp', appName: 'WhatsApp' },
  { packageName: 'com.discord', appName: 'Discord' },
  { packageName: 'com.netflix.mediaclient', appName: 'Netflix' },
  { packageName: 'com.spotify.music', appName: 'Spotify' },
  { packageName: 'com.amazon.mShop.android.shopping', appName: 'Amazon' },
  { packageName: 'com.linkedin.android', appName: 'LinkedIn' },
  { packageName: 'com.pinterest', appName: 'Pinterest' },
  { packageName: 'com.tumblr', appName: 'Tumblr' },
];

export default function AppPickerScreen({ navigation }) {
  const [search, setSearch] = useState('');
  const [blockedPackages, setBlockedPackages] = useState([]);
  const [adding, setAdding] = useState(null);

  useEffect(() => {
    getBlockedApps().then(apps => setBlockedPackages(apps.map(a => a.packageName)));
  }, []);

  const filtered = COMMON_APPS.filter(a =>
    a.appName.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (app) => {
    if (blockedPackages.includes(app.packageName)) return;
    setAdding(app.packageName);
    await addBlockedApp(app);
    setBlockedPackages(prev => [...prev, app.packageName]);
    setAdding(null);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Add Apps to Block</Text>
      </View>

      <TextInput
        style={s.search}
        placeholder="Search apps..."
        placeholderTextColor="#444"
        value={search}
        onChangeText={setSearch}
      />

      <Text style={s.note}>
        💡 In the full build, this list comes from your installed apps via the native module.
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={item => item.packageName}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => {
          const isBlocked = blockedPackages.includes(item.packageName);
          const isAdding = adding === item.packageName;
          return (
            <View style={s.appRow}>
              <View style={s.appIcon}>
                <Text style={s.appIconText}>{item.appName[0]}</Text>
              </View>
              <View style={s.appInfo}>
                <Text style={s.appName}>{item.appName}</Text>
                <Text style={s.packageName}>{item.packageName}</Text>
              </View>
              <TouchableOpacity
                style={[s.addBtn, isBlocked && s.addedBtn]}
                onPress={() => handleAdd(item)}
                disabled={isBlocked || isAdding}
              >
                {isAdding
                  ? <ActivityIndicator color="#7c3aed" size="small" />
                  : <Text style={[s.addBtnText, isBlocked && s.addedBtnText]}>
                      {isBlocked ? '✓ Added' : '+ Block'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#111' },
  backBtn: {},
  backBtnText: { color: '#7c3aed', fontFamily: 'monospace', fontSize: 14 },
  title: { color: 'white', fontWeight: '700', fontFamily: 'monospace', fontSize: 16 },
  search: { margin: 16, marginBottom: 8, backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: 'white', fontFamily: 'monospace', fontSize: 14 },
  note: { color: '#333', fontFamily: 'monospace', fontSize: 11, paddingHorizontal: 16, marginBottom: 4 },
  appRow: { backgroundColor: '#111', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  appIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#7c3aed22' },
  appIconText: { color: '#7c3aed', fontWeight: '700', fontSize: 17 },
  appInfo: { flex: 1 },
  appName: { color: 'white', fontFamily: 'monospace', fontWeight: '600', fontSize: 14 },
  packageName: { color: '#333', fontFamily: 'monospace', fontSize: 10, marginTop: 1 },
  addBtn: { backgroundColor: '#7c3aed22', borderWidth: 1, borderColor: '#7c3aed44', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addedBtn: { backgroundColor: '#14532d22', borderColor: '#22c55e33' },
  addBtnText: { color: '#7c3aed', fontFamily: 'monospace', fontWeight: '700', fontSize: 12 },
  addedBtnText: { color: '#22c55e' },
});
