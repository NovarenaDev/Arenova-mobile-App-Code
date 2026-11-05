import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Linking, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, ConfirmModal } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { SessionOtpVerificationModal } from '@/components/shared/SessionOtpVerificationModal';
import { resolveSessionTime, resolveSessionDate, resolveSessionSport, resolveSessionLocation, resolveStudentName } from '@/utils/sessionFormatter';

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
    childIds,
    attendeeCount,
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
    childIds?: string;
    attendeeCount?: string;
    price?: string;
    coachName?: string;
    coachSport?: string;
  }>();

  const isCheckoutMode = !!slotId;
  const { user } = useAuthStore();
  const isCoach = user?.role === 'coach';

  const [showOtpVerifyModal, setShowOtpVerifyModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeType, setDisputeType] = useState<'COACH_ABSENCE' | 'EARLY_DEPARTURE' | 'OTHER'>('COACH_ABSENCE');
  const [disputeReason, setDisputeReason] = useState('');

  const [showCoachCancelModal, setShowCoachCancelModal] = useState(false);
  const [coachCancelReason, setCoachCancelReason] = useState('');

  const [showNoPlayersModal, setShowNoPlayersModal] = useState(false);
  const [noPlayersReason, setNoPlayersReason] = useState('Attended at the court, but no players arrived.');
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  const queryClient = useQueryClient();

  const handleDownloadInvoice = async () => {
    setIsDownloadingInvoice(true);
    try {
      let invoiceId = existingBooking?.invoiceId || existingBooking?.invoice?._id || existingBooking?.invoice?.id;

      if (!invoiceId) {
        const invoicesRes = await api.get('/invoices/my', { params: { type: 'session_booking', limit: 20 } }).catch(() => null);
        const invoiceList = invoicesRes?.data?.data || invoicesRes?.data || [];
        const match = invoiceList.find((inv: any) => 
          inv.bookingId === id || inv.booking?._id === id || inv.slotId === existingBooking?.slot?._id
        ) || invoiceList[0];

        if (match) {
          invoiceId = match._id || match.id;
        }
      }

      if (!invoiceId) {
        Alert.alert('Invoice Generating', 'Your invoice is being processed. It will be ready shortly.');
        setIsDownloadingInvoice(false);
        return;
      }

      const downloadRes = await api.get(`/invoices/${invoiceId}/download`);
      const downloadData = downloadRes.data?.data || downloadRes.data;
      const pdfUrl = downloadData?.downloadUrl || downloadData?.url || downloadData?.pdfUrl;

      if (pdfUrl) {
        await Linking.openURL(pdfUrl);
      } else {
        Alert.alert('Notice', 'Invoice document will be ready shortly.');
      }
      setIsDownloadingInvoice(false);
    } catch (err: any) {
      setIsDownloadingInvoice(false);
      Alert.alert('Invoice', err?.response?.data?.message || 'Invoice will be ready shortly.');
    }
  };

  const { data: bookingDetailResponse, isLoading: isLoadingBooking, refetch: refetchBooking } = useQuery({
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

  const isPaid = existingBooking?.paymentStatus === 'paid' || statusParam === 'confirmed' || statusParam === 'completed';
  const isDisputed = existingBooking?.isDisputed || existingBooking?.financialHold || existingBooking?.settlementState === 'HELD';

  const formatDateStr = (dStr?: string) => {
    if (!dStr) return '';
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return dStr;
  };

  const coachUser = isCoach ? user : existingBooking?.coach;

  const resolvedDate = date && date !== 'Scheduled Date' 
    ? resolveSessionDate(date) 
    : resolveSessionDate(
        existingBooking?.slot?.date || 
        existingBooking?.date || 
        existingBooking?.slotDate || 
        existingBooking?.startDate || 
        existingBooking?.bookingDate || 
        existingBooking?.createdAt
      );

  const resolvedTime = time && time !== 'Scheduled Time' && !time.includes('07:00 AM - 08:00 AM')
    ? resolveSessionTime({ time })
    : resolveSessionTime(existingBooking);

  const resolvedLocation = location && location !== 'Assigned Training Court' && location !== 'Arena Sports Complex' && !location.includes('Central Sports Complex')
    ? location
    : resolveSessionLocation(existingBooking, coachUser);

  const resolvedStudentName = studentName && studentName !== 'Attendee' && studentName !== 'Student'
    ? studentName
    : resolveStudentName(existingBooking);

  const resolvedSport = coachSport && coachSport !== 'Sports Coaching' && coachSport !== 'Sports' && coachSport !== 'Coaching Session'
    ? coachSport
    : resolveSessionSport(existingBooking, coachUser);

  const resolvedPrice = 
    price || 
    existingBooking?.amountInr || 
    existingBooking?.amount || 
    existingBooking?.credits || 
    existingBooking?.slot?.pricePerPerson || 
    existingBooking?.slot?.price || 
    '400';

  const parentAttendanceOtp = existingBooking?.attendanceOtp ? String(existingBooking.attendanceOtp) : '';

  const endSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/coach-app/sessions/${id}/end`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachSessions'] });
      queryClient.invalidateQueries({ queryKey: ['segmentedSessions'] });
      queryClient.invalidateQueries({ queryKey: ['bookingDetail', id] });
      queryClient.invalidateQueries({ queryKey: ['walletSummary'] });
      Alert.alert('Session Completed', 'Session ended successfully!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Could not end session. At least 80% of scheduled duration must elapse.';
      Alert.alert('Cannot End Session', msg);
    }
  });

  const coachCancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await api.post(`/coach-app/sessions/${id}/cancel`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachSessions'] });
      queryClient.invalidateQueries({ queryKey: ['segmentedSessions'] });
      queryClient.invalidateQueries({ queryKey: ['bookingDetail', id] });
      setShowCoachCancelModal(false);
      Alert.alert('Group Cancelled', 'The scheduled group was cancelled and eligible refunds were queued.');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Cancellation Error', err?.response?.data?.message || 'Failed to cancel group session');
    }
  });

  const coachNoPlayersMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await api.post(`/coach-app/sessions/${id}/attendance-report`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachSessions'] });
      queryClient.invalidateQueries({ queryKey: ['bookingDetail', id] });
      setShowNoPlayersModal(false);
      Alert.alert('Report Submitted', 'Attendance report sent for Super Admin review.');
    },
    onError: (err: any) => {
      Alert.alert('Report Error', err?.response?.data?.message || 'Failed to submit report. Can only report after scheduled end time.');
    }
  });

  const disputeMutation = useMutation({
    mutationFn: async ({ type, reason }: { type: string; reason: string }) => {
      const res = await api.post(`/bookings/${id}/dispute`, { type, reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerBookings'] });
      queryClient.invalidateQueries({ queryKey: ['parentBookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookingDetail', id] });
      setShowDisputeModal(false);
      setDisputeReason('');
      Alert.alert('Report Submitted', 'Your dispute has been logged and is under Super Admin review.');
      refetchBooking();
    },
    onError: (err: any) => {
      Alert.alert('Dispute Submission Error', err?.response?.data?.message || 'Could not submit dispute report.');
    }
  });

  const cancelUnpaidBookingMutation = useMutation({
    mutationFn: async (cancellationNote: string) => {
      const res = await api.put(`/bookings/${id}/cancel`, { cancellationNote });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerBookings'] });
      queryClient.invalidateQueries({ queryKey: ['parentBookings'] });
      Alert.alert('Booking Cancelled', 'Your request has been cancelled.');
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to cancel booking');
    }
  });

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold">
          {isCoach ? 'Session Management' : 'Session Details'}
        </Typography>
        <TouchableOpacity onPress={() => refetchBooking()} className="p-2 -mr-2">
          <Ionicons name="refresh" size={20} color="#0F2C59" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
        {isLoadingBooking ? (
          <View className="py-20 justify-center items-center">
            <ActivityIndicator size="large" color="#FF5100" />
          </View>
        ) : (
          <>
            {/* Status overview badges */}
            {!isCheckoutMode && (
              <View className="flex-row flex-wrap gap-2 mb-4">
                <View className={`px-3 py-1.5 rounded-full ${
                  statusParam === 'confirmed' ? 'bg-green-100' :
                  statusParam === 'completed' ? 'bg-emerald-100' :
                  statusParam === 'cancelled' ? 'bg-red-100' :
                  'bg-orange-100'
                }`}>
                  <Typography variant="caption" weight="bold" className="font-outfit-bold text-xs text-gray-800">
                    Status: {statusParam.toUpperCase()}
                  </Typography>
                </View>

                {existingBooking?.paymentStatus && (
                  <View className={`px-3 py-1.5 rounded-full ${existingBooking.paymentStatus === 'paid' ? 'bg-blue-100' : 'bg-gray-200'}`}>
                    <Typography variant="caption" weight="bold" className="font-outfit-bold text-xs text-blue-900">
                      Payment: {existingBooking.paymentStatus.toUpperCase()}
                    </Typography>
                  </View>
                )}

                {existingBooking?.attendanceStatus && (
                  <View className={`px-3 py-1.5 rounded-full ${existingBooking.attendanceStatus === 'VERIFIED' ? 'bg-green-100' : 'bg-amber-100'}`}>
                    <Typography variant="caption" weight="bold" className="font-outfit-bold text-xs text-amber-900">
                      Attendance: {existingBooking.attendanceStatus === 'REVIEW_REQUIRED' ? 'Review Needed' : existingBooking.attendanceStatus}
                    </Typography>
                  </View>
                )}

                {isDisputed && (
                  <View className="px-3 py-1.5 rounded-full bg-amber-500">
                    <Typography variant="caption" weight="bold" className="font-outfit-bold text-xs text-white">
                      Under Super Admin Review
                    </Typography>
                  </View>
                )}
              </View>
            )}

            {/* Attendance OTP Card for Player / Parent */}
            {!isCoach && !isCheckoutMode && parentAttendanceOtp ? (
              <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border-l-4 border-[#FF5100]">
                <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mb-1">
                  Private Attendance OTP
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit mb-3">
                  Share this code with your coach at the session.
                </Typography>
                <View className="bg-[#FFF2EB] rounded-xl py-3.5 items-center border border-[#FFD4C2] border-dashed">
                  <Typography variant="h1" color="primary" weight="bold" className="font-outfit-bold text-3xl tracking-widest">
                    {parentAttendanceOtp}
                  </Typography>
                </View>
              </View>
            ) : null}

            {/* Coach & Sport Info Card */}
            <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-50">
              <View className="flex-row items-center border-b border-gray-100 pb-4 mb-4">
                <View className="w-14 h-14 rounded-full bg-[#F5E6D3] mr-4 items-center justify-center">
                  <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">
                    {(coachName || existingBooking?.coach?.name || 'Coach').substring(0, 2).toUpperCase()}
                  </Typography>
                </View>
                <View className="flex-1">
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                    {coachName || existingBooking?.coach?.name || 'Coach'}
                  </Typography>
                  <Typography variant="body2" color="primary" weight="medium" className="mb-0.5 font-outfit-medium">
                    {resolvedSport}
                  </Typography>
                  <Typography variant="caption" color="text" className="font-outfit text-gray-500">
                    {resolvedLocation}
                  </Typography>
                </View>
              </View>

              <View className="bg-blue-50/60 rounded-xl p-3 mb-3 flex-row items-center justify-between border border-blue-100">
                <View className="flex-row items-center">
                  <Ionicons name="person-circle-outline" size={20} color="#3B82F6" className="mr-2" />
                  <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                    Attendee:
                  </Typography>
                </View>
                <Typography variant="body2" color="primary" weight="bold" className="font-outfit-bold">
                  {resolvedStudentName}
                </Typography>
              </View>

              <View className="flex-row items-center mb-2">
                <Ionicons name="calendar-outline" size={16} color="#0F2C59" className="mr-3" />
                <Typography variant="body2" color="text" weight="medium" className="ml-1 font-outfit">
                  {resolvedDate}
                </Typography>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={16} color="#0F2C59" className="mr-3" />
                <Typography variant="body2" color="text" weight="medium" className="ml-1 font-outfit">
                  {resolvedTime}
                </Typography>
              </View>
            </View>

            {/* Pricing details */}
            <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-50">
              <View className="flex-row justify-between items-center mb-3">
                <Typography variant="body1" color="text" className="font-outfit">
                  Coaching Session Fee
                </Typography>
                <Typography variant="body1" color="secondary" weight="semibold" className="font-outfit-semibold">
                  ₹{resolvedPrice}
                </Typography>
              </View>
              <View className="flex-row justify-between items-center pt-3 border-t border-gray-100">
                <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                  Total Amount
                </Typography>
                <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">
                  ₹{resolvedPrice}
                </Typography>
              </View>
            </View>

            {/* Official Invoice Card */}
            {!isCoach && isPaid && (
              <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 flex-row justify-between items-center">
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-10 h-10 rounded-xl bg-orange-50 items-center justify-center mr-3 border border-orange-100">
                    <Ionicons name="document-text-outline" size={20} color="#FF5100" />
                  </View>
                  <View className="flex-1">
                    <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold text-sm">
                      Tax Invoice
                    </Typography>
                    <Typography variant="caption" color="muted" className="font-outfit text-[11px]">
                      Session booking receipt
                    </Typography>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleDownloadInvoice}
                  disabled={isDownloadingInvoice}
                  className="px-4 py-2 bg-primary rounded-xl flex-row items-center active:opacity-80"
                >
                  {isDownloadingInvoice ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={16} color="#FFFFFF" className="mr-1" />
                      <Typography variant="caption" weight="bold" className="text-white font-outfit-bold">
                        Download
                      </Typography>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Coach OTP Modal */}
      <SessionOtpVerificationModal
        visible={showOtpVerifyModal}
        session={{
          id: id,
          studentName: resolvedStudentName,
          sport: resolvedSport,
          date: resolvedDate,
          time: resolvedTime,
          type: 'group'
        }}
        onClose={() => setShowOtpVerifyModal(false)}
        onSuccess={() => {
          setShowOtpVerifyModal(false);
          refetchBooking();
          queryClient.invalidateQueries({ queryKey: ['coachSessions'] });
        }}
      />

      {/* Customer Dispute Modal */}
      <Modal visible={showDisputeModal} transparent animationType="slide" onRequestClose={() => setShowDisputeModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 bg-black/60 justify-end">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View className="bg-white rounded-t-3xl p-6">
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-2">
                  Report Session Issue
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit mb-4">
                  Submit your report for review by Super Admin.
                </Typography>

                <Typography variant="caption" weight="bold" color="secondary" className="mb-2 font-outfit-bold">
                  Issue Type
                </Typography>
                <View className="flex-row gap-2 mb-4">
                  {(['COACH_ABSENCE', 'EARLY_DEPARTURE', 'OTHER'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setDisputeType(t)}
                      className={`flex-1 py-2 rounded-xl items-center border ${disputeType === t ? 'bg-[#FFECE2] border-[#FF5100]' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <Typography variant="caption" weight="bold" color={disputeType === t ? 'primary' : 'muted'} className="text-[10px] font-outfit-bold">
                        {t === 'COACH_ABSENCE' ? 'Coach Absent' : t === 'EARLY_DEPARTURE' ? 'Left Early' : 'Other'}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>

                <Typography variant="caption" weight="bold" color="secondary" className="mb-2 font-outfit-bold">
                  Reason / Explanation (Required)
                </Typography>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm min-h-[90px] mb-5 font-outfit"
                  placeholder="Explain what happened during the session..."
                  multiline
                  maxLength={2000}
                  value={disputeReason}
                  onChangeText={setDisputeReason}
                />

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button title="Cancel" variant="outline" onPress={() => setShowDisputeModal(false)} />
                  </View>
                  <View className="flex-1">
                    <Button 
                      title="Submit Report" 
                      disabled={!disputeReason.trim() || disputeMutation.isPending}
                      isLoading={disputeMutation.isPending}
                      onPress={() => disputeMutation.mutate({ type: disputeType, reason: disputeReason.trim() })}
                    />
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Coach Cancel Group Modal */}
      <Modal visible={showCoachCancelModal} transparent animationType="slide" onRequestClose={() => setShowCoachCancelModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 bg-black/60 justify-end">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View className="bg-white rounded-t-3xl p-6">
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-2">
                  Cancel Entire Group Session
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit mb-4">
                  This cancels the scheduled group and queues full refunds for eligible paid participants.
                </Typography>

                <Typography variant="caption" weight="bold" color="secondary" className="mb-2 font-outfit-bold">
                  Reason for Cancellation
                </Typography>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm min-h-[80px] mb-5 font-outfit"
                  placeholder="e.g. Court unavailable or emergency..."
                  multiline
                  value={coachCancelReason}
                  onChangeText={setCoachCancelReason}
                />

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button title="Keep Session" variant="outline" onPress={() => setShowCoachCancelModal(false)} />
                  </View>
                  <View className="flex-1">
                    <Button 
                      title="Confirm Cancel" 
                      variant="primary"
                      disabled={!coachCancelReason.trim() || coachCancelMutation.isPending}
                      isLoading={coachCancelMutation.isPending}
                      onPress={() => coachCancelMutation.mutate(coachCancelReason.trim())}
                    />
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Coach No-Players Modal */}
      <Modal visible={showNoPlayersModal} transparent animationType="slide" onRequestClose={() => setShowNoPlayersModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 bg-black/60 justify-end">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View className="bg-white rounded-t-3xl p-6">
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-2">
                  Report No Players Arrived
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit mb-4">
                  Submit this attendance report after scheduled end time if no players arrived and no OTP was provided.
                </Typography>

                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm min-h-[80px] mb-5 font-outfit"
                  placeholder="Note regarding player absence..."
                  value={noPlayersReason}
                  onChangeText={setNoPlayersReason}
                />

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button title="Back" variant="outline" onPress={() => setShowNoPlayersModal(false)} />
                  </View>
                  <View className="flex-1">
                    <Button 
                      title="Submit Report" 
                      disabled={!noPlayersReason.trim() || coachNoPlayersMutation.isPending}
                      isLoading={coachNoPlayersMutation.isPending}
                      onPress={() => coachNoPlayersMutation.mutate(noPlayersReason.trim())}
                    />
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Bottom Actions */}
      <View className="p-4 bg-white border-t border-gray-100" style={{ paddingBottom: Math.max(insets.bottom + 16, 28) }}>
        {isCoach ? (
          (statusParam === 'confirmed' || statusParam === 'accepted') ? (
            <View className="gap-2">
              <Button 
                title="Verify OTP & Start Session" 
                onPress={() => setShowOtpVerifyModal(true)}
                variant="primary"
              />
              <View className="flex-row gap-2 mt-1">
                <View className="flex-1">
                  <Button 
                    title="Cancel Group" 
                    variant="outline"
                    onPress={() => setShowCoachCancelModal(true)}
                  />
                </View>
                <View className="flex-1">
                  <Button 
                    title="No Players" 
                    variant="outline"
                    onPress={() => setShowNoPlayersModal(true)}
                  />
                </View>
              </View>
            </View>
          ) : statusParam === 'ongoing' ? (
            <Button 
              title="End Session" 
              onPress={() => endSessionMutation.mutate()}
              isLoading={endSessionMutation.isPending}
              variant="primary"
            />
          ) : statusParam === 'completed' ? (
            <View className="bg-emerald-50 border border-emerald-200 py-3.5 px-4 rounded-xl items-center flex-row justify-center">
              <Ionicons name="checkmark-circle" size={20} color="#047857" className="mr-2" />
              <Typography variant="subtitle2" className="text-emerald-800 font-bold font-outfit-bold">
                Session Completed
              </Typography>
            </View>
          ) : statusParam === 'cancelled' ? (
            <View className="bg-red-50 border border-red-200 py-3.5 px-4 rounded-xl items-center flex-row justify-center">
              <Ionicons name="close-circle" size={20} color="#B91C1C" className="mr-2" />
              <Typography variant="subtitle2" className="text-red-800 font-bold font-outfit-bold">
                Session Cancelled
              </Typography>
            </View>
          ) : null
        ) : isCheckoutMode ? (
          <Button 
            title={`Proceed To Pay (₹${resolvedPrice})`}
            onPress={() => router.push({
              pathname: '/payment',
              params: {
                slotId,
                childId: childId || '',
                childIds: childIds || '',
                attendeeCount: attendeeCount || '1',
                coachId: coachId || '',
                studentName: resolvedStudentName,
                date: resolvedDate,
                time: resolvedTime,
                price: resolvedPrice.toString(),
                totalAmount: resolvedPrice.toString(),
                coachName: coachName || 'Coach',
                coachSport: resolvedSport
              }
            })}
          />
        ) : isPaid ? (
          <View>
            {!isDisputed ? (
              <Button 
                title="Report Session Issue" 
                variant="outline"
                onPress={() => setShowDisputeModal(true)}
              />
            ) : (
              <View className="bg-amber-50 border border-amber-300 py-3 px-4 rounded-xl items-center flex-row justify-center">
                <Ionicons name="shield-checkmark-outline" size={18} color="#B45309" className="mr-2" />
                <Typography variant="caption" className="text-amber-800 font-bold font-outfit-bold">
                  Under Super Admin Review
                </Typography>
              </View>
            )}
          </View>
        ) : (statusParam === 'requested' || statusParam === 'pending') ? (
          <Button 
            title="Cancel Booking Request" 
            variant="outline"
            onPress={() => cancelUnpaidBookingMutation.mutate('User cancelled unpaid request')}
            isLoading={cancelUnpaidBookingMutation.isPending}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
