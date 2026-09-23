import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter } from 'expo-router';

export default function ReviewSuccessScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <View className="flex-1 justify-center items-center px-6">
        <View className="w-24 h-24 bg-white/20 rounded-full items-center justify-center mb-8">
          <Ionicons name="checkmark-circle" size={80} color="white" />
        </View>
        <Typography variant="h1" color="white" weight="bold" className="text-center mb-4">
          Feedback Sent!
        </Typography>
        <Typography variant="body1" color="white" className="text-center mb-12 opacity-90 leading-6">
          Thank you for reviewing your player. Your feedback helps them improve and grow.
        </Typography>
        <Button 
          title="Back to Sessions" 
          variant="white" 
          onPress={() => router.replace('/session-summary')} 
          className="w-full"
        />
      </View>
    </SafeAreaView>
  );
}
