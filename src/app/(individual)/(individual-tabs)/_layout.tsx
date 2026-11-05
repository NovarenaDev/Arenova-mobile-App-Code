import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store';

export default function IndividualTabLayout() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : Math.max(insets.bottom, 12);
  const barHeight = 58 + bottomPadding;

  // Strict Role Boundary Guard: Coaches can NEVER access player portal
  useEffect(() => {
    if (token && user && user.role === 'coach') {
      Alert.alert(
        'Access Denied (Role Boundary)',
        'Coaches cannot access player booking screens or book coaching sessions.'
      );
      router.replace('/(coach)/(coach-tabs)/coach-dashboard');
    }
  }, [user, token, router]);

  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false, 
        tabBarActiveTintColor: '#FF5100',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F3F4F6',
          borderTopWidth: 1,
          height: barHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#0F2C59',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 4,
        },
      }}
    >
      <Tabs.Screen 
        name="individual-dashboard" 
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={typeof color === 'string' ? color : undefined} />
        }} 
      />
      <Tabs.Screen 
        name="activity" 
        options={{ 
          title: 'Bookings',
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={24} color={typeof color === 'string' ? color : undefined} />
        }} 
      />
      <Tabs.Screen 
        name="tournaments" 
        options={{ 
          title: 'Tournaments',
          tabBarIcon: ({ color }) => <Ionicons name="trophy-outline" size={24} color={typeof color === 'string' ? color : undefined} />
        }} 
      />
      <Tabs.Screen 
        name="profile"
        options={{ 
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={typeof color === 'string' ? color : undefined} />
        }} 
      />
    </Tabs>
  );
}
