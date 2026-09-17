import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export default function CoachActivityScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'current' | 'completed'>(
    (tab === 'current' || tab === 'completed' || tab === 'upcoming') ? (tab as any) : 'upcoming'
  );

  useEffect(() => {
    if (tab && (tab === 'current' || tab === 'upcoming' || tab === 'completed')) {
      setActiveTab(tab as any);
    } else if (tab === 'requested') {
      setActiveTab('upcoming');
    }
  }, [tab]);

  const { data: sessionsResponse, isLoading: isSessionsLoading } = useQuery({
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
        Alert.alert('Request Accepted', 'The booking request has been accepted!');
      } else if (variables.status === 'cancelled') {
        Alert.alert('Request Declined', 'The booking request was declined.');
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update session status');
    }
  });

  const allSessions = Array.isArray(sessionsResponse) ? sessionsResponse : [];

  const formatSessionDate = (dateStr: string) => {
    if (!dateStr) return 'Scheduled Date';
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return dateStr;
  };

  const formatSessionTime = (timeStr: string) => {
    if (!timeStr) return '07:00 AM - 08:00 AM';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        return `${formattedHours}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
      }
    }
    return timeStr;
  };

  const mapSessionToUI = (session: any) => {
    const id = session._id || session.id || Math.random().toString();
    const studentName = 
      session.child?.name ||
      session.player?.name ||
      session.childName ||
      session.playerName ||
      (Array.isArray(session.children) && session.children.length > 0 ? session.children.map((c: any) => c.name || c).join(', ') : '') ||
      session.studentName || 
      session.student?.name || 
      session.participant?.name || 
      session.bookedBy?.name || 
      (session.bookedBy?.firstName ? `${session.bookedBy.firstName} ${session.bookedBy.lastName || ''}`.trim() : '') ||
      session.user?.name || 
      (session.user?.firstName ? `${session.user.firstName} ${session.user.lastName || ''}`.trim() : '') ||
      'Student';

    const sportTitle = 
      session.sport || 
      session.sportName || 
      session.slot?.sport || 
      session.slot?.title || 
      session.title || 
      'Coaching Session';

    const rawDate = 
      session.slot?.date || 
      session.date || 
      session.slotDate || 
      session.startDate || 
      session.bookingDate || 
      session.createdAt || 
      '';

    const rawTime = 
      session.slot?.startTime || 
      session.startTime || 
      session.time || 
      session.slotTime || 
      session.slot?.time || 
      '';

    const locationName = 
      (typeof session.location === 'string' ? session.location : session.location?.name || session.location?.address) || 
      session.slot?.location || 
      session.venue || 
      session.slot?.venue || 
      session.stadium || 
      session.slot?.stadium || 
      (session.stadium?.name ? session.stadium.name : '') ||
      (session.slot?.stadium?.name ? session.slot.stadium.name : '') ||
      (session.venue?.name ? session.venue.name : '') ||
      (session.locationName ? session.locationName : '') ||
      session.arena || 
      session.address || 
      'Central Sports Complex • Field A';

    const numericPrice = 
      session.amountInr || 
      session.amount || 
      session.slot?.pricePerPerson || 
      session.slot?.price || 
      session.price || 
      400;

    const priceText = session.credits 
      ? `${session.credits} Credits` 
      : `₹${numericPrice}`;

    const rawStatusNormalized = (session.status || session.rawStatus || 'requested').toString().toLowerCase().trim();
    let normStatus = 'requested';
    if (rawStatusNormalized === 'ongoing' || rawStatusNormalized === 'active') {
      normStatus = 'ongoing';
    } else if (rawStatusNormalized === 'confirmed' || rawStatusNormalized === 'accepted' || rawStatusNormalized === 'approved') {
      normStatus = 'accepted';
    } else if (rawStatusNormalized === 'completed' || rawStatusNormalized === 'done') {
      normStatus = 'completed';
    } else if (rawStatusNormalized === 'cancelled' || rawStatusNormalized === 'canceled' || rawStatusNormalized === 'declined' || rawStatusNormalized === 'no_show' || rawStatusNormalized === 'no-show') {
      normStatus = 'cancelled';
    } else {
      normStatus = 'requested';
    }

    let uiStatus = 'Requested';
    if (normStatus === 'ongoing') uiStatus = 'Ongoing';
    else if (normStatus === 'accepted') uiStatus = 'Confirmed';
    else if (normStatus === 'completed') uiStatus = 'Completed';
    else if (normStatus === 'cancelled') uiStatus = 'Cancelled';
    else uiStatus = 'Requested';

    return {
      id,
      name: studentName,
      sport: sportTitle,
      subtitle: `${sportTitle} • ${priceText}`,
      price: numericPrice.toString(),
      date: formatSessionDate(rawDate),
      time: formatSessionTime(rawTime),
      rawDate,
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

    if (st === 'confirmed' || st === 'accepted' || st === 'approved' || st === 'upcoming') return 'accepted';
    if (st === 'ongoing' || st === 'active' || st === 'started' || st === 'in_progress') return 'ongoing';
    if (st === 'completed' || st === 'done' || st === 'finished') return 'completed';
    if (st === 'cancelled' || st === 'canceled' || st === 'declined' || st === 'rejected' || st === 'no_show' || st === 'no-show') return 'cancelled';
    
    return 'requested';
  };

  // Segregate sessions into 3 tabs: Upcoming (requested + accepted), Current (ongoing), Completed
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
                    {booking.name}
                  </Typography>
                  <Typography variant="caption" color="muted" weight="bold">
                    {booking.subtitle}
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
                    pathname: '/(shared)/session-summary',
                    params: { 
                      id: booking.id,
                      status: 'requested',
                      studentName: booking.name,
                      date: booking.date,
                      time: booking.time,
                      location: booking.location,
                      price: booking.price
                    }
                  })}
                  className="px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 items-center justify-center active:opacity-80"
                >
                  <Typography variant="subtitle2" className="text-blue-700 text-xs font-outfit-bold">
                    Details
                  </Typography>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row justify-end mt-1">
                <View className="w-36">
                  <Button 
                    title="View Details" 
                    size="sm"
                    onPress={() => router.push({
                      pathname: '/(shared)/session-summary',
                      params: { 
                        id: booking.id,
                        status: activeTab === 'current' ? 'ongoing' : activeTab === 'upcoming' ? 'accepted' : booking.rawStatus,
                        studentName: booking.name,
                        date: booking.date,
                        time: booking.time,
                        location: booking.location,
                        price: booking.price
                      }
                    })}
                  />
                </View>
              </View>
            )}
          </View>
        )))}

      </ScrollView>
    </SafeAreaView>
  );
}
