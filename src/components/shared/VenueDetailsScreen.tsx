import React from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export default function VenueDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Fetch venue detail by ID
  const { data: venueResponse, isLoading, error } = useQuery({
    queryKey: ['venueDetail', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/venues/${id}`);
      return res.data?.data || res.data;
    },
    enabled: !!id
  });

  const venue = venueResponse;
  const image = venue?.imageUrl || venue?.image || 'https://images.unsplash.com/photo-1517649763962-0c623266010b?w=800&auto=format&fit=crop&q=80';

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F9] justify-center items-center">
        <ActivityIndicator size="large" color="#FF5100" />
        <Typography variant="body2" color="muted" className="mt-2 font-outfit">
          Loading venue details...
        </Typography>
      </SafeAreaView>
    );
  }

  if (error || !venue) {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F9] justify-center items-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" className="mb-2" />
        <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-2">
          Venue Not Found
        </Typography>
        <Typography variant="body2" color="muted" align="center" className="font-outfit mb-6">
          Unable to load venue information.
        </Typography>
        <Button title="Go Back" onPress={() => { try { router.back(); } catch (e) { router.replace('/'); } }} fullWidth={false} className="px-6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View className="px-4 py-3 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity 
          onPress={() => {
            try {
              router.back();
            } catch (e) {
              router.replace('/');
            }
          }} 
          className="p-2 -ml-2"
        >
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold flex-1 text-center mx-2" numberOfLines={1}>
          {venue.name || 'Venue Details'}
        </Typography>
        <TouchableOpacity className="p-2 -mr-2">
          <Ionicons name="share-social-outline" size={22} color="#0F2C59" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 80, 100) }}
      >
        <View className="h-56 bg-secondary relative">
          <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
          <View className="absolute top-4 right-4 bg-white/90 px-3 py-1.5 rounded-full flex-row items-center shadow-md">
            <Ionicons name="star" size={14} color="#FFD700" className="mr-1" />
            <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
              {venue.rating || '4.8'}
            </Typography>
          </View>
        </View>

        <View className="px-5 pt-5">
          <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold mb-1">
            {venue.name}
          </Typography>

          <View className="flex-row items-center mb-5">
            <Ionicons name="location" size={18} color="#4A90E2" className="mr-1.5" />
            <Typography variant="body2" color="muted" className="font-outfit">
              {venue.address || venue.location || venue.city || 'Sports Location'}
            </Typography>
          </View>

          {/* Key Specs Card */}
          <View className="bg-white rounded-3xl p-5 mb-5 border border-gray-100 shadow-sm flex-row justify-around">
            <View className="items-center">
              <Typography variant="caption" color="muted" className="font-outfit">Rate</Typography>
              <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold mt-0.5">
                {venue.pricePerHour !== undefined ? `₹${venue.pricePerHour}/hr` : '₹500/hr'}
              </Typography>
            </View>
            <View className="w-[1px] h-8 bg-gray-200" />
            <View className="items-center">
              <Typography variant="caption" color="muted" className="font-outfit">Hours</Typography>
              <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mt-0.5">
                {venue.openTime && venue.closeTime ? `${venue.openTime} - ${venue.closeTime}` : '6 AM - 10 PM'}
              </Typography>
            </View>
            <View className="w-[1px] h-8 bg-gray-200" />
            <View className="items-center">
              <Typography variant="caption" color="muted" className="font-outfit">Status</Typography>
              <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mt-0.5 text-emerald-600">
                {venue.isAvailable !== false ? 'Available' : 'Booked'}
              </Typography>
            </View>
          </View>

          {/* Supported Sports */}
          {Array.isArray(venue.sports) && venue.sports.length > 0 && (
            <View className="bg-white rounded-3xl p-5 mb-5 border border-gray-100 shadow-sm">
              <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-3 font-outfit-bold">
                Supported Sports
              </Typography>
              <View className="flex-row flex-wrap gap-2">
                {venue.sports.map((sport: string, i: number) => (
                  <View key={i} className="bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-full">
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                      {sport}
                    </Typography>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Amenities */}
          {Array.isArray(venue.amenities) && venue.amenities.length > 0 && (
            <View className="bg-white rounded-3xl p-5 mb-5 border border-gray-100 shadow-sm">
              <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-3 font-outfit-bold">
                Amenities & Facilities
              </Typography>
              <View className="flex-row flex-wrap gap-2">
                {venue.amenities.map((item: string, i: number) => (
                  <View key={i} className="bg-gray-100 px-3 py-1.5 rounded-full flex-row items-center">
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" className="mr-1.5" />
                    <Typography variant="caption" color="secondary" weight="medium" className="font-outfit">
                      {item}
                    </Typography>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View 
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 pt-4 flex-row items-center justify-between shadow-2xl z-20"
        style={{ paddingBottom: Math.max(insets.bottom + 12, 18) }}
      >
        <View>
          <Typography variant="caption" color="muted" className="font-outfit">Price</Typography>
          <Typography variant="h2" color="primary" weight="bold" className="font-outfit-bold">
            {venue.pricePerHour !== undefined ? `₹${venue.pricePerHour}/hr` : '₹500/hr'}
          </Typography>
        </View>

        <Button
          title="Book Session Here"
          onPress={() => router.push({ pathname: '/search' })}
          fullWidth={false}
          className="px-8"
        />
      </View>
    </SafeAreaView>
  );
}
