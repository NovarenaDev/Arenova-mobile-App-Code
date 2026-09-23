import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export default function BookingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming');

  // Fetch bookings list
  const { data: bookingsResponse, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['playerBookings'],
    queryFn: async () => {
      const res = await api.get('/bookings/my');
      return res.data;
    }
  });

  const allBookings = bookingsResponse?.data || [];

  // Filter bookings based on status
  const upcomingBookings = allBookings.filter((b: any) => 
    b.status === 'requested' || 
    b.status === 'accepted' || 
    b.status === 'confirmed' || 
    b.status === 'ongoing'
  );

  const completedBookings = allBookings.filter((b: any) => 
    b.status === 'completed' || 
    b.status === 'cancelled' || 
    b.status === 'no_show'
  );

  const displayBookings = activeTab === 'upcoming' ? upcomingBookings : completedBookings;

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      <View className="px-4 py-4 bg-[#0F2C59] border-b border-gray-100 flex-row justify-between items-center shadow-sm z-10">
        <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold">
          My Bookings
        </Typography>
        <TouchableOpacity onPress={() => refetch()} className="p-1">
          <Ionicons name="refresh" size={20} color="#FF5100" />
        </TouchableOpacity>
      </View>

      <View className="px-4 pt-4 pb-2">
        <View className="flex-row bg-white rounded-full border border-gray-200 overflow-hidden h-12">
          <TouchableOpacity 
            className={`flex-1 justify-center items-center ${activeTab === 'upcoming' ? 'bg-secondary' : 'bg-transparent'}`}
            onPress={() => setActiveTab('upcoming')}
          >
            <Typography variant="subtitle2" color={activeTab === 'upcoming' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold">
              Upcoming
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 justify-center items-center ${activeTab === 'completed' ? 'bg-secondary' : 'bg-transparent'}`}
            onPress={() => setActiveTab('completed')}
          >
            <Typography variant="subtitle2" color={activeTab === 'completed' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold">
              Completed
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading || isRefetching ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FF5100" />
        </View>
      ) : displayBookings.length === 0 ? (
        <View className="flex-1 px-8 pt-20 items-center">
          <View className="w-16 h-16 rounded-full bg-white shadow-sm items-center justify-center mb-4 border border-gray-100">
            <Ionicons name="calendar-outline" size={32} color="#9CA3AF" />
          </View>
          <Typography variant="subtitle1" color="secondary" weight="semibold" className="mb-2 font-outfit-semibold">
            No Bookings Found
          </Typography>
          <Typography variant="body2" color="muted" align="center" className="mb-6 font-outfit">
            You don't have any {activeTab} bookings scheduled at the moment.
          </Typography>
          {activeTab === 'upcoming' && (
            <Button 
              title="Find a Coach" 
              onPress={() => router.push('/search')}
              fullWidth={false}
              className="px-6"
            />
          )}
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          className="flex-1"
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: Math.max(insets.bottom + 110, 130) }}
        >
          {displayBookings.map((booking: any) => {
            const coachName = booking.coach?.name || booking.coachName || 'Coach';
            const coachInitials = coachName.split(' ').map((n: string) => n[0]).join('');
            const statusLabel = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);

            return (
              <View key={booking._id || booking.id} className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
                <View className="flex-row justify-between items-center mb-3 border-b border-gray-100 pb-3">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-[#F5E6D3] mr-3 items-center justify-center shadow-sm">
                      <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold">
                        {coachInitials}
                      </Typography>
                    </View>
                    <View>
                      <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                        {coachName}
                      </Typography>
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                        {booking.sport || 'Sports'}
                      </Typography>
                    </View>
                  </View>
                  <View className={`px-2.5 py-1 rounded-md ${
                    booking.status === 'confirmed' || booking.status === 'accepted'
                      ? 'bg-green-50 border border-green-100' 
                      : booking.status === 'completed' 
                        ? 'bg-emerald-50 border border-emerald-100' 
                        : 'bg-orange-50 border border-orange-100'
                  }`}>
                    <Typography 
                      variant="caption" 
                      className={`${
                        booking.status === 'confirmed' || booking.status === 'accepted'
                          ? 'text-green-700' 
                          : booking.status === 'completed' 
                            ? 'text-emerald-700' 
                            : 'text-orange-700'
                      } font-outfit-bold text-[11px]`} 
                      weight="bold"
                    >
                      {statusLabel}
                    </Typography>
                  </View>
                </View>

                <View className="flex-row justify-between items-center mb-4">
                  <View className="flex-row items-center">
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" className="mr-2" />
                    <Typography variant="body2" color="text" className="font-outfit">{booking.date}</Typography>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={16} color="#6B7280" className="mr-2" />
                    <Typography variant="body2" color="text" className="font-outfit">{booking.time}</Typography>
                  </View>
                </View>

                <View className="flex-row justify-end mt-1">
                  <View className="w-36">
                    <Button 
                      title="View Details" 
                      variant="outline" 
                      size="sm"
                      onPress={() => router.push({
                        pathname: '/session-summary',
                        params: { id: booking._id || booking.id, status: booking.status }
                      })}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
