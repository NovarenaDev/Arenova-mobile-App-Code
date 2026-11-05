import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';
import { resolveSessionSport, resolveSessionTitle } from '@/utils/sessionFormatter';

interface Slot {
  _id: string;
  id?: string;
  title?: string;
  sport?: string;
  sportName?: string;
  startTime: string;
  endTime: string;
  status?: string;
  price?: number;
  pricePerPerson?: number;
  capacity?: number;
  bookedCount?: number;
}

export default function SelectDateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { coachId } = useLocalSearchParams<{ coachId?: string }>();

  // Strict Role Guard: Coaches cannot book coaching sessions
  React.useEffect(() => {
    if (user?.role === 'coach') {
      Alert.alert(
        'Access Denied (Role Boundary)',
        'Coaches cannot book coaching sessions. Please use your coach dashboard.'
      );
      router.replace('/(coach)/(coach-tabs)/coach-dashboard');
    }
  }, [user, router]);
  
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const { data: coachResponse, isLoading: isLoadingCoach } = useQuery({
    queryKey: ['coachProfile', coachId],
    queryFn: async () => {
      if (!coachId) return null;
      const res = await api.get(`/coaches/${coachId}`);
      return res.data?.data || res.data;
    },
    enabled: !!coachId
  });

  const coach = coachResponse?.data || coachResponse || null;
  const coachName = coach?.name || `${coach?.firstName || ''} ${coach?.lastName || ''}`.trim() || 'Coach';
  const coachSport = coach?.sport || coach?.sports?.[0] || 'Tennis';
  const coachLocation = (typeof coach?.location === 'string' ? coach.location : coach?.location?.name || coach?.location?.city || coach?.address?.city || coach?.city || 'Training Venue');

  const { data: slotsResponse, isLoading: isLoadingSlots } = useQuery({
    queryKey: ['coachSlots', coachId, selectedDate],
    queryFn: async () => {
      if (!coachId || !selectedDate) return null;
      try {
        const res = await api.get(`/slots/coaches/${coachId}/slots`, {
          params: { date: selectedDate }
        });
        return res.data;
      } catch (err: any) {
        // Fallback 1: try /coaches/:id/slots
        try {
          const res2 = await api.get(`/coaches/${coachId}/slots`, {
            params: { date: selectedDate }
          });
          return res2.data;
        } catch (err2) {
          // Fallback 2: try /coach-app/slots
          try {
            const res3 = await api.get('/coach-app/slots', {
              params: { coachId, date: selectedDate }
            });
            return res3.data;
          } catch {
            return null;
          }
        }
      }
    },
    enabled: !!coachId && !!selectedDate
  });

  // Extract slots list with full format tolerance
  const rawSlotsList = Array.isArray(slotsResponse)
    ? slotsResponse
    : (Array.isArray(slotsResponse?.data)
      ? slotsResponse.data
      : (slotsResponse?.data?.slots || slotsResponse?.slots || []));

  let slots: Slot[] = Array.isArray(rawSlotsList) ? rawSlotsList : [];

  // Fallback: If no date-specific slots exist, derive from coach's recurring availability for this day of week
  if (slots.length === 0 && coach?.availability && Array.isArray(coach.availability)) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName = dayNames[dateObj.getDay()];

    const matchingAvail = coach.availability.filter((a: any) => 
      a.day && a.day.toLowerCase() === dayName.toLowerCase()
    );

    if (matchingAvail.length > 0) {
      slots = matchingAvail.map((a: any, idx: number) => ({
        _id: a._id || a.id || `avail_${selectedDate}_${idx}`,
        id: a._id || a.id || `avail_${selectedDate}_${idx}`,
        startTime: a.startTime,
        endTime: a.endTime,
        price: a.price || coach?.pricePerSession || coach?.fee || 500,
        pricePerPerson: a.price || coach?.pricePerSession || coach?.fee || 500,
        capacity: a.capacity || 10,
        bookedCount: 0
      }));
    }
  }

  const formatSlotTime = (timeStr: string) => {
    if (!timeStr) return '';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const handleSelectSlot = () => {
    if (!selectedDate) {
      Alert.alert('Error', 'Please select a date');
      return;
    }
    if (!selectedSlotId) {
      Alert.alert('Error', 'Please select an available time slot');
      return;
    }

    const selectedSlot = slots.find(s => (s._id || s.id) === selectedSlotId);
    const resolvedSport = selectedSlot?.sport || selectedSlot?.sportName || coachSport;
    const slotPrice = (selectedSlot?.pricePerPerson ?? selectedSlot?.price ?? 500).toString();
    const timeFormatted = `${selectedSlot?.startTime} - ${selectedSlot?.endTime}`;
    const sessionTitle = selectedSlot?.title || `${resolvedSport} Coaching`;
    
    if (user?.role === 'parent') {
      router.push({
        pathname: '/select-player',
        params: {
          coachId: coachId || '',
          slotId: selectedSlotId,
          date: selectedDate,
          time: timeFormatted,
          price: slotPrice,
          coachName,
          coachSport: resolvedSport,
          sessionTitle,
          location: coachLocation
        }
      });
    } else {
      router.push({
        pathname: '/session-summary',
        params: {
          coachId: coachId || '',
          slotId: selectedSlotId,
          date: selectedDate,
          time: timeFormatted,
          price: slotPrice,
          coachName,
          coachSport: resolvedSport,
          sessionTitle,
          location: coachLocation,
          studentName: user?.name || 'Myself'
        }
      });
    }
  };

  const selectedSlot = slots.find(s => (s._id || s.id) === selectedSlotId);
  const activeSlotSport = selectedSlot 
    ? resolveSessionSport(selectedSlot, coach) 
    : coachSport;
  const activeSessionTitle = selectedSlot 
    ? resolveSessionTitle(selectedSlot, coach) 
    : `${coachSport} Coach`;

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
          Select Date & Time
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-4" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 60, 80) }}>
        
        {/* Coach Header Card */}
        {isLoadingCoach ? (
          <ActivityIndicator size="small" color="#FF5100" className="my-4" />
        ) : (
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-50">
            <Typography variant="subtitle2" color="muted" weight="bold" className="mb-3 uppercase font-outfit-bold">
              Selected Trainer
            </Typography>
            <View className="flex-row items-center border-t border-gray-50 pt-3">
              <View className="w-12 h-12 rounded-full bg-[#F5E6D3] mr-3 items-center justify-center shadow-sm">
                <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold">
                  {coachName.split(' ').map((n: string) => n[0]).join('')}
                </Typography>
              </View>
              <View className="flex-1">
                <Typography variant="body1" color="secondary" weight="bold" className="font-outfit-bold">
                  {coachName}
                </Typography>
                <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                  {selectedSlot ? (selectedSlot.title || `${activeSlotSport} Coaching`) : `${coachSport} Coach`}
                </Typography>
                {selectedDate && selectedSlot && (
                  <Typography variant="caption" color="text" className="mt-1 font-outfit text-gray-500 text-[10px]">
                    {selectedDate} | {formatSlotTime(selectedSlot.startTime)} - {formatSlotTime(selectedSlot.endTime)}
                  </Typography>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Real Calendar Card */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-50">
          <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
            Select Date
          </Typography>
          <Calendar
            minDate={today}
            onDayPress={(day: any) => {
              setSelectedDate(day.dateString);
              setSelectedSlotId(null);
            }}
            markedDates={{
              [selectedDate]: { selected: true, selectedColor: '#FF5100' }
            }}
            theme={{
              todayTextColor: '#FF5100',
              selectedDayBackgroundColor: '#FF5100',
              arrowColor: '#9CA3AF',
              textDayFontFamily: 'sans',
              textMonthFontFamily: 'sans',
              textDayHeaderFontFamily: 'sans',
            }}
          />
        </View>

        {/* Time Selector Card */}
        {selectedDate && (
          <View className="bg-white rounded-2xl p-4 mb-8 shadow-sm border border-gray-50">
            <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-3 font-outfit-bold">
              Available Slots
            </Typography>

            {isLoadingSlots ? (
              <ActivityIndicator size="small" color="#FF5100" className="my-6" />
            ) : slots.length === 0 ? (
              <View className="py-6 items-center">
                <Ionicons name="time-outline" size={28} color="#9CA3AF" className="mb-2" />
                <Typography variant="caption" color="muted" align="center" className="font-outfit">
                  No slots available on this date.
                </Typography>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2 pt-2">
                {slots.map((slot) => {
                  const isSelected = selectedSlotId === (slot._id || slot.id);
                  const displayPrice = slot.pricePerPerson ?? slot.price;
                  const isFull = slot.capacity !== undefined && slot.bookedCount !== undefined && slot.bookedCount >= slot.capacity;
                  const slotSport = resolveSessionSport(slot, coach);

                  return (
                    <TouchableOpacity
                      key={slot._id || slot.id}
                      onPress={() => !isFull && setSelectedSlotId(slot._id || slot.id || null)}
                      activeOpacity={isFull ? 1 : 0.8}
                      disabled={isFull}
                      className={`px-4 py-2.5 rounded-xl border-2 min-w-[90px] items-center ${
                        isFull
                          ? 'bg-gray-100 border-gray-200 opacity-50'
                          : isSelected 
                            ? 'bg-primary border-primary' 
                            : 'bg-white border-gray-200'
                      }`}
                    >
                      <Typography 
                        variant="body2" 
                        color={isFull ? 'muted' : isSelected ? 'white' : 'secondary'} 
                        weight="bold"
                        align="center"
                        className="font-outfit-bold text-center"
                      >
                        {formatSlotTime(slot.startTime)}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        color={isFull ? 'muted' : isSelected ? 'white' : 'primary'} 
                        weight="bold"
                        align="center"
                        className="font-outfit text-[10px] mt-0.5"
                      >
                        {slotSport}
                      </Typography>
                      {displayPrice !== undefined && (
                        <Typography 
                          variant="caption" 
                          color={isFull ? 'muted' : isSelected ? 'white' : 'muted'} 
                          align="center"
                          className="mt-0.5 font-outfit text-[9px]"
                        >
                          {isFull ? 'Full' : `₹${displayPrice}`}
                        </Typography>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <View className="mb-8">
          <Button 
            title="Continue" 
            onPress={handleSelectSlot}
            disabled={!selectedDate || !selectedSlotId}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
