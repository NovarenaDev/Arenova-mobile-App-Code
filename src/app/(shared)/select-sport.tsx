import React from 'react';
import { View, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/components/ui';
import { useRouter } from 'expo-router';

export default function SelectSportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sports = [
    { 
      id: '1', 
      name: 'Badminton', 
      imageUrl: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=400&auto=format&fit=crop&q=60' 
    },
    { 
      id: '2', 
      name: 'Swimming', 
      imageUrl: 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=400&auto=format&fit=crop&q=60' 
    },
    { 
      id: '3', 
      name: 'Football', 
      imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&auto=format&fit=crop&q=60' 
    },
    { 
      id: '4', 
      name: 'Tennis', 
      imageUrl: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&auto=format&fit=crop&q=60' 
    },
    { 
      id: '5', 
      name: 'Yoga', 
      imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&auto=format&fit=crop&q=60' 
    },
    { 
      id: '6', 
      name: 'Fitness', 
      imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&auto=format&fit=crop&q=60' 
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center bg-[#EEF3F9] border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold">
          Select Your Sport
        </Typography>
        <TouchableOpacity className="p-2 -mr-2">
          <Ionicons name="ellipsis-vertical" size={24} color="#0F2C59" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-6" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 40, 60) }}>
        <View className="flex-row flex-wrap justify-between pb-8">
          {sports.map((sport) => (
            <TouchableOpacity 
              key={sport.id}
              className="w-[48%] mb-6"
              onPress={() => router.push({ pathname: '/(shared)/search', params: { sport: sport.name } })}
            >
              <View className="aspect-square bg-white rounded-3xl shadow-sm mb-3 overflow-hidden border border-gray-100">
                <Image 
                  source={{ uri: sport.imageUrl }} 
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </View>
              <Typography variant="subtitle1" color="text" weight="bold" className="text-center">
                {sport.name}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
