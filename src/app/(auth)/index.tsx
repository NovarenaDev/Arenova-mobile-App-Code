import React, { useEffect } from 'react';
import { View, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Typography, Button } from '@/components/ui';
import { useAuthStore } from '@/store';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && token) {
      const role = user?.role || 'individual';
      if (role === 'coach') {
        router.replace(user?.status === 'active' ? '/(coach)/(coach-tabs)/coach-dashboard' : '/(coach)/onboarding');
      } else if (role === 'parent') {
        router.replace('/(parent)/(parent-tabs)/parent-dashboard');
      } else {
        router.replace('/(individual)/(individual-tabs)/individual-dashboard');
      }
    }
  }, [token, user, isLoading]);

  if (isLoading || token) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      <View className="flex-1 px-6 justify-center items-center">
        
        <View className="flex-1 justify-center items-center w-full">
          <Image 
            source={require('../../../assets/images/arenova_logo.png')} 
            style={{ width: 250, height: 100 }} 
            resizeMode="contain" 
          />
          <Typography variant="h1" color="secondary" className="mt-8 text-center font-bold">
            Welcome to Arenova
          </Typography>
          <Typography variant="body1" color="muted" className="text-center mt-3">
            Start your training journey today.
          </Typography>
        </View>

        <View className="w-full" style={{ paddingBottom: Math.max(insets.bottom + 16, 36) }}>
          <Button 
            title="Get Started" 
            variant="primary"
            onPress={() => router.push('/(auth)/role-selection')}
          />
        </View>

      </View>
    </SafeAreaView>
  );
}
