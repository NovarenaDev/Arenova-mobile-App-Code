import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ReviewSuccessScreen() {
  const router = useRouter();
  const { name, type = 'coach' } = useLocalSearchParams<{ name?: string; type?: string }>();
  const isCoach = type === 'coach';

  return (
    <SafeAreaView className="flex-1 bg-primary">
      <View className="flex-1 justify-center items-center px-6">
        <View className="w-24 h-24 bg-white/20 rounded-full items-center justify-center mb-8">
          <Ionicons name="checkmark-circle" size={80} color="white" />
        </View>
        <Typography variant="h1" color="white" weight="bold" className="text-center mb-4">
          Review Submitted!
        </Typography>
        <Typography variant="body1" color="white" className="text-center mb-12 opacity-90 leading-6 px-4">
          {isCoach
            ? `Thank you for reviewing ${name || 'your coach'}. Your feedback helps our sports coaching community maintain high quality training!`
            : `Thank you for reviewing ${name || 'your student'}. Your feedback helps them improve and develop their game!`
          }
        </Typography>
        <Button 
          title="Back to Sessions" 
          variant="white" 
          onPress={() => router.back()} 
          className="w-full"
        />
      </View>
    </SafeAreaView>
  );
}
