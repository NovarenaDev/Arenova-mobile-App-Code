import React, { useRef, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useNavigation } from 'expo-router';
import { useAuthStore } from '@/store';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export default function IndividualDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as any, () => {
      if (navigation.isFocused()) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Fetch recommended coaches
  const { data: coachesResponse, isLoading: isLoadingCoaches } = useQuery({
    queryKey: ['featuredCoaches'],
    queryFn: async () => {
      const res = await api.get('/coaches');
      return res.data;
    }
  });

  // Fetch user bookings
  const { data: bookingsResponse, isLoading: isLoadingBookings } = useQuery({
    queryKey: ['playerBookings'],
    queryFn: async () => {
      const res = await api.get('/bookings/my');
      return res.data;
    }
  });

  const coaches = coachesResponse?.data || [];
  const allBookings = bookingsResponse?.data || [];
  const hasBookings = allBookings.length > 0;

  return (
    <View className="flex-1 bg-[#EEF3F9]">
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} scrollEventThrottle={16} decelerationRate="normal" className="flex-1" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 40, 60) }}>
        
        {/* Header Section */}
        <View className="bg-secondary px-6 pt-16 pb-8 rounded-b-3xl shadow-sm">
          <View className="flex-row justify-between items-center mb-2">
            <View className="flex-1 mr-2">
              <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold">
                Welcome back, {user?.name || 'User'}!
              </Typography>
              <Typography variant="caption" color="light" className="opacity-80 font-outfit">
                Track your personal training progress & bookings.
              </Typography>
            </View>
            <View className="flex-row items-center">
              <TouchableOpacity className="p-1 mr-3" onPress={() => router.push('/notifications')}>
                <Ionicons name="notifications-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity className="p-1" onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Find Coach Prominent Banner */}
        <View className="mx-6 mt-6 bg-primary rounded-3xl p-5 shadow-sm overflow-hidden relative">
          <View className="w-2/3">
            <Typography variant="h3" color="white" weight="bold" className="mb-2 font-outfit-bold">
              Learn From Expert Coaches
            </Typography>
            <Typography variant="caption" color="white" className="mb-4 opacity-90 leading-4 font-outfit">
              Book personal training slots with expert sports coaches in your area.
            </Typography>
            <TouchableOpacity 
              onPress={() => router.push('/(individual)/search')}
              className="bg-secondary px-4 py-2 rounded-full self-start"
            >
              <Typography variant="body2" color="white" weight="bold" className="font-outfit-bold">Book Session</Typography>
            </TouchableOpacity>
          </View>
          <View className="absolute -right-4 -bottom-4 opacity-20">
            <Ionicons name="ribbon" size={130} color="white" />
          </View>
        </View>

        {/* Fast Action Categories */}
        <View className="px-6 pt-6 pb-12 flex-row justify-between">
          <TouchableOpacity 
            onPress={() => router.push('/(individual)/select-sport')}
            className="w-[30%] aspect-square rounded-2xl bg-[#4B9C73] p-3 justify-center items-center shadow-sm"
          >
            <Ionicons name="football-outline" size={24} color="white" className="mb-2" />
            <Typography variant="body2" color="white" weight="bold" align="center" className="font-outfit-bold text-center">
              Sports
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/(individual)/community')}
            className="w-[30%] aspect-square rounded-2xl bg-[#4A90E2] p-3 justify-center items-center shadow-sm"
          >
            <Ionicons name="people-outline" size={24} color="white" className="mb-2" />
            <Typography variant="body2" color="white" weight="bold" align="center" className="font-outfit-bold text-center">
              Community
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/(individual)/venues')}
            className="w-[30%] aspect-square rounded-2xl bg-[#F58220] p-3 justify-center items-center shadow-sm"
          >
            <Ionicons name="location-outline" size={24} color="white" className="mb-2" />
            <Typography variant="body2" color="white" weight="bold" align="center" className="font-outfit-bold text-center">
              Venues
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Conditional Display: Booked Sessions (if bookings exist) vs Recommended Coaches (if no bookings) */}
        <View className="px-6 pb-12">
          {hasBookings ? (
            <>
              <View className="flex-row justify-between items-center mb-4">
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold">
                  Booked Sessions
                </Typography>
                <TouchableOpacity onPress={() => router.push('/(individual)/(individual-tabs)/activity')}>
                  <Typography variant="body2" color="primary" weight="bold" className="font-outfit-bold">
                    See All
                  </Typography>
                </TouchableOpacity>
              </View>

              {isLoadingBookings ? (
                <ActivityIndicator size="small" color="#FF5100" />
              ) : (
                allBookings.slice(0, 3).map((booking: any) => {
                  const bookingId = booking._id || booking.id;
                  const coachObj = booking.coachId || booking.coach || {};
                  const coachName = coachObj.name || `${coachObj.firstName || ''} ${coachObj.lastName || ''}`.trim() || booking.coachName || 'Coach';
                  const sport = booking.sport || coachObj.sport || 'Sports Training';
                  const dateStr = booking.date || booking.sessionDate || 'Upcoming Session';
                  const timeStr = booking.time || booking.sessionTime || '';
                  const status = (booking.status || 'confirmed').toUpperCase();

                  return (
                    <TouchableOpacity 
                      key={bookingId}
                      onPress={() => router.push('/(individual)/(individual-tabs)/activity')}
                      activeOpacity={0.8}
                      className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 flex-row items-center"
                    >
                      <View className="w-12 h-12 rounded-xl bg-[#FFF5F0] mr-4 items-center justify-center">
                        <Ionicons name="calendar-outline" size={24} color="#FF5100" />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-1">
                          <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                            {coachName}
                          </Typography>
                          <View className="bg-primary/10 px-2 py-0.5 rounded-md">
                            <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-[10px]">
                              {status}
                            </Typography>
                          </View>
                        </View>
                        <Typography variant="body2" color="muted" className="font-outfit mb-1">
                          {sport}
                        </Typography>
                        <Typography variant="caption" color="secondary" className="font-outfit opacity-80">
                          {dateStr} {timeStr ? `• ${timeStr}` : ''}
                        </Typography>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" className="ml-2" />
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          ) : (
            <>
              <View className="flex-row justify-between items-center mb-4">
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold">
                  Recommended Coaches
                </Typography>
                <TouchableOpacity onPress={() => router.push('/search')}>
                  <Typography variant="body2" color="primary" weight="bold" className="font-outfit-bold">
                    See All
                  </Typography>
                </TouchableOpacity>
              </View>

              {isLoadingCoaches ? (
                <ActivityIndicator size="small" color="#FF5100" />
              ) : coaches.length === 0 ? (
                <Typography variant="body2" color="muted" className="font-outfit italic text-center py-4">
                  No recommended coaches available.
                </Typography>
              ) : (
                coaches.slice(0, 3).map((coach: any) => {
                  const coachId = coach._id || coach.id;
                  const coachName = coach.name || `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || 'Coach';
                  const coachSport = coach.sport || coach.sports?.[0] || 'Sports';
                  const coachInitials = coachName.split(' ').map((n: string) => n[0]).join('');
                  const rating = coach.rating || '4.8';

                  return (
                    <TouchableOpacity 
                      key={coachId}
                      onPress={() => router.push({
                        pathname: '/coach-profile',
                        params: { id: coachId }
                      })}
                      activeOpacity={0.8}
                      className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 flex-row items-center"
                    >
                      <View className="w-14 h-14 rounded-full bg-[#F5E6D3] mr-4 items-center justify-center shadow-sm">
                        <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">
                          {coachInitials}
                        </Typography>
                      </View>
                      <View className="flex-1">
                        <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mb-0.5">
                          {coachName}
                        </Typography>
                        <Typography variant="body2" color="muted" className="font-outfit mb-1">
                          {coachSport}
                        </Typography>
                        <View className="flex-row items-center">
                          <Ionicons name="star" size={14} color="#FFD700" className="mr-1" />
                          <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                            {rating}
                          </Typography>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
        </View>

      </ScrollView>
    </View>
  );
}
