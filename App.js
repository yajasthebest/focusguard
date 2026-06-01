import React, { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, AppState, NativeModules, NativeEventEmitter } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import BlockedScreen from './screens/BlockedScreen';
import SettingsScreen from './screens/SettingsScreen';
import AppPickerScreen from './screens/AppPickerScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const { AppBlocker } = NativeModules;
const navigationRef = createNavigationContainerRef();

// Send the user to the AI "convince me" screen for the app the blocker
// intercepted. Called from a cold launch, a warm relaunch event, and on
// foreground — guarded so we don't stack duplicate Blocked screens.
function routeToBlocked(target) {
  if (!target?.packageName || !navigationRef.isReady()) return;

  const current = navigationRef.getCurrentRoute();
  if (current?.name === 'Blocked' && current?.params?.packageName === target.packageName) {
    AppBlocker?.clearBlockTarget?.();
    return;
  }

  navigationRef.navigate('Blocked', {
    appName: target.appName,
    packageName: target.packageName,
    usedMinutes: target.usedMinutes ?? 0,
    limitMinutes: target.limitMinutes,
  });
  // Consume the intent so re-renders / launcher opens don't re-fire it.
  AppBlocker?.clearBlockTarget?.();
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0d0d0d', borderTopColor: '#222' },
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'monospace' },
      }}
    >
      <Tab.Screen name="Dashboard" component={HomeScreen} options={{ tabBarIcon: () => null }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: () => null }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Warm relaunch: blocker service fired while the app was already open.
    let emitter;
    if (AppBlocker) {
      emitter = new NativeEventEmitter(AppBlocker);
      emitter.addListener('onBlockedApp', routeToBlocked);
    }

    // Returning to the foreground: re-check the launch intent in case we missed
    // the event (e.g. JS wasn't mounted yet when the intent landed).
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        AppBlocker?.getInitialBlockTarget?.().then(routeToBlocked).catch(() => {});
      }
      appState.current = next;
    });

    return () => {
      emitter?.removeAllListeners('onBlockedApp');
      sub.remove();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        // Cold start: the app was launched directly into a block.
        AppBlocker?.getInitialBlockTarget?.().then(routeToBlocked).catch(() => {});
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="Blocked" component={BlockedScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="AppPicker" component={AppPickerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
