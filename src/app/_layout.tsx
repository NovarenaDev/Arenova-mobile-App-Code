import '../../global.css';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LogBox } from 'react-native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

try {
  configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false,
  });
} catch (e) {
  // ignore
}

LogBox.ignoreLogs([
  '[Reanimated] Reading from `value` during component render',
  '[Reanimated] Writing to `value` during component render',
]);
import { 
  useFonts, 
  Outfit_400Regular, 
  Outfit_500Medium, 
  Outfit_600SemiBold, 
  Outfit_700Bold 
} from '@expo-google-fonts/outfit';

import { useAuthStore } from '@/store';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/services/queryClient';
import { SafeAreaProvider } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { hydrateAuth, isLoading } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    hydrateAuth();
    // Safety fallback timeout to prevent app hanging on splash screen
    const timer = setTimeout(() => {
      if (useAuthStore.getState().isLoading) {
        useAuthStore.setState({ isLoading: false });
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [hydrateAuth]);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, isLoading]);

  if (!fontsLoaded || isLoading) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
