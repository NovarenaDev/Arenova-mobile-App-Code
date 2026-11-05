import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store';

export default function Index() {
  const { token, user, isLoading, hydrateAuth } = useAuthStore();
  const [hydrationChecked, setHydrationChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;
    hydrateAuth().finally(() => {
      if (isMounted) {
        setHydrationChecked(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [hydrateAuth]);

  // While auth state is hydrating from disk storage, render a background loader
  if (isLoading || !hydrationChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#061325', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4F75FF" />
      </View>
    );
  }

  // If user is authenticated with a token
  if (token) {
    const role = user?.role || 'individual';
    if (role === 'coach') {
      if (user?.status === 'active') {
        return <Redirect href="/(coach)/(coach-tabs)/coach-dashboard" />;
      }
      return <Redirect href="/(coach)/onboarding" />;
    }
    if (role === 'parent') {
      return <Redirect href="/(parent)/(parent-tabs)/parent-dashboard" />;
    }
    // Default to individual/player
    return <Redirect href="/(individual)/(individual-tabs)/individual-dashboard" />;
  }

  // Not authenticated: proceed to Auth Welcome Screen
  return <Redirect href="/(auth)" />;
}
