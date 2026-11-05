import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Modal, 
  Alert 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { router, useNavigation } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';
import { 
  formatTimeHHmm, 
  formatWeekdays, 
  formatDateOnly 
} from '@/utils/communityHelpers';

export default function CoachCommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Strict Role Guard: Players and Parents cannot access coach communities screen
  useEffect(() => {
    if (user && user.role !== 'coach') {
      Alert.alert(
        'Access Denied (Role Boundary)',
        'Coach Community is strictly reserved for coaching partners.'
      );
      const target = user.role === 'parent'
        ? '/(parent)/(parent-tabs)/parent-dashboard'
        : '/(individual)/(individual-tabs)/individual-dashboard';
      router.replace(target as any);
    }
  }, [user]);

  const [selectedProgramForSubscribers, setSelectedProgramForSubscribers] = useState<string | null>(null);
  const [selectedProgramTitle, setSelectedProgramTitle] = useState<string>('Program');
  const [subscribersModalVisible, setSubscribersModalVisible] = useState(false);

  const [selectedProgramForHistory, setSelectedProgramForHistory] = useState<string | null>(null);
  const [attendanceHistoryModalVisible, setAttendanceHistoryModalVisible] = useState(false);

  const [salaryHistoryModalVisible, setSalaryHistoryModalVisible] = useState(false);

  const [isStartingGps, setIsStartingGps] = useState<string | null>(null);
  const [isEndingGps, setIsEndingGps] = useState<string | null>(null);

  // 1. Fetch Coach Assigned Communities & Programs
  const { 
    data: communitiesResponse, 
    isLoading: isLoadingCommunities, 
    refetch: refetchCommunities 
  } = useQuery({
    queryKey: ['coachCommunities'],
    queryFn: async () => {
      try {
        const res = await api.get('/coach-app/communities');
        return res.data?.data || res.data || [];
      } catch (e) {
        return [];
      }
    }
  });

  // 2. Fetch Subscribers for Selected Program
  const { 
    data: subscribersResponse, 
    isLoading: isLoadingSubscribers,
    refetch: refetchSubscribers 
  } = useQuery({
    queryKey: ['coachProgramSubscribers', selectedProgramForSubscribers],
    queryFn: async () => {
      if (!selectedProgramForSubscribers) return [];
      try {
        const res = await api.get(`/coach-app/programs/${selectedProgramForSubscribers}/subscribers`);
        return res.data?.data || res.data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!selectedProgramForSubscribers && subscribersModalVisible
  });

  // 3. Fetch Attendance History for Selected Program
  const { 
    data: attendanceHistoryResponse, 
    isLoading: isLoadingAttendanceHistory 
  } = useQuery({
    queryKey: ['coachProgramAttendanceHistory', selectedProgramForHistory],
    queryFn: async () => {
      if (!selectedProgramForHistory) return [];
      try {
        const res = await api.get(`/coach-app/programs/${selectedProgramForHistory}/attendance?page=1&limit=20`);
        return res.data?.data || res.data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!selectedProgramForHistory && attendanceHistoryModalVisible
  });

  // 4. Fetch Salary History
  const { 
    data: salaryHistoryResponse, 
    isLoading: isLoadingSalaryHistory 
  } = useQuery({
    queryKey: ['coachSalaryHistory'],
    queryFn: async () => {
      try {
        const res = await api.get('/coach-app/salary-history?page=1&limit=20');
        return res.data?.data || res.data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: salaryHistoryModalVisible
  });

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refetchCommunities();
    });
    return unsubscribe;
  }, [navigation, refetchCommunities]);

  // GPS Attendance Start
  const handleStartAttendance = async (programId: string) => {
    try {
      setIsStartingGps(programId);

      // 1. Request Foreground Location Permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required', 
          'GPS location access is required to verify your physical presence at the community coaching facility.'
        );
        return;
      }

      // 2. Obtain Fresh Device Coordinates
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;

      // 3. Submit Start Attendance
      const res = await api.post(`/coach-app/programs/${programId}/attendance/start`, {
        latitude,
        longitude
      });

      refetchCommunities();
      queryClient.invalidateQueries({ queryKey: ['coachProgramAttendanceToday', programId] });

      Alert.alert(
        'Session Started!', 
        res.data?.message || 'Daily session check-in verified via GPS successfully.'
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Could not verify GPS check-in.';
      Alert.alert('Attendance Check-in Failed', msg);
    } finally {
      setIsStartingGps(null);
    }
  };

  // GPS Attendance End
  const handleEndAttendance = async (programId: string) => {
    try {
      setIsEndingGps(programId);

      // 1. Request Location Permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission Required', 'GPS location access is required to complete session attendance.');
        return;
      }

      // 2. Obtain Fresh Coordinates
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;

      // 3. Submit End Attendance
      const res = await api.post(`/coach-app/programs/${programId}/attendance/end`, {
        latitude,
        longitude
      });

      refetchCommunities();
      queryClient.invalidateQueries({ queryKey: ['coachProgramAttendanceToday', programId] });

      Alert.alert(
        'Session Completed!', 
        res.data?.message || 'Daily session GPS check-out logged successfully.'
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Could not log session check-out.';
      Alert.alert('Check-out Failed', msg);
    } finally {
      setIsEndingGps(null);
    }
  };

  const programsList: any[] = Array.isArray(communitiesResponse)
    ? communitiesResponse
    : (communitiesResponse?.data || []);

  const subscribersList: any[] = Array.isArray(subscribersResponse)
    ? subscribersResponse
    : (subscribersResponse?.data || []);

  const attendanceHistoryList: any[] = Array.isArray(attendanceHistoryResponse)
    ? attendanceHistoryResponse
    : (attendanceHistoryResponse?.data || []);

  const salaryHistoryList: any[] = Array.isArray(salaryHistoryResponse)
    ? salaryHistoryResponse
    : (salaryHistoryResponse?.data || []);

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 flex-row justify-between items-center bg-[#0F2C59] border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity 
          onPress={() => {
            if (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
              navigation.goBack();
            } else {
              router.replace('/(coach)/(coach-tabs)/coach-dashboard');
            }
          }} 
          className="p-2 -ml-2"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold text-lg">
          My Community Programs
        </Typography>
        <TouchableOpacity 
          onPress={() => refetchCommunities()}
          className="p-2 -mr-2"
        >
          <Ionicons name="refresh" size={22} color="#FF5100" />
        </TouchableOpacity>
      </View>

      {/* Quick Action Bar: Earnings History & Wallet */}
      <View className="bg-white border-b border-gray-100 px-4 py-3 flex-row justify-between items-center">
        <View className="flex-row items-center">
          <Ionicons name="shield-checkmark" size={18} color="#047857" className="mr-1.5" />
          <Typography variant="caption" className="text-[#047857] font-outfit-bold text-xs">
            Contracted Platform Programs
          </Typography>
        </View>

        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => setSalaryHistoryModalVisible(true)}
            className="flex-row items-center bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 mr-2"
          >
            <Ionicons name="cash-outline" size={14} color="#0F2C59" className="mr-1" />
            <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">
              Earnings History
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push('/(coach)/wallet' as any)}
            className="flex-row items-center bg-[#0F2C59] px-3 py-1.5 rounded-full"
          >
            <Ionicons name="wallet-outline" size={14} color="white" className="mr-1" />
            <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
              Wallet
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 60, 80) }}
      >
        {isLoadingCommunities ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#FF5100" />
            <Typography variant="body2" color="muted" className="mt-2 font-outfit">
              Loading assigned community batches...
            </Typography>
          </View>
        ) : programsList.length === 0 ? (
          <View className="bg-white rounded-3xl p-8 items-center border border-gray-100 shadow-sm my-4">
            <Ionicons name="people-circle-outline" size={44} color="#94A3B8" className="mb-3" />
            <Typography variant="h3" color="secondary" weight="bold" align="center" className="mb-2 font-outfit-bold">
              No Assigned Programs Yet
            </Typography>
            <Typography variant="body2" color="muted" align="center" className="font-outfit mb-4">
              Community academies assigned to you by administrators will appear here with your contracted monthly salary.
            </Typography>
            <Button title="Refresh" onPress={() => refetchCommunities()} fullWidth={false} className="px-6" />
          </View>
        ) : (
          programsList.map((item: any) => {
            const programId = item.programId || item._id || item.id;
            const communityName = item.community?.name || item.communityName || 'Sports Academy';
            const communityAddress = item.community?.address || item.address || '';
            const communityCity = item.community?.city || item.city || '';
            const timeZone = item.community?.timeZone || item.timeZone || 'Asia/Kolkata';
            const salary = item.salary ?? item.ownSalary ?? 0;
            const isLive = item.isAttendanceActive || false;

            return (
              <View 
                key={programId}
                className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-gray-100 relative overflow-hidden"
              >
                {/* Header Row */}
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center mb-1">
                      <View className="bg-primary/10 px-2.5 py-0.5 rounded-full mr-2">
                        <Typography variant="caption" color="primary" weight="bold" className="text-[10px]">
                          {item.sport || 'Sports'}
                        </Typography>
                      </View>
                      <Typography variant="caption" color="muted" weight="semibold" className="text-xs font-outfit flex-1" numberOfLines={1}>
                        {communityName} • {communityCity}
                      </Typography>
                    </View>

                    <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold text-base">
                      {item.title || item.name}
                    </Typography>
                  </View>

                  {/* Contracted Monthly Salary Badge */}
                  <View className="bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full items-end">
                    <Typography variant="caption" className="text-emerald-800 font-outfit-bold text-xs">
                      ₹{salary.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" className="text-emerald-700 font-outfit text-[9px]">
                      / month fixed
                    </Typography>
                  </View>
                </View>

                {/* Schedule Box */}
                <View className="bg-slate-50 rounded-2xl p-3 mb-3 border border-slate-100">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="calendar-outline" size={13} color="#64748B" className="mr-1.5" />
                    <Typography variant="caption" color="secondary" weight="semibold" className="font-outfit-semibold text-xs">
                      {formatWeekdays(item.sessionDays)}
                    </Typography>
                  </View>

                  <View className="flex-row items-center mb-1">
                    <Ionicons name="time-outline" size={13} color="#64748B" className="mr-1.5" />
                    <Typography variant="caption" color="muted" className="font-outfit text-xs">
                      {formatTimeHHmm(item.sessionStartTime)} - {formatTimeHHmm(item.sessionEndTime)} ({timeZone})
                    </Typography>
                  </View>

                  {communityAddress ? (
                    <View className="flex-row items-center">
                      <Ionicons name="location-outline" size={13} color="#64748B" className="mr-1.5" />
                      <Typography variant="caption" color="muted" className="font-outfit text-xs" numberOfLines={1}>
                        {communityAddress}
                      </Typography>
                    </View>
                  ) : null}
                </View>

                {/* Daily GPS Attendance Controls */}
                <CoachTodayAttendanceCard 
                  programId={programId}
                  isStarting={isStartingGps === programId}
                  isEnding={isEndingGps === programId}
                  onStart={() => handleStartAttendance(programId)}
                  onEnd={() => handleEndAttendance(programId)}
                />

                {/* Action Buttons: Subscribers & Attendance Log */}
                <View className="flex-row items-center justify-between pt-3 border-t border-gray-100 mt-2">
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedProgramForSubscribers(programId);
                      setSelectedProgramTitle(item.title || item.name || 'Program');
                      setSubscribersModalVisible(true);
                    }}
                    className="flex-row items-center bg-gray-100 px-3.5 py-1.5 rounded-full border border-gray-200"
                  >
                    <Ionicons name="people-outline" size={14} color="#0F2C59" className="mr-1.5" />
                    <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">
                      Subscribers
                    </Typography>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedProgramForHistory(programId);
                      setSelectedProgramTitle(item.title || item.name || 'Program');
                      setAttendanceHistoryModalVisible(true);
                    }}
                    className="flex-row items-center bg-gray-100 px-3.5 py-1.5 rounded-full border border-gray-200"
                  >
                    <Ionicons name="receipt-outline" size={14} color="#0F2C59" className="mr-1.5" />
                    <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">
                      Attendance Log
                    </Typography>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: PROGRAM SUBSCRIBERS LIST                                         */}
      {/* ========================================================================= */}
      <Modal
        visible={subscribersModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSubscribersModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setSubscribersModalVisible(false)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200 max-h-[85%]"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-xl">
                  Program Subscribers
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit text-xs">
                  {selectedProgramTitle}
                </Typography>
              </View>
              <TouchableOpacity onPress={() => setSubscribersModalVisible(false)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {isLoadingSubscribers ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color="#FF5100" />
                <Typography variant="body2" color="muted" className="mt-2 font-outfit">
                  Loading subscribers...
                </Typography>
              </View>
            ) : subscribersList.length === 0 ? (
              <View className="p-8 bg-gray-50 rounded-2xl items-center border border-gray-200 my-4">
                <Ionicons name="people-outline" size={36} color="#94A3B8" className="mb-2" />
                <Typography variant="body2" color="muted" align="center" className="font-outfit">
                  No active subscribers enrolled in this program batch yet.
                </Typography>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {subscribersList.map((sub: any, idx: number) => {
                  const subId = sub._id || sub.id || idx.toString();
                  const pName = sub.participantName || sub.name || 'Participant';
                  const payerName = sub.payer?.name || sub.userId?.name;

                  return (
                    <View key={subId} className="bg-gray-50 rounded-2xl p-4 mb-2.5 border border-gray-200 flex-row items-center justify-between">
                      <View className="flex-1 mr-2">
                        <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                          {pName}
                        </Typography>
                        {payerName && payerName !== pName ? (
                          <Typography variant="caption" color="muted" className="font-outfit text-xs">
                            Parent/Payer: {payerName}
                          </Typography>
                        ) : null}
                        <Typography variant="caption" color="muted" className="font-outfit text-[11px] mt-0.5">
                          Period: {formatDateOnly(sub.plan?.startDate)} — {formatDateOnly(sub.plan?.endDate)}
                        </Typography>
                      </View>

                      <View className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        <Typography variant="caption" className="text-emerald-700 font-outfit-bold text-xs">
                          {sub.status || 'Active'}
                        </Typography>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: ATTENDANCE HISTORY LOG                                           */}
      {/* ========================================================================= */}
      <Modal
        visible={attendanceHistoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttendanceHistoryModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setAttendanceHistoryModalVisible(false)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200 max-h-[85%]"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-xl">
                  Attendance Records
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit text-xs">
                  {selectedProgramTitle}
                </Typography>
              </View>
              <TouchableOpacity onPress={() => setAttendanceHistoryModalVisible(false)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {isLoadingAttendanceHistory ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color="#FF5100" />
                <Typography variant="body2" color="muted" className="mt-2 font-outfit">
                  Loading attendance records...
                </Typography>
              </View>
            ) : attendanceHistoryList.length === 0 ? (
              <View className="p-8 bg-gray-50 rounded-2xl items-center border border-gray-200 my-4">
                <Ionicons name="time-outline" size={36} color="#94A3B8" className="mb-2" />
                <Typography variant="body2" color="muted" align="center" className="font-outfit">
                  No previous attendance records recorded for this program yet.
                </Typography>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {attendanceHistoryList.map((rec: any, idx: number) => {
                  const recId = rec._id || rec.id || idx.toString();
                  const isCompleted = rec.status === 'completed';
                  const isStarted = rec.status === 'started';
                  const isNoShow = rec.status === 'no_show';

                  return (
                    <View key={recId} className="bg-gray-50 rounded-2xl p-4 mb-2.5 border border-gray-200">
                      <View className="flex-row items-center justify-between mb-1.5">
                        <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                          {formatDateOnly(rec.date || rec.createdAt)}
                        </Typography>

                        <View className={`px-2.5 py-0.5 rounded-full border ${
                          isCompleted 
                            ? 'bg-emerald-50 border-emerald-200' 
                            : isStarted 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-rose-50 border-rose-200'
                        }`}>
                          <Typography variant="caption" weight="bold" className={`text-[11px] font-outfit-bold ${
                            isCompleted 
                              ? 'text-emerald-700' 
                              : isStarted 
                              ? 'text-blue-700' 
                              : 'text-rose-700'
                          }`}>
                            {isCompleted ? (rec.autoClosed ? 'Auto-Closed' : 'Completed') : isStarted ? 'In Progress' : 'No Show'}
                          </Typography>
                        </View>
                      </View>

                      {rec.startAt && (
                        <Typography variant="caption" color="muted" className="font-outfit text-xs">
                          Check-in: {new Date(rec.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {rec.endAt ? ` • Check-out: ${new Date(rec.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </Typography>
                      )}

                      {rec.reviewRequired && (
                        <View className="mt-1 bg-amber-50 p-2 rounded-xl border border-amber-200">
                          <Typography variant="caption" className="text-amber-800 font-outfit text-xs">
                            Review Required: Missing check-out or connectivity issue under admin review.
                          </Typography>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: SALARY PAYOUT HISTORY                                            */}
      {/* ========================================================================= */}
      <Modal
        visible={salaryHistoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSalaryHistoryModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setSalaryHistoryModalVisible(false)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200 max-h-[85%]"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-xl">
                  Earnings History
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit text-xs">
                  Fixed platform-funded coaching contract payouts
                </Typography>
              </View>
              <TouchableOpacity onPress={() => setSalaryHistoryModalVisible(false)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {isLoadingSalaryHistory ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color="#FF5100" />
                <Typography variant="body2" color="muted" className="mt-2 font-outfit">
                  Loading salary payouts...
                </Typography>
              </View>
            ) : salaryHistoryList.length === 0 ? (
              <View className="p-8 bg-gray-50 rounded-2xl items-center border border-gray-200 my-4">
                <Ionicons name="cash-outline" size={36} color="#94A3B8" className="mb-2" />
                <Typography variant="body2" color="muted" align="center" className="font-outfit">
                  No monthly contract payouts recorded yet. Completed month payouts will appear here.
                </Typography>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {salaryHistoryList.map((item: any, idx: number) => {
                  const itemId = item._id || item.id || idx.toString();
                  const amount = item.amount ?? item.salary ?? 0;
                  const month = item.month || item.period || 'Monthly Payout';

                  return (
                    <View key={itemId} className="bg-gray-50 rounded-2xl p-4 mb-2.5 border border-gray-200 flex-row items-center justify-between">
                      <View className="flex-1 mr-2">
                        <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                          {month}
                        </Typography>
                        <Typography variant="caption" color="muted" className="font-outfit text-xs">
                          {item.programTitle || 'Community Program'}
                        </Typography>
                      </View>

                      <View className="items-end">
                        <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold text-base">
                          ₹{amount.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" className="text-emerald-700 font-outfit-bold text-xs">
                          {item.status || 'Paid'}
                        </Typography>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/**
 * Subcomponent to fetch and manage today's daily GPS attendance for a program
 */
function CoachTodayAttendanceCard({
  programId,
  isStarting,
  isEnding,
  onStart,
  onEnd
}: {
  programId: string;
  isStarting: boolean;
  isEnding: boolean;
  onStart: () => void;
  onEnd: () => void;
}) {
  const { data: todayResponse, isLoading, refetch } = useQuery({
    queryKey: ['coachProgramAttendanceToday', programId],
    queryFn: async () => {
      try {
        const res = await api.get(`/coach-app/programs/${programId}/attendance/today`);
        return res.data?.data || res.data || null;
      } catch (e) {
        return null;
      }
    }
  });

  if (isLoading) {
    return (
      <View className="p-3 bg-gray-50 rounded-2xl border border-gray-200 mb-2 items-center">
        <ActivityIndicator size="small" color="#FF5100" />
      </View>
    );
  }

  const attendance = todayResponse?.attendance;
  const isScheduledToday = todayResponse?.isScheduled !== false;
  const status = attendance?.status;

  const isLive = status === 'started';
  const isCompleted = status === 'completed';
  const isNoShow = status === 'no_show';

  return (
    <View className="bg-gray-50 rounded-2xl p-3 border border-gray-200 mb-2">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Ionicons name="navigate-circle-outline" size={16} color="#FF5100" className="mr-1.5" />
          <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">
            Today's GPS Attendance
          </Typography>
        </View>

        {isLive ? (
          <View className="flex-row items-center bg-emerald-500 px-2.5 py-0.5 rounded-full">
            <View className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-pulse" />
            <Typography variant="caption" color="white" weight="bold" className="text-[10px] uppercase">
              In Progress
            </Typography>
          </View>
        ) : isCompleted ? (
          <View className="bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <Typography variant="caption" className="text-emerald-700 font-outfit-bold text-[10px]">
              {attendance?.autoClosed ? 'Auto-Closed' : 'Completed'}
            </Typography>
          </View>
        ) : isNoShow ? (
          <View className="bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
            <Typography variant="caption" className="text-rose-700 font-outfit-bold text-[10px]">
              Review Required
            </Typography>
          </View>
        ) : !isScheduledToday ? (
          <View className="bg-gray-200 px-2.5 py-0.5 rounded-full">
            <Typography variant="caption" color="muted" className="text-[10px] font-outfit">
              No Session Today
            </Typography>
          </View>
        ) : (
          <View className="bg-slate-200 px-2.5 py-0.5 rounded-full">
            <Typography variant="caption" color="secondary" className="text-[10px] font-outfit">
              Not Checked In
            </Typography>
          </View>
        )}
      </View>

      {/* Start / End CTA */}
      {isLive ? (
        <Button
          title={isEnding ? "Verifying GPS Check-out..." : "End Session (GPS Check-out)"}
          variant="secondary"
          size="sm"
          isLoading={isEnding}
          disabled={isEnding}
          onPress={onEnd}
          className="mt-1 bg-red-600"
        />
      ) : isCompleted ? (
        <Typography variant="caption" color="muted" className="font-outfit text-xs">
          Daily attendance logged. Check-in: {attendance?.startAt ? new Date(attendance.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Logged'}
        </Typography>
      ) : isScheduledToday ? (
        <Button
          title={isStarting ? "Acquiring GPS Coordinates..." : "Start Session (GPS Check-in)"}
          size="sm"
          isLoading={isStarting}
          disabled={isStarting}
          onPress={onStart}
          className="mt-1"
        />
      ) : (
        <Typography variant="caption" color="muted" className="font-outfit text-xs">
          No coaching session is scheduled for this batch today.
        </Typography>
      )}
    </View>
  );
}

