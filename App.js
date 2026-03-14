import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import HomeScreen from './screens/HomeScreen';
import BlockedScreen from './screens/BlockedScreen';
import SettingsScreen from './screens/SettingsScreen';
import AppPickerScreen from './screens/AppPickerScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="Blocked" component={BlockedScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="AppPicker" component={AppPickerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
