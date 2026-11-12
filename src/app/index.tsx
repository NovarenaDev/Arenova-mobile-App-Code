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

  if (isLoading || !hydrationChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: '#061325', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4F75FF" />
      </View>
    );
  }

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
    return <Redirect href="/(individual)/(individual-tabs)/individual-dashboard" />;
  }

  return <Redirect href="/(auth)" />;
}
