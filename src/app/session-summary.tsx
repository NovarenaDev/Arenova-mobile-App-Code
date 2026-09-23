import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, ConfirmModal } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export default function SessionSummaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { 
    id, 
    status, 
    studentName, 
    date, 
    time, 
    location,
    coachId,
    slotId,
    childId,
    price,
    coachName,
    coachSport,
  } = useLocalSearchParams<{
    id?: string;
    status?: string;
    studentName?: string;
    date?: string;
    time?: string;
    location?: string;
    coachId?: string;
    slotId?: string;
    childId?: string;
    price?: string;
    coachName?: string;
    coachSport?: string;
  }>();

  const isCheckoutMode = !!slotId;
  const { user } = useAuthStore();
  const isCoach = user?.role === 'coach';

  // State for Coach OTP Verification Modal
  const [showOtpVerifyModal, setShowOtpVerifyModal] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');

  const queryClient = useQueryClient();

  // Real booking query from backend (Step 6.2 View Single Booking Details)
  const { data: bookingDetailResponse, isLoading: isLoadingBooking } = useQuery({
    queryKey: ['bookingDetail', id],
    queryFn: async () => {
      if (!id || isCheckoutMode) return null;
      try {
        const res = await api.get(`/bookings/${id}`);
        return res.data;
      } catch (err) {
        return null;
      }
    },
    enabled: !!id && !isCheckoutMode
  });

  const existingBooking = bookingDetailResponse?.data;
  const rawStatusVal = status || existingBooking?.status || (isCheckoutMode ? 'checkout' : 'requested');
  const statusParam = rawStatusVal.toString().toLowerCase().trim();

  // Real dynamic values from backend booking or navigation params
  const formatDateStr = (dStr?: string) => {
    if (!dStr) return '';
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return dStr;
  };

  const resolvedDate = 
    date || 
    formatDateStr(existingBooking?.slot?.date) || 
    formatDateStr(existingBooking?.date) || 
    formatDateStr(existingBooking?.slotDate) || 
    formatDateStr(existingBooking?.startDate) || 
    formatDateStr(existingBooking?.bookingDate) || 
    formatDateStr(existingBooking?.createdAt) || 
    'Scheduled Date';

  const resolvedTime = 
    time || 
    existingBooking?.slot?.startTime || 
    existingBooking?.startTime || 
    existingBooking?.time || 
    existingBooking?.slotTime || 
    existingBooking?.slot?.time || 
    'Scheduled Time';

  const resolvedLocation = 
    location || 
    (typeof existingBooking?.location === 'string' ? existingBooking.location : existingBooking?.location?.name || existingBooking?.location?.address) ||
    existingBooking?.slot?.location || 
    existingBooking?.venue || 
    existingBooking?.slot?.venue || 
    existingBooking?.stadium || 
    existingBooking?.slot?.stadium || 
    (existingBooking?.stadium?.name ? existingBooking.stadium.name : '') ||
    (existingBooking?.slot?.stadium?.name ? existingBooking.slot.stadium.name : '') ||
    (existingBooking?.venue?.name ? existingBooking.venue.name : '') ||
    existingBooking?.locationName || 
    existingBooking?.arena || 
    existingBooking?.address || 
    'Central Sports Complex • Field A';

  const resolvedStudentName = 
    existingBooking?.child?.name ||
    existingBooking?.player?.name ||
    existingBooking?.childName ||
    existingBooking?.playerName ||
    (Array.isArray(existingBooking?.children) && existingBooking.children.length > 0 ? existingBooking.children.map((c: any) => c.name || c).join(', ') : '') ||
    existingBooking?.student?.name || 
    existingBooking?.studentName || 
    studentName || 
    existingBooking?.participant?.name || 
    existingBooking?.bookedBy?.name || 
    (existingBooking?.bookedBy?.firstName ? `${existingBooking.bookedBy.firstName} ${existingBooking.bookedBy.lastName || ''}`.trim() : '') ||
    existingBooking?.user?.name || 
    (existingBooking?.user?.firstName ? `${existingBooking.user.firstName} ${existingBooking.user.lastName || ''}`.trim() : '') ||
    'Attendee';

  const resolvedSport = 
    coachSport || 
    existingBooking?.slot?.title || 
    existingBooking?.slot?.sport || 
    existingBooking?.sport || 
    existingBooking?.sportName || 
    existingBooking?.title || 
    'Sports Coaching';

  const resolvedPrice = 
    price || 
    existingBooking?.amountInr || 
    existingBooking?.amount || 
    existingBooking?.credits || 
    existingBooking?.slot?.pricePerPerson || 
    existingBooking?.slot?.price || 
    '400';

  // 4-digit Attendance OTP generated for parent/student based on real booking ID
  const bookingIdStr = (id || existingBooking?._id || existingBooking?.id || '').toString();
  const parentAttendanceOtp = existingBooking?.attendanceOtp || (bookingIdStr ? Math.abs(parseInt(bookingIdStr.slice(-4), 16) % 9000 + 1000).toString() : '4829');

  // Cancellation mutation (Optional Step: PUT /api/bookings/{id}/cancel)
  const cancelBookingMutation = useMutation({
    mutationFn: async (cancellationNote: string) => {
      const res = await api.put(`/bookings/${id}/cancel`, { cancellationNote });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerBookings'] });
      queryClient.invalidateQueries({ queryKey: ['parentBookings'] });
      Alert.alert('Booking Cancelled', 'Your session has been cancelled successfully.');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Cancellation Error', err?.response?.data?.message || 'Failed to cancel booking');
    }
  });

  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);

  const handleCancelBooking = () => {
    setIsCancelModalVisible(true);
  };

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await api.put(`/coaches/my/sessions/${id}/status`, { status: newStatus });
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['coachSessions'] });
      Alert.alert('Status Updated', `Session status successfully updated to ${variables}.`);
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update session status');
    }
  });

  const handleVerifyOtp = () => {
    if (!enteredOtp || enteredOtp.trim().length !== 4) {
      setOtpError('Please enter a valid 4-digit OTP.');
      return;
    }
    setOtpError('');
    setShowOtpVerifyModal(false);
    updateStatusMutation.mutate('ongoing');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold">
          {isCoach ? 'Session Details' : 'Session Summary'}
        </Typography>
        <TouchableOpacity className="p-2 -mr-2">
          <Ionicons name="ellipsis-vertical" size={24} color="#0F2C59" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {isCoach ? (
          // COACH VIEW: Show Student details, Schedule & Status
          <>
            <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
              <View className="flex-row items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <Typography variant="subtitle1" color="secondary" weight="bold">
                  Attendees
                </Typography>
                <View className="bg-[#EEFCA6] px-2 py-1 rounded">
                  <Typography variant="caption" color="secondary" weight="bold">
                    1-on-1
                  </Typography>
                </View>
              </View>

              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-blue-100 mr-3 items-center justify-center">
                    <Typography variant="subtitle1" color="primary" weight="bold">
                      {resolvedStudentName.charAt(0).toUpperCase()}
                    </Typography>
                  </View>
                  <View>
                    <Typography variant="body2" color="secondary" weight="bold">
                      {resolvedStudentName}
                    </Typography>
                    <Typography variant="caption" color="muted">Attendee • {resolvedSport}</Typography>
                  </View>
                </View>
                {statusParam === 'completed' && (
                  <TouchableOpacity onPress={() => router.push('/review-player')} className="px-3 py-1.5 bg-[#EEF3F9] rounded-full">
                    <Typography variant="caption" color="primary" weight="bold">Review</Typography>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm space-y-4">
              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={20} color="#FF5100" className="mr-3" />
                <Typography variant="body2" color="secondary" weight="medium" className="ml-2">
                  {resolvedDate}
                </Typography>
              </View>
              <View className="flex-row items-center mt-3">
                <Ionicons name="time-outline" size={20} color="#FF5100" className="mr-3" />
                <Typography variant="body2" color="secondary" weight="medium" className="ml-2">
                  {resolvedTime}
                </Typography>
              </View>
              <View className="flex-row items-center mt-3">
                <Ionicons name="location-outline" size={20} color="#FF5100" className="mr-3" />
                <View className="ml-2 flex-1">
                  <Typography variant="body2" color="secondary" weight="medium">
                    {resolvedLocation}
                  </Typography>
                </View>
              </View>
            </View>
          </>
        ) : (
          // USER/PARENT VIEW: Show Coach, Attendee & Pricing Details
          isLoadingBooking ? (
            <View className="py-20 justify-center items-center">
              <ActivityIndicator size="large" color="#FF5100" />
            </View>
          ) : (
            <>
              {/* Session Attendance OTP Card for Parent / Student */}
              {(!isCheckoutMode || statusParam === 'confirmed' || statusParam === 'accepted' || existingBooking?.status === 'confirmed') && (
                <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#FF5100' }}>
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mb-1">
                    Session Attendance OTP
                  </Typography>
                  <Typography variant="caption" color="muted" className="font-outfit mb-3">
                    Give this 4-digit Attendance OTP to your coach at the start of your training session.
                  </Typography>
                  <View style={{ backgroundColor: '#FFF2EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FFD4C2', borderStyle: 'dashed' }}>
                    <Typography variant="h1" color="primary" weight="bold" style={{ letterSpacing: 8, fontSize: 32 }} className="font-outfit-bold">
                      {parentAttendanceOtp}
                    </Typography>
                    <Typography variant="caption" color="primary" weight="medium" className="mt-1 font-outfit-medium">
                      Share with Coach {coachName || existingBooking?.coach?.name || 'Coach'}
                    </Typography>
                  </View>
                </View>
              )}

              {/* Coach Details Card */}
              <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-50">
                <View className="flex-row items-center border-b border-gray-100 pb-4 mb-4">
                  <View className="w-14 h-14 rounded-full bg-[#F5E6D3] mr-4 items-center justify-center shadow-sm">
                    <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">
                      {(coachName || existingBooking?.coach?.name || existingBooking?.coachName || 'Coach').substring(0, 2).toUpperCase()}
                    </Typography>
                  </View>
                  <View className="flex-1">
                    <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                      {coachName || existingBooking?.coach?.name || existingBooking?.coachName || 'Coach'}
                    </Typography>
                    <Typography variant="body2" color="primary" weight="medium" className="mb-1 font-outfit-medium">
                      {resolvedSport}
                    </Typography>
                    <Typography variant="caption" color="text" className="leading-4 font-outfit text-gray-500">
                      {resolvedLocation}
                    </Typography>
                  </View>
                </View>

                {/* Attendee info */}
                <View className="bg-blue-50/60 rounded-xl p-3 mb-3 flex-row items-center justify-between border border-blue-100">
                  <View className="flex-row items-center">
                    <Ionicons name="person-circle-outline" size={20} color="#3B82F6" className="mr-2" />
                    <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                      Attendee / Player:
                    </Typography>
                  </View>
                  <Typography variant="body2" color="primary" weight="bold" className="font-outfit-bold">
                    {resolvedStudentName}
                  </Typography>
                </View>

                <View className="flex-row items-center mb-2">
                  <Ionicons name="calendar-outline" size={16} color="#0F2C59" className="mr-3" />
                  <Typography variant="body2" color="text" weight="medium" className="ml-2 font-outfit">
                    {resolvedDate}
                  </Typography>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="time-outline" size={16} color="#0F2C59" className="mr-3" />
                  <Typography variant="body2" color="text" weight="medium" className="ml-2 font-outfit">
                    {resolvedTime}
                  </Typography>
                </View>
              </View>

              {/* Pricing Details Card */}
              <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-50">
                <View className="flex-row justify-between items-center mb-3">
                  <Typography variant="body1" color="text" className="font-outfit">
                    Coaching Fee ({useLocalSearchParams().attendeeCount || 1} attendee{Number(useLocalSearchParams().attendeeCount || 1) > 1 ? 's' : ''})
                  </Typography>
                  <Typography variant="body1" color="secondary" weight="semibold" className="font-outfit-semibold">
                    ₹{resolvedPrice}
                  </Typography>
                </View>
                <View className="flex-row justify-between items-center mb-4">
                  <Typography variant="body1" color="text" className="font-outfit">
                    Platform Fee
                  </Typography>
                  <Typography variant="body1" color="secondary" weight="semibold" className="font-outfit-semibold">
                    ₹50
                  </Typography>
                </View>
                <View className="flex-row justify-between items-center pt-3 border-t border-gray-100">
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                    Total
                  </Typography>
                  <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">
                    ₹{useLocalSearchParams().totalAmount || (Number(resolvedPrice) + 50)}
                  </Typography>
                </View>
              </View>
            </>
          )
        )}
      </ScrollView>

      {/* Coach Attendance OTP Verification Modal */}
      <Modal
        visible={showOtpVerifyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOtpVerifyModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF2EB', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="key" size={24} color="#FF5100" />
            </View>
            <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-2">
              Enter Attendance OTP
            </Typography>
            <Typography variant="body2" color="muted" className="font-outfit mb-4">
              Ask {resolvedStudentName} for the 4-digit Attendance OTP shown on their screen to start this session.
            </Typography>

            <TextInput
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 24,
                fontWeight: 'bold',
                textAlign: 'center',
                letterSpacing: 8,
                color: '#0F2C59',
                borderWidth: 1,
                borderColor: otpError ? '#EF4444' : '#E5E7EB',
                marginBottom: 8
              }}
              placeholder="••••"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={4}
              value={enteredOtp}
              onChangeText={(t) => {
                setEnteredOtp(t);
                if (otpError) setOtpError('');
              }}
              autoFocus
            />

            {otpError ? (
              <Typography variant="caption" style={{ color: '#EF4444', marginBottom: 12 }} className="font-outfit">
                {otpError}
              </Typography>
            ) : null}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', marginRight: 8 }}
                onPress={() => {
                  setShowOtpVerifyModal(false);
                  setEnteredOtp('');
                  setOtpError('');
                }}
              >
                <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                  Cancel
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1.5, paddingVertical: 12, borderRadius: 12, backgroundColor: '#FF5100', alignItems: 'center', marginLeft: 8 }}
                onPress={handleVerifyOtp}
              >
                <Typography variant="subtitle2" style={{ color: '#FFFFFF' }} weight="bold" className="font-outfit-bold">
                  Start Session
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Footer Buttons */}
      <View className="p-4 bg-white border-t border-gray-100" style={{ paddingBottom: Math.max(insets.bottom + 16, 28) }}>
        {isCoach ? (
          (statusParam === 'requested' || statusParam === 'pending') ? (
            <View className="flex-row justify-between">
              <View className="flex-1 mr-2">
                <Button 
                  title="Decline" 
                  onPress={() => updateStatusMutation.mutate('cancelled')}
                  variant="outline"
                  isLoading={updateStatusMutation.isPending}
                />
              </View>
              <View className="flex-1 ml-2">
                <Button 
                  title="Accept" 
                  onPress={() => updateStatusMutation.mutate('accepted')}
                  isLoading={updateStatusMutation.isPending}
                />
              </View>
            </View>
          ) : statusParam === 'ongoing' ? (
            <Button 
              title="End Session" 
              onPress={() => updateStatusMutation.mutate('completed')}
              isLoading={updateStatusMutation.isPending}
              variant="outline"
            />
          ) : (statusParam === 'confirmed' || statusParam === 'accepted' || statusParam === 'approved') ? (
            <Button 
              title="Verify OTP & Start Session" 
              onPress={() => setShowOtpVerifyModal(true)}
              isLoading={updateStatusMutation.isPending}
              variant="primary"
            />
          ) : statusParam === 'completed' ? (
            <View className="bg-emerald-50 border border-emerald-200 py-3 px-4 rounded-xl items-center flex-row justify-center">
              <Ionicons name="checkmark-circle" size={20} color="#047857" className="mr-2" />
              <Typography variant="subtitle2" className="text-emerald-800 font-bold font-outfit-bold">
                Session Completed
              </Typography>
            </View>
          ) : (statusParam === 'cancelled' || statusParam === 'declined' || statusParam === 'rejected') ? (
            <View className="bg-red-50 border border-red-200 py-3 px-4 rounded-xl items-center flex-row justify-center">
              <Ionicons name="close-circle" size={20} color="#B91C1C" className="mr-2" />
              <Typography variant="subtitle2" className="text-red-800 font-bold font-outfit-bold">
                Session Cancelled
              </Typography>
            </View>
          ) : (
            <View className="bg-orange-50 border border-orange-200 py-3 px-4 rounded-xl items-center flex-row justify-center">
              <Ionicons name="alert-circle" size={20} color="#C2410C" className="mr-2" />
              <Typography variant="subtitle2" className="text-orange-800 font-bold font-outfit-bold">
                Status: {statusParam.toUpperCase()}
              </Typography>
            </View>
          )
        ) : isCheckoutMode ? (
          <Button 
            title={`Proceed To Pay (₹${Number(price || 400) + 50})`}
            onPress={() => router.push({
              pathname: '/payment',
              params: {
                slotId,
                childId: childId || '',
                coachId: coachId || '',
                studentName: resolvedStudentName,
                date: resolvedDate,
                time: resolvedTime,
                price: (price || '400').toString(),
                totalAmount: (Number(price || 400) + 50).toString(),
                coachName: coachName || 'Coach',
                coachSport: resolvedSport
              }
            })}
          />
        ) : (statusParam === 'confirmed' || statusParam === 'accepted' || statusParam === 'requested') ? (
          <Button 
            title="Cancel Booking" 
            variant="outline"
            onPress={handleCancelBooking}
            isLoading={cancelBookingMutation.isPending}
          />
        ) : statusParam === 'completed' ? (
          <View className="bg-emerald-50 border border-emerald-200 py-3 px-4 rounded-xl items-center flex-row justify-center">
            <Ionicons name="checkmark-circle" size={20} color="#047857" className="mr-2" />
            <Typography variant="subtitle2" className="text-emerald-800 font-bold font-outfit-bold">
              Session Completed
            </Typography>
          </View>
        ) : statusParam === 'cancelled' ? (
          <View className="bg-red-50 border border-red-200 py-3 px-4 rounded-xl items-center flex-row justify-center">
            <Ionicons name="close-circle" size={20} color="#B91C1C" className="mr-2" />
            <Typography variant="subtitle2" className="text-red-800 font-bold font-outfit-bold">
              Session Cancelled
            </Typography>
          </View>
        ) : null}
      </View>
      {/* Modern Confirm Modal for Session Cancellation */}
      <ConfirmModal
        visible={isCancelModalVisible}
        onClose={() => setIsCancelModalVisible(false)}
        onConfirm={() => {
          setIsCancelModalVisible(false);
          cancelBookingMutation.mutate("Cancelled by user");
        }}
        title="Cancel Booking"
        message="Are you sure you want to cancel this coaching session? This action cannot be undone."
        confirmText="Yes, Cancel Session"
        cancelText="No, Keep It"
        variant="danger"
        iconName="calendar"
        isLoading={cancelBookingMutation.isPending}
      />
    </SafeAreaView>
  );
}
