import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { getTournamentBanner } from '@/utils/tournamentImages';

export default function TournamentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState('All');

  // Fetch dropdown options for tournaments
  const { data: optionsData } = useQuery({
    queryKey: ['novareTournamentOptions'],
    queryFn: async () => {
      try {
        const res = await api.get('/novare/tournaments/options');
        return res.data?.data || res.data;
      } catch (err) {
        return null;
      }
    }
  });

  // Fetch public tournaments
  const { data: tournamentsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['novareTournaments', selectedSport],
    queryFn: async () => {
      const params: any = {};
      if (selectedSport && selectedSport !== 'All') {
        params.sport = selectedSport;
      }
      const res = await api.get('/novare/tournaments', { params });
      return res.data?.data || res.data;
    }
  });

  const rawTournaments = Array.isArray(tournamentsData) 
    ? tournamentsData 
    : (tournamentsData?.tournaments || tournamentsData?.data || []);

  const sportsFromOptions = optionsData?.sports || optionsData?.sportOptions || ['Football', 'Badminton', 'Tennis', 'Swimming', 'Basketball'];
  const categoriesList = ['All', ...(Array.isArray(sportsFromOptions) ? sportsFromOptions.map((s: any) => typeof s === 'string' ? s : s.name || s.label) : [])];

  const filteredTournaments = rawTournaments.filter((t: any) => {
    const nameMatch = (t.name || t.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const sportMatch = selectedSport === 'All' || (t.sport || t.sportName || '').toLowerCase() === selectedSport.toLowerCase();
    return nameMatch && sportMatch;
  });

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Header */}
      <View className="px-5 py-4 bg-[#0F2C59] border-b border-gray-100 flex-row justify-between items-center shadow-sm">
        <View className="flex-1 mr-2">
          <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold">
            Tournaments
          </Typography>
          <Typography variant="caption" color="light" className="opacity-80 font-outfit">
            Explore and register for upcoming sports tournaments
          </Typography>
        </View>
        <TouchableOpacity 
          onPress={() => router.push('/my-tournaments')}
          className="p-2 bg-white/10 rounded-full flex-row items-center px-3"
        >
          <Ionicons name="trophy" size={18} color="#FF5100" className="mr-1.5" />
          <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
            My Registrations
          </Typography>
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 60, 80) }}
      >
        {/* Search Bar */}
        <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 border border-gray-200 shadow-sm mb-4">
          <Ionicons name="search" size={20} color="#9CA3AF" className="mr-2" />
          <TextInput
            placeholder="Search tournaments by name..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 font-outfit text-secondary text-base p-0"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Sport Category Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5 flex-row">
          {categoriesList.map((cat: string) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedSport(cat)}
              className={`px-4 py-2 rounded-full mr-2 border ${
                selectedSport === cat
                  ? 'bg-primary border-primary'
                  : 'bg-white border-gray-200'
              }`}
            >
              <Typography
                variant="body2"
                color={selectedSport === cat ? 'white' : 'secondary'}
                weight="bold"
                className="font-outfit-bold"
              >
                {cat}
              </Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content Section */}
        {isLoading || isRefetching ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#FF5100" />
            <Typography variant="body2" color="muted" className="mt-2 font-outfit">
              Loading tournaments...
            </Typography>
          </View>
        ) : filteredTournaments.length === 0 ? (
          <View className="bg-white rounded-3xl p-6 items-center border border-gray-100 shadow-sm my-4">
            <View className="w-20 h-20 rounded-full bg-[#FFF5F0] items-center justify-center mb-4">
              <Ionicons name="trophy-outline" size={40} color="#FF5100" />
            </View>
            <Typography variant="h3" color="secondary" weight="bold" align="center" className="mb-2 font-outfit-bold">
              No Tournaments Found
            </Typography>
            <Typography variant="body2" color="muted" align="center" className="mb-6 font-outfit leading-5 px-2">
              No active tournaments found for {selectedSport === 'All' ? 'any sport' : selectedSport} right now. Stay tuned for new tournament announcements!
            </Typography>
            <Button title="Refresh List" onPress={() => refetch()} fullWidth={false} className="px-6" />
          </View>
        ) : (
          <View className="pb-8">
            {filteredTournaments.map((t: any, idx: number) => {
              const tId = t._id || t.id || idx.toString();
              const banner = getTournamentBanner(t);
              const title = t.name || t.title || 'Sports Tournament';
              const sport = t.sport || t.sportName || 'Sports';
              const dates = t.startDate ? `${new Date(t.startDate).toLocaleDateString()} - ${t.endDate ? new Date(t.endDate).toLocaleDateString() : ''}` : (t.date || 'Upcoming');
              const fee = t.entryFee !== undefined ? `₹${t.entryFee}` : (t.fee || 'Free Entry');

              return (
                <TouchableOpacity
                  key={tId}
                  onPress={() => router.push({
                    pathname: '/tournament-details',
                    params: { id: tId }
                  })}
                  activeOpacity={0.85}
                  className="bg-white rounded-3xl mb-5 border border-gray-100 shadow-sm overflow-hidden"
                >
                  <View className="h-44 bg-secondary relative">
                    <Image source={{ uri: banner }} className="w-full h-full" resizeMode="cover" />
                    <View className="absolute top-3 right-3 bg-primary px-3 py-1 rounded-full shadow-sm">
                      <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold uppercase text-[10px]">
                        {sport}
                      </Typography>
                    </View>
                  </View>

                  <View className="p-5">
                    <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-2">
                      {title}
                    </Typography>

                    <View className="flex-row items-center mb-3">
                      <Ionicons name="calendar-outline" size={16} color="#FF5100" className="mr-2" />
                      <Typography variant="body2" color="muted" className="font-outfit">
                        {dates}
                      </Typography>
                    </View>

                    {t.location && (
                      <View className="flex-row items-center mb-4">
                        <Ionicons name="location-outline" size={16} color="#4A90E2" className="mr-2" />
                        <Typography variant="body2" color="muted" className="font-outfit">
                          {t.location || t.venue}
                        </Typography>
                      </View>
                    )}

                    <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
                      <View>
                        <Typography variant="caption" color="muted" className="font-outfit">Registration Fee</Typography>
                        <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">
                          {fee}
                        </Typography>
                      </View>

                      <TouchableOpacity 
                        onPress={() => router.push({
                          pathname: '/tournament-details',
                          params: { id: tId }
                        })}
                        className="bg-secondary px-5 py-2.5 rounded-full flex-row items-center"
                      >
                        <Typography variant="body2" color="white" weight="bold" className="font-outfit-bold mr-1">
                          View & Register
                        </Typography>
                        <Ionicons name="arrow-forward" size={14} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
