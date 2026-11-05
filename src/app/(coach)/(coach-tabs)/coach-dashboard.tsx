import React, { useRef, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';
import { resolveSessionTime, resolveSessionDate, resolveSessionSport, resolveSessionTitle, resolveSessionLocation, resolveStudentName, formatSingleTime } from '@/utils/sessionFormatter';
import { normalizeBanners, handleBannerNavigation } from '@/utils/bannerHelpers';
import * as Location from 'expo-location';

export default function CoachDashboard() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as any, () => {
      if (navigation.isFocused()) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
    return unsubscribe;
  }, [navigation]);

  const [metricsModalVisible, setMetricsModalVisible] = React.useState(false);
  const [selectedMetricTab, setSelectedMetricTab] = React.useState<'earnings' | 'sessions' | 'rating'>('earnings');

  const [selectedProgramForSubscribers, setSelectedProgramForSubscribers] = React.useState<string | null>(null);
  const [selectedProgramTitle, setSelectedProgramTitle] = React.useState<string>('Program');
  const [subscribersModalVisible, setSubscribersModalVisible] = React.useState(false);
  const [earningsHistoryModalVisible, setEarningsHistoryModalVisible] = React.useState(false);
  const [activeSessionProgramId, setActiveSessionProgramId] = React.useState<string | null>(null);
  const [startingAttendanceLoading, setStartingAttendanceLoading] = React.useState<string | null>(null);
  const [endingAttendanceLoading, setEndingAttendanceLoading] = React.useState<string | null>(null);

  const { selectedLocationId, user } = useAuthStore();

  const { data: locationsResponse } = useQuery({
    queryKey: ['coachLocations'],
    queryFn: async () => {
      const res = await api.get('/coach-app/locations');
      return res.data;
    }
  });

  const locations = locationsResponse?.data || [];
  const activeLocation = locations.find((loc: any) => loc._id === selectedLocationId || loc.id === selectedLocationId) || locations[0];

  const { data: notificationsResponse } = useQuery({
    queryKey: ['notificationsCount'],
    queryFn: async () => {
      const res = await api.get('/notifications', { params: { page: 1, limit: 1, unread: 'true' } });
      return res.data;
    }
  });

  const unreadCount = notificationsResponse?.unreadCount ?? 0;

  const { data: dashboardData, refetch: refetchDashboard } = useQuery({
    queryKey: ['coachDashboard'],
    queryFn: async () => {
      const res = await api.get('/coach-app/dashboard');
      return res.data;
    }
  });

  const { data: walletSummaryResponse, refetch: refetchWalletSummary } = useQuery({
    queryKey: ['walletSummary'],
    queryFn: async () => {
      try {
        const res = await api.get('/wallet/summary');
        return res.data;
      } catch {
        return null;
      }
    }
  });

  const { data: segmentedSessions } = useQuery({
    queryKey: ['segmentedSessions'],
    queryFn: async () => {
      const res = await api.get('/coach-app/sessions/segmented');
      return res.data;
    }
  });

  const queryClient = useQueryClient();

  const { data: allSessionsResponse } = useQuery({
    queryKey: ['coachSessions'],
    queryFn: async () => {
      const res = await api.get('/coaches/my/sessions');
      return res.data?.data || res.data || [];
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.put(`/coaches/my/sessions/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['coachSessions'] });
      queryClient.invalidateQueries({ queryKey: ['coachDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['segmentedSessions'] });
      if (variables.status === 'accepted') {
        alert('Booking Request Accepted! Moved to Upcoming Sessions.');
      } else if (variables.status === 'cancelled') {
        alert('Booking Request Declined.');
      }
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || 'Failed to update session status');
    }
  });

  const { data: communitiesResponse, refetch: refetchCommunities } = useQuery({
    queryKey: ['coachCommunities'],
    queryFn: async () => {
      try {
        const res = await api.get('/coach-app/communities');
        return res.data;
      } catch (e) {
        console.log('Communities API fetch error:', e);
        return null;
      }
    }
  });

  const { data: earningsHistoryResponse } = useQuery({
    queryKey: ['coachEarningsHistory'],
    queryFn: async () => {
      try {
        const res = await api.get('/coach-app/salary-history');
        return res.data;
      } catch (e) {
        try {
          const res2 = await api.get('/coach-app/earnings-history');
          return res2.data;
        } catch {
          return null;
        }
      }
    }
  });

  const { data: subscribersResponse, isLoading: isLoadingSubscribers } = useQuery({
    queryKey: ['programSubscribers', selectedProgramForSubscribers],
    queryFn: async () => {
      if (!selectedProgramForSubscribers) return null;
      try {
        const res = await api.get(`/coach-app/programs/${selectedProgramForSubscribers}/subscribers`);
        return res.data;
      } catch (e) {
        console.log('Subscribers API fetch error:', e);
        return null;
      }
    },
    enabled: !!selectedProgramForSubscribers
  });

  const handleStartAttendance = async (programId: string) => {
    try {
      setStartingAttendanceLoading(programId);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('GPS location permission is required to start community session attendance.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;

      await api.post(`/coach-app/programs/${programId}/attendance/start`, {
        latitude,
        longitude
      });
      setActiveSessionProgramId(programId);
      refetchCommunities();
      alert('Community Session Started with GPS Check-in!');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to start GPS attendance for community program.';
      alert(msg);
    } finally {
      setStartingAttendanceLoading(null);
    }
  };

  const handleEndAttendance = async (programId: string) => {
    try {
      setEndingAttendanceLoading(programId);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('GPS location permission is required to end community session attendance.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;

      await api.post(`/coach-app/programs/${programId}/attendance/end`, {
        latitude,
        longitude
      });
      setActiveSessionProgramId(null);
      refetchCommunities();
      alert('Community Session Ended successfully!');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to end GPS attendance for community program.';
      alert(msg);
    } finally {
      setEndingAttendanceLoading(null);
    }
  };

  const displayCommunities = Array.isArray(communitiesResponse?.data) 
    ? communitiesResponse.data 
    : Array.isArray(communitiesResponse) 
    ? communitiesResponse 
    : [];

  const displayEarningsHistory = Array.isArray(earningsHistoryResponse?.data) 
    ? earningsHistoryResponse.data 
    : Array.isArray(earningsHistoryResponse?.earnings)
    ? earningsHistoryResponse.earnings
    : Array.isArray(earningsHistoryResponse?.history)
    ? earningsHistoryResponse.history
    : Array.isArray(earningsHistoryResponse) 
    ? earningsHistoryResponse 
    : [];

  const displaySubscribers = Array.isArray(subscribersResponse?.data) 
    ? subscribersResponse.data 
    : Array.isArray(subscribersResponse) 
    ? subscribersResponse 
    : [];

  const openSubscribersModal = (programId: string, programTitle: string) => {
    setSelectedProgramForSubscribers(programId);
    setSelectedProgramTitle(programTitle);
    setSubscribersModalVisible(true);
  };

  const openMetricsModal = (tab: 'earnings' | 'sessions' | 'rating') => {
    setSelectedMetricTab(tab);
    setMetricsModalVisible(true);
  };

  const metrics = dashboardData?.data?.metrics;
  const avgRating = metrics?.averageRating ?? 0;

  const walletSummary = walletSummaryResponse?.data || walletSummaryResponse;
  const availableBalance = Number(
    walletSummary?.availableBalance ?? 
    walletSummary?.currentBalance ?? 
    walletSummary?.balance ?? 
    metrics?.availableBalance ?? 
    0
  );
  const pendingBalance = Number(
    walletSummary?.pendingBalance ?? 
    walletSummary?.heldBalance ?? 
    metrics?.pendingBalance ?? 
    0
  );
  const totalEarnings = Number(
    walletSummary?.totalEarnings ?? 
    walletSummary?.earnings ?? 
    metrics?.totalEarnings ?? 
    (availableBalance + pendingBalance)
  );

  const mapSessionToUI = (session: any) => {
    const id = session._id || session.id || Math.random().toString();
    const coachUser = useAuthStore.getState().user;
    const studentName = resolveStudentName(session);
    const sessionTitle = resolveSessionTitle(session, coachUser);
    const sportTitle = resolveSessionSport(session, coachUser);
    const dateFormatted = resolveSessionDate(
      session.slot?.date || 
      session.date || 
      session.slotDate || 
      session.startDate || 
      session.bookingDate || 
      session.createdAt
    );
    const timeFormatted = resolveSessionTime(session);
    const locationName = resolveSessionLocation(session, coachUser);

    const numericPrice = 
      session.amountInr || 
      session.amount || 
      session.slot?.pricePerPerson || 
      session.slot?.price || 
      session.price || 
      session.program?.price ||
      (coachUser as any)?.pricePerSession ||
      (coachUser as any)?.fee ||
      (coachUser as any)?.price ||
      0;

    const priceText = session.credits 
      ? `${session.credits} Credits` 
      : (numericPrice > 0 ? `₹${numericPrice}` : 'Free');

    const normStatus = getNormalizedStatus(session);

    let uiStatus = 'Requested';
    if (normStatus === 'ongoing') uiStatus = 'Ongoing';
    else if (normStatus === 'accepted') uiStatus = 'Confirmed';
    else if (normStatus === 'completed') uiStatus = 'Completed';
    else if (normStatus === 'cancelled') uiStatus = 'Cancelled';
    else uiStatus = 'Requested';

    return {
      id,
      name: studentName,
      title: sessionTitle,
      sport: sportTitle,
      subtitle: `${sessionTitle || sportTitle} • ${priceText}`,
      price: numericPrice.toString(),
      startedAt: session.startedAt ? formatSingleTime(session.startedAt) : undefined,
      date: dateFormatted,
      time: timeFormatted,
      location: locationName,
      status: uiStatus,
      rawStatus: normStatus,
      delayStatus: session.delayStatus || '',
      delayMinutes: session.delayMinutes || 0
    };
  };

  const dedupe = (list: any[]) => {
    const seenIds = new Set();
    return list.filter(item => {
      if (!item.id || seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
  };

  const getNormalizedStatus = (s: any) => {
    if (!s) return 'requested';
    const st = (
      s.status || 
      s.rawStatus || 
      s.bookingStatus || 
      s.slotStatus || 
      s.state || 
      s.slot?.status || 
      ''
    ).toString().toLowerCase().trim();

    if (st === 'completed' || st === 'done' || st === 'finished' || st === 'ended') return 'completed';
    if (st === 'cancelled' || st === 'canceled' || st === 'declined' || st === 'rejected' || st === 'no_show' || st === 'no-show') return 'cancelled';
    if (
      st === 'ongoing' || 
      st === 'active' || 
      st === 'started' || 
      st === 'in_progress' || 
      st === 'in-progress' || 
      st === 'session_started' || 
      st === 'live' ||
      s.attendanceVerified === true ||
      s.attendanceStatus?.toString().toLowerCase() === 'verified' ||
      (!!s.startedAt && !s.endedAt)
    ) {
      return 'ongoing';
    }
    if (st === 'confirmed' || st === 'accepted' || st === 'approved' || st === 'upcoming') return 'accepted';
    
    return 'requested';
  };

  // Merge sessions from all available endpoints (dashboard, segmented, my sessions) to ensure full data
  const rawDashboardUpcoming = Array.isArray(dashboardData?.data?.upcomingSessions) ? dashboardData.data.upcomingSessions : [];
  const rawDashboardActive = Array.isArray(dashboardData?.data?.activeSessions) ? dashboardData.data.activeSessions : [];
  const rawSegmentedUpcoming = Array.isArray(segmentedSessions?.data?.upcoming) ? segmentedSessions.data.upcoming : [];
  const rawSegmentedCurrent = Array.isArray(segmentedSessions?.data?.current) ? segmentedSessions.data.current : [];
  const rawSegmentedCompleted = Array.isArray(segmentedSessions?.data?.completed) ? segmentedSessions.data.completed : [];
  const rawMySessions = Array.isArray(allSessionsResponse) ? allSessionsResponse : (Array.isArray(allSessionsResponse?.data) ? allSessionsResponse.data : []);

  const sessionMap = new Map<string, any>();

  const registerSession = (s: any, defaultStatus?: string) => {
    if (!s) return;
    const sid = s._id || s.id;
    if (!sid) return;
    const prev = sessionMap.get(sid) || {};

    let chosenStatus = s.status || prev.status || defaultStatus;
    if (defaultStatus === 'ongoing' || prev.status === 'ongoing') {
      chosenStatus = 'ongoing';
    } else if (defaultStatus === 'completed' || prev.status === 'completed') {
      chosenStatus = 'completed';
    }

    sessionMap.set(sid, {
      ...prev,
      ...s,
      status: chosenStatus,
      slot: (typeof s.slot === 'object' && s.slot) ? s.slot : (prev.slot || s.slot),
      user: (typeof s.user === 'object' && s.user) ? s.user : (prev.user || s.user),
      child: (typeof s.child === 'object' && s.child) ? s.child : (prev.child || s.child),
      studentName: s.studentName || prev.studentName,
      time: (s.time && s.time !== 'Scheduled Time' && s.time !== 'Time TBD') ? s.time : (prev.time || s.time),
      endTime: s.endTime || prev.endTime,
      startTime: s.startTime || prev.startTime,
      title: s.title || prev.title,
      sport: (s.sport && s.sport !== 'Badminton') ? s.sport : (prev.sport || s.sport),
      date: s.date || prev.date || s.startDate || prev.startDate,
      location: s.location || prev.location
    });
  };

  rawDashboardUpcoming.forEach((s: any) => registerSession(s, 'upcoming'));
  rawDashboardActive.forEach((s: any) => registerSession(s, 'ongoing'));
  rawSegmentedUpcoming.forEach((s: any) => registerSession(s, 'upcoming'));
  rawSegmentedCurrent.forEach((s: any) => registerSession(s, 'ongoing'));
  rawSegmentedCompleted.forEach((s: any) => registerSession(s, 'completed'));
  rawMySessions.forEach((s: any) => registerSession(s));

  const rawSessions = Array.from(sessionMap.values());

  const upcomingSessionsList = dedupe(rawSessions.filter((s: any) => {
    const st = getNormalizedStatus(s);
    return st === 'requested' || st === 'accepted';
  }).map(mapSessionToUI));
  const currentSessionsList = dedupe(rawSessions.filter((s: any) => getNormalizedStatus(s) === 'ongoing').map(mapSessionToUI));
  const completedSessionsList = dedupe(rawSessions.filter((s: any) => getNormalizedStatus(s) === 'completed').map(mapSessionToUI));

  const learningTips = [
    {
      id: '1',
      title: '10 Tips Engage',
      subtitle: 'Young Students In Sports Training',
      description: 'discover effective strategies to keep kids engaged and motivated during ses',
      imageBg: 'bg-[#FFEAE1]'
    },
    {
      id: '2',
      title: '10 Tips Engage',
      subtitle: 'Young Students In Sports Training',
      description: 'discover effective strategies to keep kids engaged and motivated during ses',
      imageBg: 'bg-[#FFEAE1]'
    }
  ];

  const { data: coachBannersResponse, refetch: refetchCoachBanners } = useQuery({
    queryKey: ['coachAppBanners'],
    queryFn: async () => {
      try {
        const res = await api.get('/coach-app/banners');
        return res.data;
      } catch (e) {
        return null;
      }
    }
  });

  const banners = normalizeBanners(coachBannersResponse, '/(coach)/(coach-tabs)/schedule', [], 'coach');

  const [activeBannerIndex, setActiveBannerIndex] = React.useState(0);
  const bannerScrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);

  React.useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      refetchDashboard();
      refetchWalletSummary();
      refetchCoachBanners();
    });
    return unsubscribeFocus;
  }, [navigation, refetchDashboard, refetchWalletSummary, refetchCoachBanners]);

  const BANNER_CARD_GAP = 14;
  const bannerCardWidth = require('react-native').Dimensions.get('window').width - 48;

  React.useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      const nextIndex = (activeBannerIndex + 1) % banners.length;
      bannerScrollRef.current?.scrollTo({ x: nextIndex * (bannerCardWidth + BANNER_CARD_GAP), animated: true });
      setActiveBannerIndex(nextIndex);
    }, 4000);
    return () => clearInterval(timer);
  }, [activeBannerIndex, banners.length, bannerCardWidth]);

  return (
    <View className="flex-1 bg-[#EEF3F9]">
      {/* Sticky Header Section */}
      <View className="z-10">
        <View className="bg-secondary pt-14 pb-14 rounded-b-3xl px-6 shadow-sm relative overflow-hidden">
          {/* Header Row (Left: Location, Right: Settings & Notifications) */}
          <View className="flex-row items-center justify-between mb-4">
            {/* Active Location Display on the Left */}
            <TouchableOpacity 
              onPress={() => router.push('/locations')}
              className="flex-row items-center bg-white border border-gray-100 shadow-sm px-3.5 py-1.5 rounded-full active:opacity-75"
              activeOpacity={0.8}
            >
              <Ionicons name="location-sharp" size={14} color="#FF5100" />
              <Typography variant="caption" color="secondary" weight="semibold" className="ml-1 mr-1 max-w-[120px] font-outfit-semibold text-[11px]" numberOfLines={1}>
                {activeLocation ? activeLocation.name : "Select Location"}
              </Typography>
              <Ionicons name="chevron-down" size={10} color="#0F2C59" />
            </TouchableOpacity>

            {/* Sticky Header Icons */}
            <View className="flex-row items-center">
              <TouchableOpacity className="p-1 mr-3" onPress={() => router.push('/(coach)/wallet' as any)}>
                <Ionicons name="wallet-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity className="relative p-1 mr-3" onPress={() => router.push('/notifications')}>
                <Ionicons name="notifications-outline" size={24} color="white" />
                {unreadCount > 0 && (
                  <View className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border border-secondary" />
                )}
              </TouchableOpacity>
              <TouchableOpacity className="p-1" onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Coach Welcome Info */}
          <Typography variant="h1" color="white" weight="bold" className="font-outfit-bold text-2xl mb-1">
            Welcome back, {user?.name || 'Coach'}!
          </Typography>
          <Typography variant="body2" color="white" className="opacity-80 font-outfit text-xs leading-4">
            Manage your sessions, track student attendance, and grow your earnings.
          </Typography>
        </View>

        {/* Metrics Cards (Overlapping header) */}
        <View className="px-6 -mt-8 mb-4 flex-row justify-between gap-3">
          <TouchableOpacity 
            onPress={() => openMetricsModal('earnings')}
            className="flex-1 py-3 px-1 rounded-xl bg-[#4B9C73] justify-center items-center"
            activeOpacity={0.8}
            style={{
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.2,
              shadowRadius: 5,
              elevation: 4
            }}
          >
            <Typography variant="subtitle1" color="white" weight="bold" className="mb-0.5">
              ₹{totalEarnings}
            </Typography>
            <Typography variant="caption" color="white" className="text-center opacity-90 text-[10px]">Total{'\n'}Earnings</Typography>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => openMetricsModal('sessions')}
            className="flex-1 py-3 px-1 rounded-xl bg-[#4A90E2] justify-center items-center"
            activeOpacity={0.8}
            style={{
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.2,
              shadowRadius: 5,
              elevation: 4
            }}
          >
            <Typography variant="subtitle1" color="white" weight="bold" className="mb-0.5">
              {metrics?.weeklySessionsCompleted ?? 0}/{metrics?.weeklySessionsTotal ?? 0}
            </Typography>
            <Typography variant="caption" color="white" className="text-center opacity-90 text-[10px]">Sessions{'\n'}This Week</Typography>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => openMetricsModal('rating')}
            className="flex-1 py-3 px-1 rounded-xl bg-[#F58220] justify-center items-center"
            activeOpacity={0.8}
            style={{
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.2,
              shadowRadius: 5,
              elevation: 4
            }}
          >
            <Typography variant="subtitle1" color="white" weight="bold" className="mb-0.5">
              {avgRating > 0 ? avgRating.toFixed(1) : '0.0'}
            </Typography>
            <View className="flex-row mb-0.5">
              {[1,2,3,4,5].map(i => (
                <Ionicons 
                  key={i} 
                  name="star" 
                  size={8} 
                  color={i <= Math.round(avgRating) ? "#FFD700" : "#D1D5DB"} 
                  className="mx-[1px]" 
                />
              ))}
            </View>
            <Typography variant="caption" color="white" className="text-center opacity-90 text-[10px]">Avg Rating</Typography>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} scrollEventThrottle={16} decelerationRate="normal" className="flex-1 pt-2" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 40, 60) }}>
        {/* Dynamic Coach Promotional Banners (UI Friendly Dedicated Carousel) */}
        {banners.length > 0 && (
          <View className="mb-6 mx-6 relative">
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
              {banners.map((banner, index) => (
                <TouchableOpacity 
                  key={banner.id} 
                  onPress={() => handleBannerNavigation(banner, router, 'coach')}
                  activeOpacity={0.9}
                  className={`${banner.color} rounded-3xl shadow-sm overflow-hidden relative justify-between`}
                  style={{ 
                    width: bannerCardWidth, 
                    height: 150,
                    marginRight: index < banners.length - 1 ? BANNER_CARD_GAP : 0,
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
                      {banner.route && banner.buttonText ? (
                        <TouchableOpacity 
                          onPress={() => handleBannerNavigation(banner, router, 'coach')}
                          activeOpacity={0.8}
                          className="bg-white px-4 py-2 rounded-full self-start shadow-xs"
                        >
                          <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">{banner.buttonText}</Typography>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Pagination Dots */}
            {banners.length > 1 && (
              <View className="flex-row justify-center items-center mt-3">
                {banners.map((_, i) => (
                  <View 
                    key={i} 
                    className={`h-1.5 rounded-full mx-1 ${activeBannerIndex === i ? 'w-5 bg-primary' : 'w-1.5 bg-gray-300'}`} 
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Upcoming Sessions Section */}
        <View className="pb-6">
          <View className="flex-row justify-between items-center mb-4 px-6">
            <View className="flex-row items-center">
              <Typography variant="h3" color="secondary" weight="bold">
                Upcoming Sessions
              </Typography>
              <View className="bg-orange-500 px-2.5 py-0.5 rounded-full ml-2">
                <Typography variant="caption" color="white" weight="bold" className="text-[10px]">
                  {upcomingSessionsList.length}
                </Typography>
              </View>
            </View>
            <TouchableOpacity className="flex-row items-center" onPress={() => router.push({ pathname: '/(coach)/(coach-tabs)/activity', params: { tab: 'upcoming' } })}>
              <Typography variant="body2" color="secondary" weight="semibold">
                See All
              </Typography>
              <Ionicons name="chevron-forward" size={16} color="#0F2C59" />
            </TouchableOpacity>
          </View>

          {upcomingSessionsList.length === 0 ? (
            <View className="mx-6 bg-white rounded-3xl p-6 items-center justify-center border border-gray-100 shadow-sm">
              <Ionicons name="calendar-outline" size={36} color="#9CA3AF" className="mb-2" />
              <Typography variant="body2" color="muted" align="center">No upcoming sessions scheduled.</Typography>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 24, paddingRight: 8 }}>
              {upcomingSessionsList.map((session: any) => {
                const isRequested = session.rawStatus === 'requested';

                return (
                  <View 
                    key={session.id} 
                    style={{ width: Math.min(require('react-native').Dimensions.get('window').width - 48, 340) }} 
                    className={`bg-white rounded-3xl p-5 mr-4 shadow-md border justify-between ${isRequested ? 'border-orange-100' : 'border-emerald-100'}`}
                  >
                    <View>
                      <View className="flex-row items-center justify-between pb-3 border-b border-gray-100">
                        <View className="flex-row items-center flex-1 pr-2">
                          <View className={`w-11 h-11 rounded-2xl ${isRequested ? 'bg-orange-100' : 'bg-emerald-100'} mr-3 items-center justify-center`}>
                            <Typography variant="subtitle1" style={{ color: isRequested ? '#FF5100' : '#047857' }} weight="bold">
                              {session.name.charAt(0).toUpperCase()}
                            </Typography>
                          </View>
                          <View className="flex-1">
                            <Typography variant="subtitle1" color="secondary" weight="bold" numberOfLines={1} className="font-outfit-bold text-base">
                              {session.title || `${session.sport} Coaching`}
                            </Typography>
                            <Typography variant="caption" color="primary" weight="bold" className="text-xs font-outfit-bold">
                              {session.name} • {session.sport}
                            </Typography>
                          </View>
                        </View>
                        <View className={`${isRequested ? 'bg-orange-50 border-orange-200' : 'bg-emerald-50 border-emerald-200'} border px-2.5 py-1 rounded-full`}>
                          <Typography variant="caption" className={`${isRequested ? 'text-orange-700' : 'text-emerald-700'} text-[10px] font-bold`}>
                            {isRequested ? 'Requested' : 'Confirmed'}
                          </Typography>
                        </View>
                      </View>

                      <View className="pt-3 space-y-2 mb-3">
                        <View className="flex-row items-center">
                          <Ionicons name="calendar-outline" size={16} color="#0F2C59" className="mr-2.5" />
                          <Typography variant="caption" color="secondary" weight="medium" className="text-xs">{session.date}</Typography>
                        </View>
                        <View className="flex-row items-center mt-1">
                          <Ionicons name="time-outline" size={16} color="#0F2C59" className="mr-2.5" />
                          <Typography variant="caption" color="secondary" weight="medium" className="text-xs">{session.time}</Typography>
                        </View>
                        <View className="flex-row items-center mt-1">
                          <Ionicons name="location-outline" size={16} color="#FF5100" className="mr-2.5" />
                          <Typography variant="caption" color="secondary" weight="medium" className="text-xs flex-1 font-outfit-medium" numberOfLines={1}>
                            {session.location}
                          </Typography>
                        </View>
                      </View>
                    </View>

                    {/* Action Row */}
                    {isRequested ? (
                      <View className="flex-row gap-2 pt-3 border-t border-gray-100 items-center">
                        <TouchableOpacity
                          disabled={updateStatusMutation.isPending}
                          onPress={() => updateStatusMutation.mutate({ id: session.id, status: 'cancelled' })}
                          className="flex-1 py-3 rounded-2xl bg-gray-100 border border-gray-200 items-center justify-center active:opacity-80"
                        >
                          <Typography variant="subtitle2" color="secondary" weight="bold" className="text-gray-700 text-xs font-outfit-bold">
                            Decline
                          </Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                          disabled={updateStatusMutation.isPending}
                          onPress={() => updateStatusMutation.mutate({ id: session.id, status: 'accepted' })}
                          className="flex-1 py-3 rounded-2xl bg-[#FF5100] items-center justify-center shadow-xs active:opacity-80"
                        >
                          <Typography variant="subtitle2" style={{ color: '#FFFFFF' }} weight="bold" className="text-xs font-outfit-bold">
                            Accept
                          </Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => router.push({
                            pathname: '/session-summary',
                            params: { 
                              id: session.id,
                              status: 'requested',
                              studentName: session.name,
                              date: session.date,
                              time: session.time,
                              location: session.location,
                              price: session.price,
                              coachSport: session.sport,
                              sessionTitle: session.title
                            }
                          })}
                          className="px-4 py-3 rounded-2xl bg-blue-50 border border-blue-200 items-center justify-center active:opacity-80"
                        >
                          <Typography variant="subtitle2" className="text-blue-700 text-xs font-outfit-bold">
                            Details
                          </Typography>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => router.push({
                          pathname: '/session-summary',
                          params: { 
                            id: session.id,
                            status: 'accepted',
                            studentName: session.name,
                            date: session.date,
                            time: session.time,
                            location: session.location,
                            price: session.price,
                            coachSport: session.sport,
                            sessionTitle: session.title
                          }
                        })}
                        className="w-full py-3 rounded-2xl bg-[#0F2C59] items-center justify-center shadow-xs active:opacity-80 mt-2"
                      >
                        <Typography variant="subtitle2" style={{ color: '#FFFFFF' }} weight="bold" className="text-xs font-outfit-bold">
                          View Details / Verify OTP
                        </Typography>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Current Sessions */}
        <View className="pb-6">
          <View className="flex-row justify-between items-center mb-4 px-6">
            <View className="flex-row items-center">
              <Typography variant="h3" color="secondary" weight="bold">
                Current Sessions
              </Typography>
              {currentSessionsList.length > 0 && (
                <View className="w-2.5 h-2.5 rounded-full bg-red-500 ml-2 shadow-sm" style={{ shadowColor: 'red' }} />
              )}
            </View>
            <TouchableOpacity className="flex-row items-center" onPress={() => router.push({ pathname: '/(coach)/(coach-tabs)/activity', params: { tab: 'current' } })}>
              <Typography variant="body2" color="secondary" weight="semibold">
                See All
              </Typography>
              <Ionicons name="chevron-forward" size={16} color="#0F2C59" />
            </TouchableOpacity>
          </View>

          {currentSessionsList.length === 0 ? (
            <View className="mx-6 bg-white rounded-3xl p-6 items-center justify-center border border-gray-100 shadow-sm">
              <Ionicons name="play-circle-outline" size={36} color="#9CA3AF" className="mb-2" />
              <Typography variant="body2" color="muted" align="center">No active sessions running right now.</Typography>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 24, paddingRight: 8 }}>
              {currentSessionsList.map((session: any) => (
                <View 
                  key={session.id} 
                  style={{ width: Math.min(require('react-native').Dimensions.get('window').width - 48, 340) }} 
                  className="bg-white rounded-3xl p-5 mr-4 shadow-md border-l-4 border-l-red-500 border border-gray-100 justify-between"
                >
                  <View>
                    <View className="flex-row items-center justify-between pb-3 border-b border-gray-100">
                      <View className="flex-row items-center flex-1 pr-2">
                        <View className="w-11 h-11 rounded-2xl bg-red-100 mr-3 items-center justify-center">
                          <Typography variant="subtitle1" style={{ color: '#EF4444' }} weight="bold">
                            {session.name.charAt(0).toUpperCase()}
                          </Typography>
                        </View>
                        <View className="flex-1">
                          <Typography variant="subtitle1" color="secondary" weight="bold" numberOfLines={1} className="font-outfit-bold text-base">
                            {session.name}
                          </Typography>
                          <Typography variant="caption" color="primary" weight="bold" className="text-xs font-outfit-bold">
                            {session.sport}
                          </Typography>
                        </View>
                      </View>
                      <View className="bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                        <Typography variant="caption" className="text-red-700 text-[10px] font-bold">Ongoing</Typography>
                      </View>
                    </View>

                    <View className="pt-3 space-y-2 mb-4">
                      <View className="flex-row items-center">
                        <Ionicons name="play-circle-outline" size={16} color="#10B981" className="mr-2.5" />
                        <Typography variant="caption" color="text" weight="bold" className="text-xs">
                          {session.startedAt ? `Started at ${session.startedAt}` : 'Active Session'}
                        </Typography>
                      </View>
                      <View className="flex-row items-center mt-1">
                        <Ionicons name="location-outline" size={16} color="#FF5100" className="mr-2.5" />
                        <Typography variant="caption" color="secondary" weight="medium" className="text-xs flex-1 font-outfit-medium" numberOfLines={1}>
                          {session.location}
                        </Typography>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => router.push({
                      pathname: '/session-summary',
                      params: { 
                        id: session.id,
                        status: 'ongoing',
                        studentName: session.name,
                        date: session.date,
                        time: session.time,
                        location: session.location,
                        price: session.price,
                        coachSport: session.sport
                      }
                    })}
                    className="w-full py-3 rounded-2xl bg-[#0F2C59] items-center justify-center shadow-xs active:opacity-80"
                  >
                    <Typography variant="subtitle2" style={{ color: '#FFFFFF' }} weight="bold" className="text-xs font-outfit-bold">
                      View Details
                    </Typography>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Completed Sessions */}
        <View className="pb-6">
          <View className="flex-row justify-between items-center mb-4 px-6">
            <Typography variant="h3" color="secondary" weight="bold">
              Completed Sessions
            </Typography>
            <TouchableOpacity className="flex-row items-center" onPress={() => router.push({ pathname: '/(coach)/(coach-tabs)/activity', params: { tab: 'completed' } })}>
              <Typography variant="body2" color="secondary" weight="semibold">
                See All
              </Typography>
              <Ionicons name="chevron-forward" size={16} color="#0F2C59" />
            </TouchableOpacity>
          </View>

          {completedSessionsList.length === 0 ? (
            <View className="mx-6 bg-white rounded-2xl p-6 items-center justify-center border border-gray-100 shadow-sm">
              <Ionicons name="checkmark-circle-outline" size={32} color="#9CA3AF" className="mb-2" />
              <Typography variant="body2" color="muted" align="center">No completed sessions yet.</Typography>
            </View>
          ) : (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={{ paddingLeft: 24, paddingRight: 8 }}
            >
              {completedSessionsList.map((session: any, index: number) => (
                <View 
                  key={session.id} 
                  className="bg-[#3b8c4c] rounded-[24px] p-5 mr-4 shadow-md justify-between"
                  style={{ width: 280 }}
                >
                  <View>
                    <View className="bg-white/20 px-3 py-1 rounded-full self-start mb-3">
                      <Typography variant="caption" color="white" weight="bold" className="text-white text-[11px]">
                        {session.date}
                      </Typography>
                    </View>
                    <Typography variant="h3" color="white" weight="bold" className="text-white text-xl">
                      {session.title || `${session.sport} Coaching`}
                    </Typography>
                    <Typography variant="body2" color="white" className="text-white/80 mt-1 mb-6">
                      {session.name} • {session.sport}
                    </Typography>
                  </View>

                  <TouchableOpacity 
                    className="flex-row items-center bg-white px-4 py-2.5 rounded-2xl self-start"
                    onPress={() => router.push({
                      pathname: '/session-summary',
                      params: { 
                        id: session.id,
                        status: session.rawStatus || 'completed',
                        studentName: session.name,
                        date: session.date,
                        time: session.time,
                        location: session.location,
                        sessionTitle: session.title,
                        coachSport: session.sport
                      }
                    })}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#3b8c4c" className="mr-2" />
                    <Typography variant="body2" className="text-[#3b8c4c] font-bold">
                      View Summary
                    </Typography>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* My Communities Section */}
        <View className="px-6 pb-6">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center">
              <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold text-lg">
                My Communities
              </Typography>
              <View className="w-2.5 h-2.5 rounded-full bg-primary ml-2" />
            </View>

            <View className="flex-row items-center gap-2">
              <TouchableOpacity 
                onPress={() => setEarningsHistoryModalVisible(true)}
                className="flex-row items-center bg-emerald-50 px-2.5 py-1.5 rounded-full border border-emerald-200 active:opacity-80"
              >
                <Ionicons name="cash-outline" size={13} color="#047857" className="mr-1" />
                <Typography variant="caption" className="text-[#047857] font-bold text-[11px] font-outfit-bold">
                  Earnings
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => router.push('/(coach)/community' as any)}
                activeOpacity={0.7}
                className="py-1 px-1"
              >
                <Typography variant="body2" color="primary" weight="bold" className="font-outfit-bold text-sm">
                  View All
                </Typography>
              </TouchableOpacity>
            </View>
          </View>

          {displayCommunities.length === 0 ? (
            <View className="bg-white rounded-2xl p-6 items-center justify-center border border-gray-100 shadow-sm">
              <Ionicons name="people-circle-outline" size={36} color="#9CA3AF" className="mb-2" />
              <Typography variant="body2" color="muted" align="center">
                No assigned communities or programs yet.
              </Typography>
              <Typography variant="caption" color="muted" align="center" className="mt-1">
                Programs assigned to you by community admins will appear here.
              </Typography>
            </View>
          ) : (
            displayCommunities.map((item: any) => {
              const programId = item._id || item.id;
            const isSessionActive = activeSessionProgramId === programId || item.isAttendanceActive;
            const isStarting = startingAttendanceLoading === programId;
            const isEnding = endingAttendanceLoading === programId;
            const subscriberCount = item.activeSubscribersCount ?? item.subscribersCount ?? 0;

            return (
              <View 
                key={programId} 
                className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-gray-100 relative overflow-hidden"
              >
                {/* Header Banner Row */}
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center mb-1">
                      <View className="bg-primary/10 px-2.5 py-0.5 rounded-full mr-2">
                        <Typography variant="caption" color="primary" weight="bold" className="text-[10px]">
                          {item.sport || 'Community'}
                        </Typography>
                      </View>
                      <Typography variant="caption" color="muted" weight="semibold" className="text-[11px]">
                        {item.communityName || 'Community Center'}
                      </Typography>
                    </View>

                    <Typography variant="subtitle1" color="secondary" weight="bold" className="text-[17px]">
                      {item.title || item.name}
                    </Typography>
                  </View>

                  {/* Active Live Session Badge */}
                  {isSessionActive && (
                    <View className="flex-row items-center bg-red-500 px-2.5 py-1 rounded-full">
                      <View className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-pulse" />
                      <Typography variant="caption" color="white" weight="bold" className="text-[10px] uppercase tracking-wider">
                        Session Live
                      </Typography>
                    </View>
                  )}
                </View>

                {/* Schedule & Earnings */}
                <View className="bg-[#F8FAFC] rounded-2xl p-3 mb-4 border border-slate-100">
                  <View className="flex-row items-center mb-1.5">
                    <Ionicons name="time-outline" size={14} color="#64748B" className="mr-2" />
                    <Typography variant="caption" color="secondary" weight="semibold" className="text-[12px]">
                      {item.schedule || 'Regular Weekly Sessions'}
                    </Typography>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Ionicons name="wallet-outline" size={14} color="#10B981" className="mr-2" />
                      <Typography variant="caption" className="text-emerald-700 font-bold text-[12px]">
                        {item.earnings || item.payout || item.salary || 'Contracted Earnings'}
                      </Typography>
                    </View>

                    {/* Active Subscribers Pill Button */}
                    <TouchableOpacity 
                      onPress={() => openSubscribersModal(programId, item.title || item.name || 'Program')}
                      className="flex-row items-center bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs"
                    >
                      <Ionicons name="people-outline" size={13} color="#0F2C59" className="mr-1" />
                      <Typography variant="caption" color="secondary" weight="bold" className="text-[11px]">
                        {subscriberCount} Subscribers
                      </Typography>
                      <Ionicons name="chevron-forward" size={10} color="#0F2C59" className="ml-1" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Session Attendance Controls */}
                <View className="flex-row gap-2">
                  {!isSessionActive ? (
                    <TouchableOpacity
                      disabled={isStarting}
                      onPress={() => handleStartAttendance(programId)}
                      className="flex-1 bg-[#10B981] py-3 rounded-2xl flex-row items-center justify-center shadow-xs active:opacity-80"
                    >
                      <Ionicons name="play-circle" size={18} color="white" className="mr-1.5" />
                      <Typography variant="body2" color="white" weight="bold">
                        {isStarting ? 'Starting...' : 'Start Session Attendance'}
                      </Typography>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      disabled={isEnding}
                      onPress={() => handleEndAttendance(programId)}
                      className="flex-1 bg-[#EF4444] py-3 rounded-2xl flex-row items-center justify-center shadow-xs active:opacity-80"
                    >
                      <Ionicons name="stop-circle" size={18} color="white" className="mr-1.5" />
                      <Typography variant="body2" color="white" weight="bold">
                        {isEnding ? 'Ending...' : 'End Program Session'}
                      </Typography>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Downside View All Button */}
        <TouchableOpacity
          onPress={() => router.push('/(coach)/community' as any)}
          activeOpacity={0.85}
          className="mt-2 py-3 px-4 rounded-2xl bg-white border border-gray-200 shadow-2xs flex-row items-center justify-between active:bg-gray-50"
        >
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mr-2.5">
              <Ionicons name="business" size={16} color="#0F2C59" />
            </View>
            <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold text-xs">
              View All Communities & Batches
            </Typography>
          </View>
          <View className="flex-row items-center">
            <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs mr-1">
              Open
            </Typography>
            <Ionicons name="chevron-forward" size={14} color="#FF5100" />
          </View>
        </TouchableOpacity>
        </View>

        {/* Learning & Tips */}
        <View className="px-6 pb-12">
          <View className="flex-row justify-between items-center mb-4">
            <Typography variant="h3" color="secondary" weight="bold">
              Learning & Tips
            </Typography>
            <TouchableOpacity className="flex-row items-center">
              <Typography variant="body2" color="secondary" weight="semibold">
                See All
              </Typography>
              <Ionicons name="chevron-forward" size={16} color="#0F2C59" />
            </TouchableOpacity>
          </View>

          {learningTips.map((tip, index) => (
            <TouchableOpacity 
              key={index} 
              className="flex-row bg-white rounded-3xl p-3 mb-4 shadow-sm border border-gray-100 items-center"
            >
              {/* Left Side: Soft Pastel Background for Icon */}
              <View className={`w-24 h-24 rounded-2xl ${tip.imageBg} items-center justify-center mr-4`}>
                <Ionicons 
                  name={tip.id === '1' ? "american-football-outline" : "ribbon-outline"} 
                  size={36} 
                  color="#FF5100" 
                />
              </View>

              {/* Right Side: Text details */}
              <View className="flex-1 pr-2">
                <Typography variant="subtitle2" color="secondary" weight="bold" className="text-secondary text-[16px] leading-5 mb-0.5">
                  {tip.title}
                </Typography>
                <Typography variant="body2" color="primary" weight="bold" className="text-primary text-[14px] leading-5 mb-1">
                  {tip.subtitle}
                </Typography>
                <Typography variant="caption" color="muted" className="text-gray-500 text-[12px] leading-4" numberOfLines={2}>
                  {tip.description}
                </Typography>
              </View>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* Metrics Detail Overlay (Modal replacement) */}
      {metricsModalVisible && (
        <View className="absolute inset-0 bg-black/50 justify-end z-50">
          <TouchableOpacity 
            className="absolute inset-0" 
            activeOpacity={1} 
            onPress={() => setMetricsModalVisible(false)} 
          />
          <View 
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
            className="bg-white rounded-t-[32px] px-6 pt-4 shadow-2xl border-t border-gray-200"
            style={{ paddingBottom: Math.max(insets.bottom + 24, 36) }}
          >
            {/* Drag Handle Indicator */}
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-6" />

            {/* Modal Title */}
            <View className="flex-row justify-between items-center mb-6">
              <Typography variant="h3" color="secondary" weight="bold" className="text-xl">
                Metrics Dashboard
              </Typography>
              <TouchableOpacity 
                onPress={() => setMetricsModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 justify-center items-center"
              >
                <Ionicons name="close" size={18} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {/* Tabs Row */}
            <View className="flex-row bg-[#EEF3F9] rounded-full p-1.5 mb-6">
              <TouchableOpacity 
                onPress={() => setSelectedMetricTab('earnings')}
                className="flex-1 flex-row justify-center items-center py-2.5 rounded-full"
                style={selectedMetricTab === 'earnings' ? {
                  backgroundColor: '#4B9C73',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                  elevation: 2
                } : {}}
              >
                <Ionicons 
                  name="wallet-outline" 
                  size={16} 
                  color={selectedMetricTab === 'earnings' ? 'white' : '#0F2C59'} 
                  className="mr-1.5" 
                />
                <Typography 
                  variant="body2" 
                  color={selectedMetricTab === 'earnings' ? 'white' : 'secondary'} 
                  weight="bold"
                >
                  Earnings
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setSelectedMetricTab('sessions')}
                className="flex-1 flex-row justify-center items-center py-2.5 rounded-full"
                style={selectedMetricTab === 'sessions' ? {
                  backgroundColor: '#4A90E2',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                  elevation: 2
                } : {}}
              >
                <Ionicons 
                  name="calendar-outline" 
                  size={16} 
                  color={selectedMetricTab === 'sessions' ? 'white' : '#0F2C59'} 
                  className="mr-1.5" 
                />
                <Typography 
                  variant="body2" 
                  color={selectedMetricTab === 'sessions' ? 'white' : 'secondary'} 
                  weight="bold"
                >
                  Sessions
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setSelectedMetricTab('rating')}
                className="flex-1 flex-row justify-center items-center py-2.5 rounded-full"
                style={selectedMetricTab === 'rating' ? {
                  backgroundColor: '#F58220',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                  elevation: 2
                } : {}}
              >
                <Ionicons 
                  name="star-outline" 
                  size={16} 
                  color={selectedMetricTab === 'rating' ? 'white' : '#0F2C59'} 
                  className="mr-1.5" 
                />
                <Typography 
                  variant="body2" 
                  color={selectedMetricTab === 'rating' ? 'white' : 'secondary'} 
                  weight="bold"
                >
                  Rating
                </Typography>
              </TouchableOpacity>
            </View>

            {/* Tab Contents */}
            <View className="mb-6 min-h-[220px]">
              {selectedMetricTab === 'earnings' && (
                <View>
                  <View className="flex-row justify-between items-center bg-green-50 border border-green-100 p-4 rounded-2xl mb-4">
                    <View>
                      <Typography variant="caption" className="text-green-800 font-semibold mb-0.5">Available Balance</Typography>
                      <Typography variant="h2" className="text-[#2b7a43] text-2xl font-bold">₹{availableBalance}</Typography>
                    </View>
                    <Ionicons name="cash-outline" size={32} color="#4B9C73" />
                  </View>
                  
                  <View>
                    <View className="flex-row justify-between items-center border-b border-gray-100 pb-2 mb-3">
                      <Typography variant="body2" color="muted">Completed Sessions ({metrics?.totalSessions ?? completedSessionsList.length})</Typography>
                      <Typography variant="body2" color="secondary" weight="bold">₹{totalEarnings}</Typography>
                    </View>
                    <View className="flex-row justify-between items-center border-b border-gray-100 pb-2 mb-3">
                      <Typography variant="body2" color="muted">Pending Balance (Held)</Typography>
                      <Typography variant="body2" className="text-orange-600 font-bold">₹{pendingBalance}</Typography>
                    </View>
                    <View className="flex-row justify-between items-center pt-1">
                      <Typography variant="body1" color="secondary" weight="bold">Total Earnings</Typography>
                      <Typography variant="body1" className="text-[#2b7a43] font-bold">₹{totalEarnings}</Typography>
                    </View>
                  </View>
                </View>
              )}

              {selectedMetricTab === 'sessions' && (
                <View>
                  <View className="flex-row justify-between items-center bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-4">
                    <View className="flex-1 pr-4">
                      <Typography variant="caption" className="text-blue-800 font-semibold mb-1">Weekly Target Progress</Typography>
                      <Typography variant="h3" color="secondary" weight="bold" className="mb-2">
                        {metrics?.weeklySessionsCompleted ?? 0} of {metrics?.weeklySessionsTotal ?? 0} Completed
                      </Typography>
                      {/* Fake progress bar */}
                      <View className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <View 
                          className="h-full bg-[#4A90E2] rounded-full" 
                          style={{ 
                            width: `${metrics?.weeklySessionsTotal > 0 ? (metrics.weeklySessionsCompleted / metrics.weeklySessionsTotal) * 100 : 0}%` 
                          }} 
                        />
                      </View>
                    </View>
                    <Typography variant="h2" className="text-[#4A90E2] font-bold">
                      {metrics?.weeklySessionsTotal > 0 ? Math.round((metrics.weeklySessionsCompleted / metrics.weeklySessionsTotal) * 100) : 0}%
                    </Typography>
                  </View>

                  <View>
                    <View className="flex-row justify-between items-center border-b border-gray-100 pb-2 mb-3">
                      <Typography variant="body2" color="muted">Total Completed Sessions</Typography>
                      <Typography variant="body2" className="text-green-700 font-bold">{metrics?.totalSessions ?? 0} Sessions</Typography>
                    </View>
                  </View>
                </View>
              )}

              {selectedMetricTab === 'rating' && (
                <View>
                  <View className="flex-row justify-between items-center bg-orange-50 border border-orange-100 p-4 rounded-2xl mb-4">
                    <View>
                      <Typography variant="caption" className="text-orange-800 font-semibold mb-0.5">Average Coach Rating</Typography>
                      <View className="flex-row items-center">
                        <Typography variant="h2" className="text-[#F58220] text-3xl font-bold mr-2">
                          {avgRating > 0 ? avgRating.toFixed(1) : '0.0'}
                        </Typography>
                        <View className="flex-row">
                          {[1,2,3,4,5].map(i => (
                            <Ionicons 
                              key={i} 
                              name="star" 
                              size={16} 
                              color={i <= Math.round(avgRating) ? "#FFD700" : "#D1D5DB"} 
                              className="mx-[1px]" 
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                    <Ionicons name="star" size={32} color="#F58220" />
                  </View>

                  {metrics?.totalRatings === 0 ? (
                    <View className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
                      <Typography variant="body2" color="muted" className="italic text-[13px] leading-4 text-center">
                        No reviews submitted yet.
                      </Typography>
                    </View>
                  ) : (
                    <View className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
                      <Typography variant="caption" color="secondary" weight="bold" className="mb-1 text-[11px]">RECENT REVIEW SUMMARY</Typography>
                      <Typography variant="body2" color="muted" className="italic text-[13px] leading-4">
                        "Coach is very supportive. Always coordinates well with the children and does an amazing job training."
                      </Typography>
                      <Typography variant="caption" color="secondary" weight="semibold" className="text-right mt-1">— Verified Parent</Typography>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Bottom Close Button / Withdraw Button */}
            {selectedMetricTab === 'earnings' ? (
              <Button 
                title="Withdraw Balance" 
                variant="primary"
                onPress={() => {
                  setMetricsModalVisible(false);
                  router.push('/(coach)/wallet' as any);
                }} 
              />
            ) : (
              <Button 
                title="Done" 
                variant="secondary"
                onPress={() => setMetricsModalVisible(false)} 
              />
            )}
            </View>
        </View>
      )}

      {/* Active Program Subscribers Modal */}
      {subscribersModalVisible && (
        <View className="absolute inset-0 bg-black/50 justify-end z-50">
          <TouchableOpacity 
            className="absolute inset-0" 
            activeOpacity={1} 
            onPress={() => setSubscribersModalVisible(false)} 
          />
          <View 
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
            className="bg-white rounded-t-[32px] px-6 pt-4 shadow-2xl border-t border-gray-200 max-h-[80%]"
            style={{ paddingBottom: Math.max(insets.bottom + 24, 36) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-6" />

            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Typography variant="h3" color="secondary" weight="bold" className="text-xl">
                  Active Subscribers
                </Typography>
                <Typography variant="caption" color="muted">
                  {selectedProgramTitle}
                </Typography>
              </View>

              <TouchableOpacity 
                onPress={() => setSubscribersModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 justify-center items-center"
              >
                <Ionicons name="close" size={18} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[380px] mb-4">
              {isLoadingSubscribers ? (
                <View className="py-8 items-center">
                  <Typography variant="body2" color="muted">Loading subscribers...</Typography>
                </View>
              ) : displaySubscribers.length === 0 ? (
                <View className="py-8 items-center">
                  <Ionicons name="people-outline" size={36} color="#9CA3AF" className="mb-2" />
                  <Typography variant="body2" color="muted">No active subscribers found for this program.</Typography>
                </View>
              ) : (
                displaySubscribers.map((sub: any, idx: number) => (
                  <View key={sub.id || idx} className="flex-row items-center justify-between p-3.5 bg-gray-50 rounded-2xl mb-2.5 border border-gray-100">
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-full bg-secondary/10 justify-center items-center mr-3">
                        <Typography variant="subtitle2" color="secondary" weight="bold">
                          {(sub.name || 'S')[0]}
                        </Typography>
                      </View>
                      <View>
                        <Typography variant="subtitle2" color="secondary" weight="bold">
                          {sub.name || 'Subscriber'}
                        </Typography>
                        <Typography variant="caption" color="muted">
                          {sub.age ? `Age ${sub.age} • ` : ''}{sub.plan || 'Active Pass'}
                        </Typography>
                      </View>
                    </View>

                    <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <Typography variant="caption" className="text-emerald-700 font-bold text-[10px]">
                        {sub.status || 'Active'}
                      </Typography>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <Button 
              title="Close" 
              variant="secondary"
              onPress={() => setSubscribersModalVisible(false)} 
            />
          </View>
        </View>
      )}

      {/* Earnings Payout History Modal */}
      {earningsHistoryModalVisible && (
        <View className="absolute inset-0 bg-black/50 justify-end z-50">
          <TouchableOpacity 
            className="absolute inset-0" 
            activeOpacity={1} 
            onPress={() => setEarningsHistoryModalVisible(false)} 
          />
          <View 
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
            className="bg-white rounded-t-[32px] px-6 pt-4 shadow-2xl border-t border-gray-200 max-h-[80%]"
            style={{ paddingBottom: Math.max(insets.bottom + 24, 36) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-6" />

            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Typography variant="h3" color="secondary" weight="bold" className="text-xl">
                  Earnings Payout History
                </Typography>
                <Typography variant="caption" color="muted">
                  Assigned Community Contracts & Earnings Log
                </Typography>
              </View>

              <TouchableOpacity 
                onPress={() => setEarningsHistoryModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 justify-center items-center"
              >
                <Ionicons name="close" size={18} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[380px] mb-4">
              {displayEarningsHistory.length === 0 ? (
                <View className="py-8 items-center">
                  <Ionicons name="receipt-outline" size={36} color="#9CA3AF" className="mb-2" />
                  <Typography variant="body2" color="muted">No earnings payout history available yet.</Typography>
                </View>
              ) : (
                displayEarningsHistory.map((pay: any, idx: number) => (
                  <View key={pay.id || idx} className="p-4 bg-gray-50 rounded-2xl mb-3 border border-gray-100 flex-row justify-between items-center">
                    <View className="flex-1 pr-2">
                      <Typography variant="subtitle2" color="secondary" weight="bold">
                        {pay.period || 'Monthly Earnings Payout'}
                      </Typography>
                      <Typography variant="caption" color="muted" className="mt-0.5">
                        {pay.date} • {pay.method || 'Bank Transfer'}
                      </Typography>
                    </View>

                    <View className="items-end">
                      <Typography variant="subtitle1" className="text-emerald-700 font-bold">
                        {pay.amount}
                      </Typography>
                      <View className="bg-emerald-100 px-2 py-0.5 rounded-full mt-0.5">
                        <Typography variant="caption" className="text-emerald-800 font-semibold text-[10px]">
                          {pay.status || 'Paid'}
                        </Typography>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <Button 
              title="Close" 
              variant="secondary"
              onPress={() => setEarningsHistoryModalVisible(false)} 
            />
          </View>
        </View>
      )}
    </View>
  );
}
