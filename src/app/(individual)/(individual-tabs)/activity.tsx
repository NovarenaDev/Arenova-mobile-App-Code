import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export default function BookingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Section toggle: Coaching Sessions vs Tournament Registrations
  const [sectionType, setSectionType] = useState<'coaching' | 'tournaments'>('coaching');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming');

  // Tournaments Detail & Invoice States
  const [selectedReg, setSelectedReg] = useState<any | null>(null);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  // 1. Coaching Bookings Query
  const { 
    data: bookingsResponse, 
    isLoading: isLoadingBookings, 
    refetch: refetchBookings, 
    isRefetching: isRefetchingBookings 
  } = useQuery({
    queryKey: ['playerBookings'],
    queryFn: async () => {
      const res = await api.get('/bookings/my');
      return res.data;
    }
  });

  // 2. Tournament Registrations Query
  const { 
    data: tournamentsResponse, 
    isLoading: isLoadingTournaments, 
    refetch: refetchTournaments, 
    isRefetching: isRefetchingTournaments 
  } = useQuery({
    queryKey: ['myTournamentRegistrations'],
    queryFn: async () => {
      const res = await api.get('/novare/registrations/my');
      return res.data?.data || res.data;
    }
  });

  const allBookings = bookingsResponse?.data || [];
  const upcomingBookings = allBookings.filter((b: any) => 
    b.status === 'requested' || 
    b.status === 'accepted' || 
    b.status === 'confirmed' || 
    b.status === 'ongoing'
  );
  const completedBookings = allBookings.filter((b: any) => 
    b.status === 'completed' || 
    b.status === 'cancelled' || 
    b.status === 'no_show'
  );
  const displayBookings = activeTab === 'upcoming' ? upcomingBookings : completedBookings;

  const rawTournaments = Array.isArray(tournamentsResponse)
    ? tournamentsResponse
    : (tournamentsResponse?.registrations || tournamentsResponse?.data || []);

  const handleDownloadInvoice = async (regId?: string, invoiceIdParam?: string) => {
    setIsDownloadingInvoice(true);
    try {
      let targetInvoiceId = invoiceIdParam;

      if (!targetInvoiceId) {
        const res = await api.get('/invoices/my', { params: { limit: 25 } }).catch(() => null);
        const list = res?.data?.data || res?.data || [];
        const match = list.find((inv: any) => 
          inv.registrationId === regId || 
          inv.registration?._id === regId ||
          inv.metadata?.registrationId === regId ||
          inv.bookingId === regId
        ) || list[0];

        if (match) {
          targetInvoiceId = match._id || match.id;
        }
      }

      if (!targetInvoiceId) {
        Alert.alert(
          'Invoice Being Prepared',
          'Your registration invoice PDF is currently being generated. Please check back in a few moments.'
        );
        setIsDownloadingInvoice(false);
        return;
      }

      const downloadRes = await api.get(`/invoices/${targetInvoiceId}/download`);
      const downloadData = downloadRes.data?.data || downloadRes.data;
      const pdfUrl = downloadData?.downloadUrl || downloadData?.url || downloadData?.pdfUrl;

      if (pdfUrl) {
        await Linking.openURL(pdfUrl);
      } else {
        Alert.alert('Notice', 'Invoice PDF will be ready in a few moments.');
      }
      setIsDownloadingInvoice(false);
    } catch (err: any) {
      setIsDownloadingInvoice(false);
      const msg = err?.response?.data?.message || err?.message || 'Invoice PDF is being prepared.';
      Alert.alert('Invoice', msg);
    }
  };

  const isCurrentLoading = sectionType === 'coaching' 
    ? (isLoadingBookings || isRefetchingBookings) 
    : (isLoadingTournaments || isRefetchingTournaments);

  const handleRefresh = () => {
    if (sectionType === 'coaching') {
      refetchBookings();
    } else {
      refetchTournaments();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-4 bg-[#0F2C59] border-b border-gray-100 flex-row justify-between items-center shadow-sm z-10">
        <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold">
          My Activity
        </Typography>
        <TouchableOpacity onPress={handleRefresh} className="p-1">
          <Ionicons name="refresh" size={20} color="#FF5100" />
        </TouchableOpacity>
      </View>

      {/* Primary Section Switcher: Coaching Sessions vs Tournaments */}
      <View className="px-4 pt-3 pb-1">
        <View className="flex-row bg-white rounded-2xl p-1 border border-gray-200 shadow-sm">
          <TouchableOpacity 
            className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center ${sectionType === 'coaching' ? 'bg-[#0F2C59]' : 'bg-transparent'}`}
            onPress={() => setSectionType('coaching')}
          >
            <Ionicons 
              name="calendar" 
              size={16} 
              color={sectionType === 'coaching' ? '#FF5100' : '#6B7280'} 
              style={{ marginRight: 6 }} 
            />
            <Typography 
              variant="subtitle2" 
              color={sectionType === 'coaching' ? 'white' : 'secondary'} 
              weight="bold" 
              className="font-outfit-bold text-xs"
            >
              Coaching Sessions
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity 
            className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center ${sectionType === 'tournaments' ? 'bg-[#0F2C59]' : 'bg-transparent'}`}
            onPress={() => setSectionType('tournaments')}
          >
            <Ionicons 
              name="trophy" 
              size={16} 
              color={sectionType === 'tournaments' ? '#FF5100' : '#6B7280'} 
              style={{ marginRight: 6 }} 
            />
            <Typography 
              variant="subtitle2" 
              color={sectionType === 'tournaments' ? 'white' : 'secondary'} 
              weight="bold" 
              className="font-outfit-bold text-xs"
            >
              Tournaments
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      {/* SECTION 1: COACHING SESSIONS */}
      {sectionType === 'coaching' && (
        <>
          <View className="px-4 pt-2 pb-2">
            <View className="flex-row bg-white rounded-full border border-gray-200 overflow-hidden h-11">
              <TouchableOpacity 
                className={`flex-1 justify-center items-center ${activeTab === 'upcoming' ? 'bg-secondary' : 'bg-transparent'}`}
                onPress={() => setActiveTab('upcoming')}
              >
                <Typography variant="caption" color={activeTab === 'upcoming' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold">
                  Upcoming
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`flex-1 justify-center items-center ${activeTab === 'completed' ? 'bg-secondary' : 'bg-transparent'}`}
                onPress={() => setActiveTab('completed')}
              >
                <Typography variant="caption" color={activeTab === 'completed' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold">
                  Completed
                </Typography>
              </TouchableOpacity>
            </View>
          </View>

          {isCurrentLoading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#FF5100" />
            </View>
          ) : displayBookings.length === 0 ? (
            <View className="flex-1 px-8 pt-20 items-center">
              <View className="w-16 h-16 rounded-full bg-white shadow-sm items-center justify-center mb-4 border border-gray-100">
                <Ionicons name="calendar-outline" size={32} color="#9CA3AF" />
              </View>
              <Typography variant="subtitle1" color="secondary" weight="semibold" className="mb-2 font-outfit-semibold">
                No Bookings Found
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="mb-6 font-outfit">
                You don't have any {activeTab} bookings scheduled at the moment.
              </Typography>
              {activeTab === 'upcoming' && (
                <Button 
                  title="Find a Coach" 
                  onPress={() => router.push('/search')}
                  fullWidth={false}
                  className="px-6"
                />
              )}
            </View>
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              className="flex-1"
              contentContainerStyle={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom + 110, 130) }}
            >
              {displayBookings.map((booking: any) => {
                const coachName = booking.coach?.name || booking.coachName || 'Coach';
                const coachInitials = coachName.split(' ').map((n: string) => n[0]).join('');
                const statusLabel = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);

                return (
                  <View key={booking._id || booking.id} className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
                    <View className="flex-row justify-between items-center mb-3 border-b border-gray-100 pb-3">
                      <View className="flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-[#F5E6D3] mr-3 items-center justify-center shadow-sm">
                          <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold">
                            {coachInitials}
                          </Typography>
                        </View>
                        <View>
                          <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                            {coachName}
                          </Typography>
                          <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                            {booking.sport || 'Sports'}
                          </Typography>
                        </View>
                      </View>
                      <View className={`px-2.5 py-1 rounded-md ${
                        booking.status === 'confirmed' || booking.status === 'accepted'
                          ? 'bg-green-50 border border-green-100' 
                          : booking.status === 'completed' 
                            ? 'bg-emerald-50 border border-emerald-100' 
                            : 'bg-orange-50 border border-orange-100'
                      }`}>
                        <Typography 
                          variant="caption" 
                          className={`${
                            booking.status === 'confirmed' || booking.status === 'accepted'
                              ? 'text-green-700' 
                              : booking.status === 'completed' 
                                ? 'text-emerald-700' 
                                : 'text-orange-700'
                          } font-outfit-bold text-[11px]`} 
                          weight="bold"
                        >
                          {statusLabel}
                        </Typography>
                      </View>
                    </View>

                    <View className="flex-row justify-between items-center mb-3">
                      <View className="flex-row items-center">
                        <Ionicons name="calendar-outline" size={16} color="#6B7280" className="mr-2" />
                        <Typography variant="body2" color="text" className="font-outfit">
                          {booking.slot?.date || booking.date || (booking.createdAt ? new Date(booking.createdAt).toLocaleDateString() : 'Scheduled')}
                        </Typography>
                      </View>
                      <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={16} color="#6B7280" className="mr-2" />
                        <Typography variant="body2" color="text" className="font-outfit">
                          {booking.slot?.startTime ? `${booking.slot.startTime} - ${booking.slot.endTime}` : (booking.time || booking.startTime || 'Scheduled Time')}
                        </Typography>
                      </View>
                    </View>

                    <View className="flex-row justify-between items-center mt-1 pt-2 border-t border-gray-50">
                      {booking.attendanceOtp && (booking.status === 'confirmed' || booking.status === 'accepted') ? (
                        <View className="bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200 flex-row items-center">
                          <Ionicons name="key-outline" size={13} color="#FF5100" className="mr-1.5" />
                          <Typography variant="caption" className="text-orange-900 font-bold font-outfit-bold text-xs tracking-wider">
                            OTP: {booking.attendanceOtp}
                          </Typography>
                        </View>
                      ) : (
                        <View />
                      )}

                      <View className="w-32">
                        <Button 
                          title="View Details" 
                          variant="outline" 
                          size="sm"
                          onPress={() => router.push({
                            pathname: '/session-summary',
                            params: { id: booking._id || booking.id, status: booking.status }
                          })}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {/* SECTION 2: TOURNAMENTS HISTORY */}
      {sectionType === 'tournaments' && (
        <>
          {isCurrentLoading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#FF5100" />
              <Typography variant="caption" color="muted" className="mt-2 font-outfit">
                Loading tournament registrations...
              </Typography>
            </View>
          ) : rawTournaments.length === 0 ? (
            <View className="flex-1 px-8 pt-20 items-center">
              <View className="w-16 h-16 rounded-full bg-white shadow-sm items-center justify-center mb-4 border border-gray-100">
                <Ionicons name="trophy-outline" size={32} color="#9CA3AF" />
              </View>
              <Typography variant="subtitle1" color="secondary" weight="semibold" className="mb-2 font-outfit-semibold">
                No Tournaments Yet
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="mb-6 font-outfit">
                You haven't registered for any sports tournaments yet. Find upcoming tournaments and compete!
              </Typography>
              <Button 
                title="Explore Tournaments" 
                onPress={() => router.push('/(individual)/(individual-tabs)/tournaments')}
                fullWidth={false}
                className="px-6"
              />
            </View>
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              className="flex-1"
              contentContainerStyle={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom + 110, 130) }}
            >
              {rawTournaments.map((reg: any, idx: number) => {
                const regId = reg._id || reg.id || idx.toString();
                const tournamentObj = reg.tournamentId || reg.tournament || {};
                const tournamentName = tournamentObj.name || tournamentObj.title || reg.tournamentName || 'Tournament';
                const categoryName = reg.categoryName || reg.category?.name || reg.category || 'Open Division';
                const status = (reg.paymentStatus || reg.status || 'verified').toUpperCase();
                const isPaid = status === 'VERIFIED' || status === 'COMPLETED' || status === 'PAID';
                const dateStr = reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : '';

                return (
                  <View 
                    key={regId}
                    className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-gray-100"
                  >
                    <View className="flex-row items-center justify-between mb-3 border-b border-gray-100 pb-3">
                      <View className="flex-row items-center flex-1 mr-2">
                        <View className="w-10 h-10 rounded-2xl bg-orange-50 items-center justify-center mr-3 border border-orange-100">
                          <Ionicons name="trophy" size={20} color="#FF5100" />
                        </View>
                        <View className="flex-1">
                          <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold" numberOfLines={1}>
                            {tournamentName}
                          </Typography>
                          <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold mt-0.5">
                            {categoryName}
                          </Typography>
                        </View>
                      </View>

                      <View className={`px-2.5 py-1 rounded-full border ${isPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
                        <Typography 
                          variant="caption" 
                          weight="bold" 
                          className={`font-outfit-bold text-[10px] ${isPaid ? 'text-emerald-700' : 'text-orange-700'}`}
                        >
                          {isPaid ? 'PAID / VERIFIED' : status}
                        </Typography>
                      </View>
                    </View>

                    {/* Participant Details */}
                    <View className="bg-gray-50 rounded-2xl p-3 mb-3 border border-gray-100">
                      <View className="flex-row justify-between items-center">
                        <Typography variant="caption" color="muted" className="font-outfit">Participant</Typography>
                        <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                          {reg.participantName || reg.name || 'Athlete'}
                        </Typography>
                      </View>
                      {reg.phone ? (
                        <View className="flex-row justify-between items-center mt-1">
                          <Typography variant="caption" color="muted" className="font-outfit">Contact</Typography>
                          <Typography variant="caption" color="secondary" weight="medium" className="font-outfit text-xs">
                            +91 {reg.phone}
                          </Typography>
                        </View>
                      ) : null}
                      {reg.amount !== undefined ? (
                        <View className="flex-row justify-between items-center mt-1">
                          <Typography variant="caption" color="muted" className="font-outfit">Fee</Typography>
                          <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                            ₹{reg.amount}
                          </Typography>
                        </View>
                      ) : null}
                    </View>

                    {/* Action Bar */}
                    <View className="flex-row items-center justify-between pt-1">
                      <Typography variant="caption" color="muted" className="font-outfit text-xs">
                        {dateStr ? `Reg: ${dateStr}` : 'Confirmed'}
                      </Typography>

                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                          onPress={() => handleDownloadInvoice(regId, reg.invoiceId)}
                          className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-xl flex-row items-center shadow-xs"
                        >
                          <Ionicons name="download-outline" size={14} color="#FF5100" style={{ marginRight: 4 }} />
                          <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs">
                            Invoice
                          </Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setSelectedReg(reg)}
                          className="px-3 py-1.5 bg-[#0F2C59] rounded-xl flex-row items-center shadow-xs"
                        >
                          <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                            Details
                          </Typography>
                          <Ionicons name="chevron-forward" size={13} color="white" style={{ marginLeft: 3 }} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {/* REGISTRATION DETAIL MODAL */}
      <Modal
        visible={!!selectedReg}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReg(null)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setSelectedReg(null)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
                Tournament Entry
              </Typography>
              <TouchableOpacity 
                onPress={() => setSelectedReg(null)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {selectedReg && (
              <View className="space-y-4">
                <View className="bg-orange-50/70 p-4 rounded-2xl border border-orange-100">
                  <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold uppercase text-[10px] tracking-wider">
                    Confirmed Registration
                  </Typography>
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mt-0.5">
                    {selectedReg.tournament?.name || selectedReg.tournamentName || selectedReg.tournamentId?.name || 'Tournament'}
                  </Typography>
                  <Typography variant="body2" color="muted" className="font-outfit mt-1">
                    Category: <Typography weight="bold">{selectedReg.categoryName || selectedReg.category || 'Standard'}</Typography>
                  </Typography>
                  <Typography variant="caption" color="secondary" className="font-outfit mt-1">
                    Registration ID: #{selectedReg._id || selectedReg.id}
                  </Typography>
                </View>

                <View className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <View className="flex-row justify-between py-1.5 border-b border-gray-200/60">
                    <Typography variant="body2" color="muted" className="font-outfit">Participant</Typography>
                    <Typography variant="body2" color="secondary" weight="bold" className="font-outfit-bold">
                      {selectedReg.participantName || selectedReg.name || 'Athlete'}
                    </Typography>
                  </View>

                  {selectedReg.partnerName ? (
                    <View className="flex-row justify-between py-1.5 border-b border-gray-200/60">
                      <Typography variant="body2" color="muted" className="font-outfit">Partner / Team</Typography>
                      <Typography variant="body2" color="secondary" weight="medium" className="font-outfit">
                        {selectedReg.partnerName}
                      </Typography>
                    </View>
                  ) : null}

                  {selectedReg.phone ? (
                    <View className="flex-row justify-between py-1.5 border-b border-gray-200/60">
                      <Typography variant="body2" color="muted" className="font-outfit">Mobile</Typography>
                      <Typography variant="body2" color="secondary" weight="medium" className="font-outfit">
                        +91 {selectedReg.phone}
                      </Typography>
                    </View>
                  ) : null}

                  {selectedReg.email ? (
                    <View className="flex-row justify-between py-1.5 border-b border-gray-200/60">
                      <Typography variant="body2" color="muted" className="font-outfit">Email</Typography>
                      <Typography variant="body2" color="secondary" weight="medium" className="font-outfit">
                        {selectedReg.email}
                      </Typography>
                    </View>
                  ) : null}

                  <View className="flex-row justify-between py-1.5">
                    <Typography variant="body2" color="muted" className="font-outfit">Payment Status</Typography>
                    <Typography variant="body2" weight="bold" className="font-outfit-bold uppercase text-emerald-600">
                      {selectedReg.paymentStatus || selectedReg.status || 'VERIFIED'}
                    </Typography>
                  </View>
                </View>

                <Button
                  title="Download Invoice (PDF)"
                  onPress={() => handleDownloadInvoice(selectedReg._id || selectedReg.id, selectedReg.invoiceId)}
                  isLoading={isDownloadingInvoice}
                  className="mt-3 mb-2"
                />

                <Button
                  title="Close"
                  variant="white"
                  onPress={() => setSelectedReg(null)}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
