import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store';

export default function CoachTabLayout() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : Math.max(insets.bottom, 12);
  const barHeight = 58 + bottomPadding;

  // Strict Role Boundary Guard: Players and Parents can NEVER access coach portal
  useEffect(() => {
    if (token && user && user.role !== 'coach') {
      Alert.alert(
        'Access Denied (Role Boundary)',
        'This portal is strictly reserved for registered coaching partners.'
      );
      const target = user.role === 'parent' 
        ? '/(parent)/(parent-tabs)/parent-dashboard' 
        : '/(individual)/(individual-tabs)/individual-dashboard';
      router.replace(target as any);
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
        name="coach-dashboard" 
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={typeof color === 'string' ? color : undefined} />
        }} 
      />
      <Tabs.Screen 
        name="schedule" 
        options={{ 
          title: 'Availability',
          tabBarIcon: ({ color }) => <Ionicons name="time-outline" size={24} color={typeof color === 'string' ? color : undefined} />
        }} 
      />
      <Tabs.Screen 
        name="activity" 
        options={{ 
          title: 'Activity',
          tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={24} color={typeof color === 'string' ? color : undefined} />
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
