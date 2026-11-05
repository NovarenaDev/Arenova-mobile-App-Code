import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';
import { resolveSessionTime, resolveSessionDate, resolveSessionSport, resolveSessionTitle, resolveSessionLocation, resolveStudentName, formatSingleTime } from '@/utils/sessionFormatter';
import { SessionOtpVerificationModal } from '@/components/shared/SessionOtpVerificationModal';

export default function CoachActivityScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'current' | 'completed'>(
    (tab === 'current' || tab === 'completed' || tab === 'upcoming') ? (tab as any) : 'upcoming'
  );

  const [selectedSessionForOtp, setSelectedSessionForOtp] = useState<any | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (tab && (tab === 'current' || tab === 'upcoming' || tab === 'completed')) {
      setActiveTab(tab as any);
    } else if (tab === 'requested') {
      setActiveTab('upcoming');
    }
  }, [tab]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['coachSessions'] }),
      queryClient.invalidateQueries({ queryKey: ['segmentedSessions'] }),
      queryClient.invalidateQueries({ queryKey: ['coachDashboard'] })
    ]);
    setIsRefreshing(false);
  };

  const { data: sessionsResponse, isLoading: isSessionsLoading } = useQuery({
    queryKey: ['coachSessions'],
    queryFn: async () => {
      const res = await api.get('/coaches/my/sessions');
      return res.data?.data || res.data || [];
    }
  });

  const { data: segmentedSessions } = useQuery({
    queryKey: ['segmentedSessions'],
    queryFn: async () => {
      try {
        const res = await api.get('/coach-app/sessions/segmented');
        return res.data;
      } catch {
        return null;
      }
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
        Alert.alert('Request Accepted', 'The booking request has been accepted!');
      } else if (variables.status === 'cancelled') {
        Alert.alert('Request Declined', 'The booking request was declined.');
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update session status');
    }
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      try {
        const res = await api.put(`/coach-app/sessions/${sessionId}/end`);
        return res.data;
      } catch (err: any) {
        if (err?.response?.status === 404) {
          try {
            const fallbackRes = await api.put(`/coaches/my/sessions/${sessionId}/status`, { status: 'completed' });
            return fallbackRes.data;
          } catch {
            const fallbackRes2 = await api.put(`/bookings/${sessionId}/status`, { status: 'completed' });
            return fallbackRes2.data;
          }
        }
        throw err;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['coachSessions'] }),
        queryClient.invalidateQueries({ queryKey: ['segmentedSessions'] }),
        queryClient.invalidateQueries({ queryKey: ['coachDashboard'] })
      ]);
      setActiveTab('completed');
      Alert.alert('Session Completed', 'The session has concluded successfully and is now in Completed sessions!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Could not end session. At least 80% of scheduled duration must elapse.';
      Alert.alert('Cannot End Session', msg);
    }
  });

  const handleEndSessionPress = (booking: any) => {
    Alert.alert(
      'Complete Session',
      `Are you sure you want to conclude the coaching session for ${booking.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Complete Session', 
          style: 'default',
          onPress: () => endSessionMutation.mutate(booking.id)
        }
      ]
    );
  };

  // Merge sessions from all available endpoints (my sessions & segmented)
  const rawSegmentedUpcoming = Array.isArray(segmentedSessions?.data?.upcoming) ? segmentedSessions.data.upcoming : [];
  const rawSegmentedCurrent = Array.isArray(segmentedSessions?.data?.current) ? segmentedSessions.data.current : [];
  const rawSegmentedCompleted = Array.isArray(segmentedSessions?.data?.completed) ? segmentedSessions.data.completed : [];
  const rawMySessions = Array.isArray(sessionsResponse) ? sessionsResponse : (Array.isArray(sessionsResponse?.data) ? sessionsResponse.data : []);

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

  rawSegmentedUpcoming.forEach((s: any) => registerSession(s, 'upcoming'));
  rawSegmentedCurrent.forEach((s: any) => registerSession(s, 'ongoing'));
  rawSegmentedCompleted.forEach((s: any) => registerSession(s, 'completed'));
  rawMySessions.forEach((s: any) => registerSession(s));

  const allSessions = Array.from(sessionMap.values());

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
      priceText,
      date: dateFormatted,
      time: timeFormatted,
      rawDate: session.slot?.date || session.date || '',
      status: uiStatus,
      rawStatus: normStatus,
      location: locationName,
      startedLate: session.startedLate || false,
      delayStatus: session.delayStatus || '',
      delayMinutes: session.delayMinutes || 0,
      absent: session.absent || 0,
      injured: session.injured || 0
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

  const upcomingBookings = dedupe(
    allSessions
      .filter((s: any) => {
        const st = getNormalizedStatus(s);
        return st === 'requested' || st === 'accepted';
      })
      .map(mapSessionToUI)
  );

  const currentBookings = dedupe(
    allSessions
      .filter((s: any) => getNormalizedStatus(s) === 'ongoing')
      .map(mapSessionToUI)
  );

  const completedBookings = dedupe(
    allSessions
      .filter((s: any) => getNormalizedStatus(s) === 'completed')
      .map(mapSessionToUI)
  );

  const displayBookings = 
    activeTab === 'upcoming' ? upcomingBookings : 
    activeTab === 'current' ? currentBookings : 
    completedBookings;

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      <View className="px-4 py-4 bg-[#0F2C59] border-b border-gray-100 flex-row justify-between items-center">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Typography variant="h2" color="white" weight="bold">
          My Activity
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      {/* 3 Segment Tabs: Upcoming, Current, Completed */}
      <View className="px-3 pt-4 pb-2">
        <View className="flex-row bg-white rounded-full border border-gray-200 overflow-hidden h-12 p-1">
          <TouchableOpacity 
            className={`flex-1 justify-center items-center rounded-full ${activeTab === 'upcoming' ? 'bg-secondary' : 'bg-transparent'}`}
            onPress={() => setActiveTab('upcoming')}
          >
            <Typography variant="caption" color={activeTab === 'upcoming' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-[12px]">
              Upcoming {upcomingBookings.length > 0 ? `(${upcomingBookings.length})` : ''}
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 justify-center items-center rounded-full ${activeTab === 'current' ? 'bg-secondary' : 'bg-transparent'}`}
            onPress={() => setActiveTab('current')}
          >
            <Typography variant="caption" color={activeTab === 'current' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-[12px]">
              Current {currentBookings.length > 0 ? `(${currentBookings.length})` : ''}
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 justify-center items-center rounded-full ${activeTab === 'completed' ? 'bg-secondary' : 'bg-transparent'}`}
            onPress={() => setActiveTab('completed')}
          >
            <Typography variant="caption" color={activeTab === 'completed' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-[12px]">
              Completed
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        className="flex-1"
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={onRefresh} 
            tintColor="#FF5100" 
            colors={['#FF5100']} 
          />
        }
        contentContainerStyle={{ paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: Math.max(insets.bottom + 110, 130) }}
      >
        
        {isSessionsLoading ? (
          <ActivityIndicator size="large" color="#FF5100" style={{ marginTop: 24 }} />
        ) : displayBookings.length === 0 ? (
          <View className="items-center justify-center py-12 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mt-2">
            <Ionicons 
              name={
                activeTab === 'upcoming' ? "calendar-outline" :
                activeTab === 'current' ? "play-circle-outline" : "checkmark-circle-outline"
              } 
              size={40} 
              color="#9CA3AF" 
              className="mb-3" 
            />
            <Typography variant="body1" color="muted" align="center" className="font-outfit">
              No {activeTab} sessions found.
            </Typography>
          </View>
        ) : (
          displayBookings.map(booking => (
          <View key={booking.id} className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
            <View className="flex-row justify-between items-center mb-3 border-b border-gray-100 pb-3">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-blue-100 mr-3 items-center justify-center">
                  <Typography variant="subtitle1" color="primary" weight="bold">{booking.name.charAt(0)}</Typography>
                </View>
                <View>
                  <Typography variant="subtitle1" color="secondary" weight="bold">
                    {booking.title || `${booking.sport} Coaching`}
                  </Typography>
                  <Typography variant="caption" color="muted" weight="bold">
                    {booking.name} • {booking.priceText}
                  </Typography>
                </View>
              </View>
              <View className={`px-2 py-1 rounded-md ${
                booking.status === 'Ongoing' ? 'bg-red-100 border border-red-200' : 
                booking.status === 'Confirmed' || booking.status === 'Upcoming' ? 'bg-green-100 border border-green-200' : 
                booking.status === 'Requested' ? 'bg-orange-100 border border-orange-200' :
                booking.status === 'Completed' ? 'bg-emerald-50 border border-emerald-200' : 
                booking.status === 'Delayed Warning' ? 'bg-amber-100 border border-amber-200' :
                booking.status === 'Out of Time' || booking.status === 'Penalized' ? 'bg-red-100 border border-red-200' : 'bg-gray-100 border border-gray-200'
              }`}>
                <Typography 
                  variant="caption" 
                  className={
                    booking.status === 'Ongoing' ? 'text-red-700' : 
                    booking.status === 'Confirmed' || booking.status === 'Upcoming' ? 'text-green-700' : 
                    booking.status === 'Requested' ? 'text-orange-700' :
                    booking.status === 'Completed' ? 'text-emerald-700' : 
                    booking.status === 'Delayed Warning' ? 'text-amber-700' :
                    booking.status === 'Out of Time' || booking.status === 'Penalized' ? 'text-red-700' : 'text-gray-700'
                  } 
                  weight="bold"
                >
                  {booking.status}
                </Typography>
              </View>
            </View>

            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-row items-center flex-1 pr-2">
                <Ionicons name="calendar-outline" size={15} color="#0F2C59" className="mr-1.5" />
                <Typography variant="body2" color="secondary" weight="medium" className="text-xs">{booking.date}</Typography>
              </View>
              <View className="flex-row items-center flex-1">
                <Ionicons name="time-outline" size={15} color="#0F2C59" className="mr-1.5" />
                <Typography variant="body2" color="secondary" weight="medium" className="text-xs">{booking.time}</Typography>
              </View>
            </View>

            <View className="flex-row items-center mb-3">
              <Ionicons name="location-outline" size={15} color="#FF5100" className="mr-1.5" />
              <Typography variant="body2" color="secondary" weight="medium" className="text-xs flex-1 font-outfit-medium" numberOfLines={1}>
                {booking.location || 'Sports Stadium Arena'}
              </Typography>
            </View>

            {/* Accept / Decline / Details Action Row for Requested Sessions */}
            {booking.rawStatus === 'requested' ? (
              <View className="flex-row gap-2 pt-3 border-t border-gray-100 items-center">
                <TouchableOpacity
                  disabled={updateStatusMutation.isPending}
                  onPress={() => updateStatusMutation.mutate({ id: booking.id, status: 'cancelled' })}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 border border-gray-200 items-center justify-center active:opacity-80"
                >
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="text-gray-700 text-xs font-outfit-bold">
                    Decline
                  </Typography>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={updateStatusMutation.isPending}
                  onPress={() => updateStatusMutation.mutate({ id: booking.id, status: 'accepted' })}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF5100] items-center justify-center shadow-xs active:opacity-80"
                >
                  <Typography variant="subtitle2" style={{ color: '#FFFFFF' }} weight="bold" className="text-xs font-outfit-bold">
                    Accept
                  </Typography>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/session-summary',
                    params: { 
                      id: booking.id,
                      status: 'requested',
                      studentName: booking.name,
                      date: booking.date,
                      time: booking.time,
                      location: booking.location,
                      price: booking.price,
                      coachSport: booking.sport,
                      sessionTitle: booking.title
                    }
                  })}
                  className="px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200 items-center justify-center active:opacity-80"
                >
                  <Typography variant="subtitle2" className="text-blue-700 text-xs font-outfit-bold">
                    Details
                  </Typography>
                </TouchableOpacity>
              </View>
            ) : activeTab === 'current' || booking.rawStatus === 'ongoing' ? (
              <View className="pt-3 border-t border-gray-100">
                <View className="flex-row items-center justify-between mb-2.5 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2" />
                    <Typography variant="caption" weight="bold" className="text-emerald-800 font-outfit-bold text-xs">
                      Session In Progress
                    </Typography>
                  </View>
                  <Typography variant="caption" color="muted" className="font-outfit text-[11px]">
                    {booking.time}
                  </Typography>
                </View>

                <View className="flex-row justify-end gap-2 items-center">
                  <TouchableOpacity
                    disabled={endSessionMutation.isPending}
                    onPress={() => handleEndSessionPress(booking)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 flex-row items-center justify-center active:opacity-80 shadow-xs"
                  >
                    {endSessionMutation.isPending && (endSessionMutation.variables as any) === booking.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done-circle-outline" size={16} color="#FFFFFF" className="mr-1.5" />
                        <Typography variant="caption" weight="bold" className="text-white text-xs font-outfit-bold">
                          End / Complete Session
                        </Typography>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => router.push({
                      pathname: '/session-summary',
                      params: { 
                        id: booking.id,
                        status: 'ongoing',
                        studentName: booking.name,
                        date: booking.date,
                        time: booking.time,
                        location: booking.location,
                        price: booking.price,
                        coachSport: booking.sport,
                        sessionTitle: booking.title
                      }
                    })}
                    className="px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200 items-center justify-center active:opacity-80"
                  >
                    <Typography variant="subtitle2" className="text-blue-700 text-xs font-outfit-bold">
                      Details
                    </Typography>
                  </TouchableOpacity>
                </View>
              </View>
            ) : activeTab === 'completed' || booking.rawStatus === 'completed' ? (
              <View className="flex-row justify-between items-center pt-3 border-t border-gray-100">
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={17} color="#059669" className="mr-1.5" />
                  <Typography variant="caption" weight="bold" className="text-emerald-700 font-outfit-bold text-xs">
                    Session Concluded
                  </Typography>
                </View>

                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/session-summary',
                    params: { 
                      id: booking.id,
                      status: 'completed',
                      studentName: booking.name,
                      date: booking.date,
                      time: booking.time,
                      location: booking.location,
                      price: booking.price,
                      coachSport: booking.sport,
                      sessionTitle: booking.title
                    }
                  })}
                  className="px-4 py-2 rounded-xl bg-gray-100 border border-gray-200 items-center justify-center active:opacity-80"
                >
                  <Typography variant="subtitle2" className="text-gray-700 text-xs font-outfit-bold">
                    View Summary
                  </Typography>
                </TouchableOpacity>
              </View>
            ) : (
              /* Upcoming tab */
              <View className="flex-row justify-end mt-1 gap-2 items-center">
                <TouchableOpacity
                  onPress={() => setSelectedSessionForOtp({
                    id: booking.id,
                    studentName: booking.name,
                    sport: booking.sport,
                    date: booking.date,
                    time: booking.time,
                    type: booking.name.includes(',') || booking.subtitle.includes('Group') ? 'group' : 'individual'
                  })}
                  className="px-4 py-2.5 rounded-xl bg-[#FF5100] flex-row items-center justify-center active:opacity-80 shadow-xs"
                >
                  <Ionicons name="key-outline" size={15} color="#FFFFFF" className="mr-1.5" />
                  <Typography variant="caption" weight="bold" className="text-white text-xs font-outfit-bold">
                    Verify OTP & Start
                  </Typography>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/session-summary',
                    params: { 
                      id: booking.id,
                      status: 'accepted',
                      studentName: booking.name,
                      date: booking.date,
                      time: booking.time,
                      location: booking.location,
                      price: booking.price,
                      coachSport: booking.sport,
                      sessionTitle: booking.title
                    }
                  })}
                  className="px-3.5 py-2.5 rounded-xl bg-blue-50 border border-blue-200 items-center justify-center active:opacity-80"
                >
                  <Typography variant="subtitle2" className="text-blue-700 text-xs font-outfit-bold">
                    Details
                  </Typography>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )))}

      </ScrollView>

      {/* INDIVIDUAL / GROUP SESSION OTP VERIFICATION MODAL */}
      <SessionOtpVerificationModal
        visible={!!selectedSessionForOtp}
        session={selectedSessionForOtp}
        onClose={() => setSelectedSessionForOtp(null)}
        onSuccess={async () => {
          setSelectedSessionForOtp(null);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['coachSessions'] }),
            queryClient.invalidateQueries({ queryKey: ['segmentedSessions'] }),
            queryClient.invalidateQueries({ queryKey: ['coachDashboard'] })
          ]);
          setActiveTab('current');
          Alert.alert(
            'Session Active!',
            'Session attendance verified successfully! The session is now active in your Current sessions tab.'
          );
        }}
      />
    </SafeAreaView>
  );
}
