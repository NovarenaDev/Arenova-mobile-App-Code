import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

const DEFAULT_VENUE_IMAGES = [
  'https://images.unsplash.com/photo-1517649763962-0c623266010b?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80'
];

export default function VenuesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch active venues
  const { data: venuesData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['activeVenues'],
    queryFn: async () => {
      const res = await api.get('/venues');
      return res.data?.data || res.data;
    }
  });

  const rawVenues = Array.isArray(venuesData) ? venuesData : (venuesData?.venues || venuesData?.data || []);

  const filteredVenues = rawVenues.filter((v: any) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = (v.name || '').toLowerCase().includes(query);
    const locationMatch = (v.location || v.city || v.address || '').toLowerCase().includes(query);
    return nameMatch || locationMatch;
  });

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 bg-[#0F2C59] border-b border-gray-100 flex-row justify-between items-center shadow-sm">
        <TouchableOpacity 
          onPress={() => {
            try {
              router.back();
            } catch (e) {
              router.replace('/');
            }
          }} 
          className="p-2 -ml-2 mr-2"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1 mr-2">
          <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold">
            Sports Venues
          </Typography>
          <Typography variant="caption" color="light" className="opacity-80 font-outfit">
            Explore active arenas, courts, and training facilities
          </Typography>
        </View>
        <TouchableOpacity onPress={() => refetch()} className="p-2 bg-white/10 rounded-full">
          <Ionicons name="refresh" size={20} color="#FF5100" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 40, 60) }}
      >
        {/* Search Bar */}
        <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 border border-gray-200 shadow-sm mb-5">
          <Ionicons name="search" size={20} color="#9CA3AF" className="mr-2" />
          <TextInput
            placeholder="Search venue name, location, or city..."
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

        {isLoading || isRefetching ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#FF5100" />
            <Typography variant="body2" color="muted" className="mt-2 font-outfit">
              Loading sports venues...
            </Typography>
          </View>
        ) : filteredVenues.length === 0 ? (
          <View className="bg-white rounded-3xl p-6 items-center border border-gray-100 shadow-sm my-4">
            <View className="w-20 h-20 rounded-full bg-[#FFF5F0] items-center justify-center mb-4">
              <Ionicons name="location-outline" size={40} color="#FF5100" />
            </View>
            <Typography variant="h3" color="secondary" weight="bold" align="center" className="mb-2 font-outfit-bold">
              No Venues Found
            </Typography>
            <Typography variant="body2" color="muted" align="center" className="mb-6 font-outfit leading-5 px-2">
              No active sports venues found matching your search.
            </Typography>
            <Button title="Refresh List" onPress={() => refetch()} fullWidth={false} className="px-6" />
          </View>
        ) : (
          <View className="pb-8">
            {filteredVenues.map((venue: any, idx: number) => {
              const vId = venue._id || venue.id || idx.toString();
              const name = venue.name || 'Sports Arena';
              const locationStr = venue.location || venue.city || venue.address || 'Sports Complex';
              const price = venue.pricePerHour !== undefined ? `₹${venue.pricePerHour}/hr` : (venue.price ? `₹${venue.price}` : 'Available');
              const rating = venue.rating || '4.8';
              const image = venue.imageUrl || venue.image || DEFAULT_VENUE_IMAGES[idx % DEFAULT_VENUE_IMAGES.length];
              const amenities = venue.amenities || [];

              return (
                <TouchableOpacity
                  key={vId}
                  onPress={() => router.push({
                    pathname: '/venue-details',
                    params: { id: vId }
                  })}
                  activeOpacity={0.85}
                  className="bg-white rounded-3xl mb-5 border border-gray-100 shadow-sm overflow-hidden"
                >
                  <View className="h-44 bg-secondary relative">
                    <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
                    <View className="absolute top-3 right-3 bg-white/90 px-3 py-1 rounded-full flex-row items-center shadow-sm">
                      <Ionicons name="star" size={14} color="#FFD700" className="mr-1" />
                      <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                        {rating}
                      </Typography>
                    </View>
                  </View>

                  <View className="p-5">
                    <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-1">
                      {name}
                    </Typography>

                    <View className="flex-row items-center mb-3">
                      <Ionicons name="location" size={16} color="#4A90E2" className="mr-1.5" />
                      <Typography variant="body2" color="muted" className="font-outfit" numberOfLines={1}>
                        {locationStr}
                      </Typography>
                    </View>

                    {/* Amenities chips */}
                    {Array.isArray(amenities) && amenities.length > 0 && (
                      <View className="flex-row flex-wrap gap-1.5 mb-4">
                        {amenities.slice(0, 3).map((item: string, i: number) => (
                          <View key={i} className="bg-gray-100 px-2.5 py-1 rounded-full">
                            <Typography variant="caption" color="secondary" className="font-outfit text-[11px]">
                              {item}
                            </Typography>
                          </View>
                        ))}
                      </View>
                    )}

                    <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
                      <View>
                        <Typography variant="caption" color="muted" className="font-outfit">Pricing</Typography>
                        <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">
                          {price}
                        </Typography>
                      </View>

                      <TouchableOpacity 
                        onPress={() => router.push({
                          pathname: '/venue-details',
                          params: { id: vId }
                        })}
                        className="bg-secondary px-5 py-2.5 rounded-full flex-row items-center"
                      >
                        <Typography variant="body2" color="white" weight="bold" className="font-outfit-bold mr-1">
                          View Arena
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
