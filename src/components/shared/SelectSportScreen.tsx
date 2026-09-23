import React from 'react';
import { View, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { getTournamentBanner } from '@/utils/tournamentImages';

export default function SelectSportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fallbackSports = [
    { id: '1', name: 'Badminton' },
    { id: '2', name: 'Swimming' },
    { id: '3', name: 'Football' },
    { id: '4', name: 'Tennis' },
    { id: '5', name: 'Yoga' },
    { id: '6', name: 'Fitness' },
  ];

  // Fetch active sports list from API
  const { data: sportsResponse, isLoading } = useQuery({
    queryKey: ['activeSports'],
    queryFn: async () => {
      const res = await api.get('/sports');
      return res.data?.data || res.data;
    }
  });

  const rawSports = Array.isArray(sportsResponse) ? sportsResponse : (sportsResponse?.sports || sportsResponse?.data || []);
  const sportsList = rawSports.length > 0 
    ? rawSports.map((s: any, idx: number) => ({
        id: s._id || s.id || idx.toString(),
        name: s.name || s.title || s,
        imageUrl: s.imageUrl || s.image || getTournamentBanner({ sport: s.name || s.title || s })
      }))
    : fallbackSports.map(s => ({
        ...s,
        imageUrl: getTournamentBanner({ sport: s.name })
      }));

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
        {isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#FF5100" />
            <Typography variant="body2" color="muted" className="mt-2 font-outfit">
              Loading active sports...
            </Typography>
          </View>
        ) : (
          <View className="flex-row flex-wrap justify-between pb-8">
            {sportsList.map((sport: any) => (
              <TouchableOpacity 
                key={sport.id}
                className="w-[48%] mb-6"
                onPress={() => router.push({ pathname: '/search', params: { sport: sport.name } })}
              >
                <View className="aspect-square bg-white rounded-3xl shadow-sm mb-3 overflow-hidden border border-gray-100">
                  <Image 
                    source={{ uri: sport.imageUrl }} 
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                </View>
                <Typography variant="subtitle1" color="text" weight="bold" className="text-center font-outfit-bold">
                  {sport.name}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
