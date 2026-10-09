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

  // Fetch User/Player Banners from backend API
  const { data: userBannersResponse } = useQuery({
    queryKey: ['usersBanners'],
    queryFn: async () => {
      try {
        const res = await api.get('/users/banners');
        return res.data?.banners || res.data?.data || res.data;
      } catch (e) {
        return null;
      }
    }
  });

  const defaultPlayerBanners = [
    {
      id: '1',
      title: 'Learn From Expert Coaches',
      desc: 'Book 1-on-1 training slots with certified sports trainers near you.',
      color: 'bg-primary',
      icon: 'ribbon',
      route: '/(individual)/search',
      buttonText: 'Book Session'
    },
    {
      id: '2',
      title: 'Explore Sports Venues',
      desc: 'Discover and reserve premium turfs, courts, and training complexes.',
      color: 'bg-[#4B9C73]',
      icon: 'location',
      route: '/(individual)/venues',
      buttonText: 'Find Venues'
    },
    {
      id: '3',
      title: 'Join Community Matches',
      desc: 'Connect with local players, form teams, and join competitive games.',
      color: 'bg-[#0F2C59]',
      icon: 'people',
      route: '/(individual)/community',
      buttonText: 'Join Community'
    }
  ];

  const serverPlayerBanners = Array.isArray(userBannersResponse) ? userBannersResponse.map((b: any, idx: number) => ({
    id: b._id || b.id || idx.toString(),
    title: b.title || b.name || 'Sports Update',
    desc: b.description || b.desc || b.subtitle || 'Discover sports, venues, and coaches.',
    color: idx % 3 === 0 ? 'bg-primary' : idx % 3 === 1 ? 'bg-[#4B9C73]' : 'bg-[#0F2C59]',
    icon: idx % 3 === 0 ? 'ribbon' : idx % 3 === 1 ? 'location' : 'people',
    route: b.route || b.link || b.targetUrl || '/(individual)/search',
    buttonText: b.buttonText || b.ctaText || 'Explore Now',
    imageUrl: b.imageUrl || b.image
  })) : [];

  const playerBanners = serverPlayerBanners.length > 0 ? serverPlayerBanners : defaultPlayerBanners;

  const [activeBannerIndex, setActiveBannerIndex] = React.useState(0);
  const bannerScrollRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = (activeBannerIndex + 1) % playerBanners.length;
      const width = require('react-native').Dimensions.get('window').width - 48;
      bannerScrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
      setActiveBannerIndex(nextIndex);
    }, 3500);
    return () => clearInterval(timer);
  }, [activeBannerIndex, playerBanners.length]);

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

        {/* Dynamic Player Banner Carousel */}
        <View className="mt-6 mx-6 relative">
          <ScrollView
            ref={bannerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slideSize = e.nativeEvent.layoutMeasurement.width;
              if (slideSize > 0) {
                const index = e.nativeEvent.contentOffset.x / slideSize;
                setActiveBannerIndex(Math.round(index));
              }
            }}
            scrollEventThrottle={16}
          >
            {playerBanners.map((banner) => (
              <View 
                key={banner.id}
                className={`${banner.color} rounded-3xl p-5 shadow-sm overflow-hidden relative justify-between`}
                style={{ width: require('react-native').Dimensions.get('window').width - 48, minHeight: 150 }}
              >
                <View className="w-2/3 z-10">
                  <Typography variant="h3" color="white" weight="bold" className="mb-1 font-outfit-bold text-lg">
                    {banner.title}
                  </Typography>
                  <Typography variant="caption" color="white" className="mb-3 opacity-90 leading-4 font-outfit text-xs">
                    {banner.desc}
                  </Typography>
                  <TouchableOpacity 
                    onPress={() => router.push(banner.route as any)}
                    activeOpacity={0.8}
                    className="bg-white px-4 py-2 rounded-full self-start shadow-xs"
                  >
                    <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">{banner.buttonText}</Typography>
                  </TouchableOpacity>
                </View>
                <View className="absolute -right-4 -bottom-4 opacity-20 pointer-events-none">
                  <Ionicons name={banner.icon as any} size={140} color="white" />
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Carousel Indicator Dots */}
          <View className="flex-row justify-center items-center mt-3">
            {playerBanners.map((_, i) => (
              <View 
                key={i} 
                className={`h-1.5 rounded-full mx-1 ${activeBannerIndex === i ? 'w-5 bg-primary' : 'w-1.5 bg-gray-300'}`} 
              />
            ))}
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
