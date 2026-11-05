import React, { useRef, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useNavigation } from 'expo-router';
import { useAuthStore } from '@/store';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { 
  resolveSessionSport, 
  resolveSessionTitle, 
  resolveSessionDate, 
  resolveSessionTime, 
  resolveCoachName 
} from '@/utils/sessionFormatter';
import { normalizeBanners, handleBannerNavigation } from '@/utils/bannerHelpers';

export default function IndividualDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as any, () => {
      if (navigation.isFocused()) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
    return unsubscribe;
  }, [navigation]);

  const { data: coachesResponse, isLoading: isLoadingCoaches } = useQuery({
    queryKey: ['featuredCoaches'],
    queryFn: async () => {
      const res = await api.get('/coaches');
      return res.data;
    }
  });

  const { data: bookingsResponse, isLoading: isLoadingBookings, refetch: refetchBookings } = useQuery({
    queryKey: ['playerBookings'],
    queryFn: async () => {
      const res = await api.get('/bookings/my');
      return res.data;
    }
  });

  const { data: userBannersResponse, refetch: refetchUserBanners } = useQuery({
    queryKey: ['usersBanners'],
    queryFn: async () => {
      try {
        const res = await api.get('/users/banners');
        return res.data;
      } catch (e) {
        return null;
      }
    }
  });

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      refetchBookings();
      refetchUserBanners();
    });
    return unsubscribeFocus;
  }, [navigation, refetchBookings, refetchUserBanners]);

  const coaches = coachesResponse?.data || [];
  const rawBookings = bookingsResponse?.data || bookingsResponse || [];
  const allBookings: any[] = Array.isArray(rawBookings) ? rawBookings : [];
  const hasBookings = allBookings.length > 0;

  // Prioritize active and ongoing sessions, then sort by session date
  const sortedBookings = [...allBookings].sort((a: any, b: any) => {
    const statusWeight: Record<string, number> = {
      ongoing: 1,
      confirmed: 2,
      accepted: 3,
      requested: 4,
      pending: 5,
      completed: 6,
      cancelled: 7,
      no_show: 8
    };
    const wa = statusWeight[String(a.status || '').toLowerCase()] || 50;
    const wb = statusWeight[String(b.status || '').toLowerCase()] || 50;
    if (wa !== wb) return wa - wb;
    const dateA = new Date(a.date || a.slot?.date || a.createdAt || 0).getTime();
    const dateB = new Date(b.date || b.slot?.date || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  const playerBanners = normalizeBanners(userBannersResponse, '/(individual)/search', [], 'individual');

  const [activeBannerIndex, setActiveBannerIndex] = React.useState(0);
  const bannerScrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const BANNER_CARD_GAP = 14;
  const bannerCardWidth = require('react-native').Dimensions.get('window').width - 48;

  useEffect(() => {
    if (playerBanners.length <= 1) return;
    const timer = setInterval(() => {
      const nextIndex = (activeBannerIndex + 1) % playerBanners.length;
      bannerScrollRef.current?.scrollTo({ x: nextIndex * (bannerCardWidth + BANNER_CARD_GAP), animated: true });
      setActiveBannerIndex(nextIndex);
    }, 4000);
    return () => clearInterval(timer);
  }, [activeBannerIndex, playerBanners.length, bannerCardWidth]);

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

        {/* Dynamic Player Banner Carousel (Only rendered when dynamic banners exist in backend) */}
        {playerBanners.length > 0 && (
          <View className="mt-6 mx-6 relative">
            <ScrollView
              ref={bannerScrollRef}
              horizontal
              decelerationRate="fast"
              snapToInterval={bannerCardWidth + BANNER_CARD_GAP}
              snapToAlignment="start"
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const scrollX = e.nativeEvent.contentOffset.x;
                const index = Math.round(scrollX / (bannerCardWidth + BANNER_CARD_GAP));
                setActiveBannerIndex(index);
              }}
              scrollEventThrottle={16}
            >
              {playerBanners.map((banner, index) => (
                <TouchableOpacity 
                  key={banner.id}
                  onPress={() => handleBannerNavigation(banner, router, 'individual')}
                  activeOpacity={0.9}
                  className={`${banner.color} rounded-3xl shadow-sm overflow-hidden relative justify-between`}
                  style={{ 
                    width: bannerCardWidth, 
                    minHeight: 150,
                    height: 150,
                    marginRight: index < playerBanners.length - 1 ? BANNER_CARD_GAP : 0,
                    ...(banner.bgStyle || {})
                  }}
                >
                  {banner.imageUrl ? (
                    <Image 
                      source={{ uri: banner.imageUrl }} 
                      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : null}
                  {(banner.title || banner.desc) ? (
                    <View className="p-5 w-2/3 z-10 flex-1 justify-between bg-black/25">
                      <View>
                        {banner.title ? (
                          <Typography variant="h3" color="white" weight="bold" className="mb-1 font-outfit-bold text-lg">
                            {banner.title}
                          </Typography>
                        ) : null}
                        {banner.desc ? (
                          <Typography variant="caption" color="white" className="mb-3 opacity-90 leading-4 font-outfit text-xs">
                            {banner.desc}
                          </Typography>
                        ) : null}
                      </View>
                      {banner.buttonText ? (
                        <TouchableOpacity 
                          onPress={() => handleBannerNavigation(banner, router, 'individual')}
                          activeOpacity={0.8}
                          className="bg-white px-4 py-2 rounded-full self-start shadow-xs"
                        >
                          <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">{banner.buttonText}</Typography>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                  {!banner.imageUrl && banner.icon && (
                    <View className="absolute -right-4 -bottom-4 opacity-20 pointer-events-none">
                      <Ionicons name={banner.icon as any} size={140} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Carousel Indicator Dots */}
            {playerBanners.length > 1 && (
              <View className="flex-row justify-center items-center mt-3">
                {playerBanners.map((_, i) => (
                  <View 
                    key={i} 
                    className={`h-1.5 rounded-full mx-1 ${activeBannerIndex === i ? 'w-5 bg-primary' : 'w-1.5 bg-gray-300'}`} 
                  />
                ))}
              </View>
            )}
          </View>
        )}

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
                sortedBookings.slice(0, 3).map((booking: any) => {
                  const bookingId = booking._id || booking.id;
                  const coachName = resolveCoachName(booking);
                  const resolvedSport = resolveSessionSport(booking, booking.coach || booking.coachId);
                  const resolvedTitle = resolveSessionTitle(booking, booking.coach || booking.coachId);
                  const resolvedDate = resolveSessionDate(
                    booking.slot?.date || 
                    booking.date || 
                    booking.slotDate || 
                    booking.sessionDate || 
                    booking.startDate || 
                    booking.createdAt
                  );
                  const resolvedTime = resolveSessionTime(booking);
                  const rawStatus = String(booking.status || 'confirmed').toLowerCase();
                  const statusLabel = rawStatus.toUpperCase();

                  const isConfirmed = rawStatus === 'confirmed' || rawStatus === 'accepted';
                  const isOngoing = rawStatus === 'ongoing';
                  const isCompleted = rawStatus === 'completed';
                  const isCancelled = rawStatus === 'cancelled' || rawStatus === 'no_show';

                  const badgeBg = isConfirmed 
                    ? 'bg-green-50 border border-green-200' 
                    : isOngoing 
                      ? 'bg-orange-50 border border-orange-200' 
                      : isCompleted 
                        ? 'bg-emerald-50 border border-emerald-200' 
                        : isCancelled 
                          ? 'bg-red-50 border border-red-200' 
                          : 'bg-primary/10 border border-primary/20';

                  const badgeText = isConfirmed 
                    ? 'text-green-700' 
                    : isOngoing 
                      ? 'text-orange-700' 
                      : isCompleted 
                        ? 'text-emerald-700' 
                        : isCancelled 
                          ? 'text-red-700' 
                          : 'text-primary';

                  const displaySportTitle = resolvedTitle && resolvedTitle.toLowerCase() !== 'coaching session'
                    ? resolvedTitle
                    : `${resolvedSport} Coaching`;

                  return (
                    <TouchableOpacity 
                      key={bookingId}
                      onPress={() => router.push({
                        pathname: '/session-summary',
                        params: {
                          id: bookingId,
                          status: rawStatus,
                          coachSport: resolvedSport,
                          coachName: coachName
                        }
                      })}
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
                          <View className={`px-2 py-0.5 rounded-md ${badgeBg}`}>
                            <Typography variant="caption" weight="bold" className={`font-outfit-bold text-[10px] ${badgeText}`}>
                              {statusLabel}
                            </Typography>
                          </View>
                        </View>
                        <Typography variant="body2" color="primary" weight="bold" className="font-outfit-bold mb-1">
                          {displaySportTitle}
                        </Typography>
                        <Typography variant="caption" color="secondary" className="font-outfit opacity-80">
                          {resolvedDate}{resolvedTime && resolvedTime !== 'Time TBD' ? ` • ${resolvedTime}` : ''}
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
