import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

interface CoachItem {
  _id: string;
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  sports?: string[];
  sport?: string;
  rating?: number | string;
  reviews?: number | string;
  reviewsCount?: number;
  experience?: number | string;
  exp?: string;
  skills?: string;
  specialties?: string[];
}

export default function FindCoachScreen() {
  const router = useRouter();
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const [activeFilter, setActiveFilter] = useState(sport || 'All');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync activeFilter if sport param changes
  React.useEffect(() => {
    if (sport) {
      setActiveFilter(sport);
    }
  }, [sport]);

  const filters = ['All', 'Badminton', 'Tennis', 'Football', 'Swimming', 'Yoga', 'Fitness'];

  // Query coaches list
  const { data: coachesResponse, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['coaches', activeFilter],
    queryFn: async () => {
      const params: any = {};
      if (activeFilter !== 'All') {
        params.sport = activeFilter;
      }
      const res = await api.get('/coaches', { params });
      return res.data;
    }
  });

  const coaches: CoachItem[] = coachesResponse?.data || [];

  // Filter coaches locally by query
  const filteredCoaches = coaches.filter(coach => {
    const coachName = coach.name || `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || 'Coach';
    const coachSport = coach.sport || coach.sports?.[0] || '';
    const specialtiesStr = coach.specialties ? coach.specialties.join(', ') : '';
    const skillsStr = coach.skills || specialtiesStr || 'Specialized Coaching';

    return (
      coachName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coachSport.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skillsStr.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(parent)/(parent-tabs)/parent-dashboard');
            }
          }} 
          className="p-2 -ml-2"
        >
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
          Find Coach
        </Typography>
        <TouchableOpacity onPress={() => refetch()} className="p-2 -mr-2">
          <Ionicons name="refresh" size={22} color="#FF5100" />
        </TouchableOpacity>
      </View>

      <View className="px-4 py-4 bg-white border-b border-gray-100 shadow-sm z-10">
        <TextInput 
          placeholder="Search for coaches, skills, or sports" 
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Ionicons name="search" size={20} color="#9CA3AF" />}
        />
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
          {filters.map(filter => (
            <TouchableOpacity 
              key={filter}
              className={`px-4 py-2 rounded-full mr-2 border ${
                activeFilter.toLowerCase() === filter.toLowerCase() 
                  ? 'bg-secondary border-secondary' 
                  : 'bg-transparent border-gray-300'
              }`}
              onPress={() => setActiveFilter(filter)}
            >
              <Typography variant="body2" color={activeFilter.toLowerCase() === filter.toLowerCase() ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold">
                {filter}
              </Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading || isRefetching ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FF5100" />
        </View>
      ) : filteredCoaches.length === 0 ? (
        <View className="bg-white rounded-2xl p-8 items-center border border-gray-100 shadow-sm m-4">
          <Ionicons name="people-outline" size={48} color="#9CA3AF" className="mb-3" />
          <Typography variant="body2" color="muted" className="text-center font-outfit">
            No coaches found matching your search.
          </Typography>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-4 pb-8">
          {filteredCoaches.map((coach) => {
            const coachId = coach._id || coach.id || '';
            const coachName = coach.name || `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || 'Coach';
            const coachInitials = coachName.split(' ').map(n => n[0]).join('');
            const coachSport = coach.sport || coach.sports?.[0] || 'Sports';
            const specialtiesStr = coach.specialties ? coach.specialties.join(', ') : '';
            const skillsStr = coach.skills || specialtiesStr || 'Specialized Coaching';
            const rating = coach.rating || '4.8';
            const reviews = coach.reviewsCount || coach.reviews || '120';
            const experience = coach.experience || coach.exp || '3+';

            return (
              <TouchableOpacity 
                key={coachId}
                onPress={() => router.push({
                  pathname: '/(shared)/coach-profile',
                  params: { id: coachId }
                })}
                activeOpacity={0.8}
                className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 flex-row"
              >
                <View className="w-20 h-20 rounded-xl bg-[#F5E6D3] mr-4 items-center justify-center shadow-sm">
                  <Typography variant="h3" color="primary" weight="bold" className="font-outfit-bold">
                    {coachInitials}
                  </Typography>
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between items-start mb-1">
                    <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                      {coachName}
                    </Typography>
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={14} color="#FFD700" className="mr-1" />
                      <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">{rating}</Typography>
                    </View>
                  </View>
                  
                  <Typography variant="body2" color="primary" weight="bold" className="mb-1 font-outfit-bold">
                    {coachSport}
                  </Typography>

                  <Typography variant="caption" color="muted" className="mb-3 leading-4 font-outfit" numberOfLines={2}>
                    Skills: {skillsStr}
                  </Typography>
                  
                  <View className="flex-row justify-between items-center">
                    <Typography variant="caption" color="muted" className="font-outfit">
                      {experience} Years Experience
                    </Typography>
                    <View className="bg-orange-100 px-2 py-0.5 rounded-md">
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-[10px]">Available</Typography>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
