import React, { useState } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Card, Button, TextInput, ConfirmModal } from '@/components/ui';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

interface Slot {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string;
  duration: string;
  raw?: {
    startDateStr: string;
    endDateStr: string;
    startTimeIso: string;
    endTimeIso: string;
    locationName?: string;
    locationAddress?: string;
    locationCity?: string;
    capacity?: string;
  };
}

// Convert backend 24h format and date string to a valid Date object in local time
const parseTimeAndDateToDateObject = (dateStr: string, timeStr: string) => {
  if (!dateStr || !timeStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0);
};

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  
  // Form States
  const [newTitle, setNewTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Date Range State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const [startTime, setStartTime] = useState(new Date());
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [endTime, setEndTime] = useState(new Date(new Date().getTime() + 60 * 60 * 1000)); // 1 hour later
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Form Errors State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Helper functions to prevent timezone shifting
  const parseDateString = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0); // Noon local time
  };

  const formatToDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDisplayDates = (start: string, end: string) => {
    if (!start) return 'Select Dates';
    const formatDate = (dateStr: string) => {
      const parts = dateStr.split('-');
      if (parts.length < 3) return dateStr;
      const [, month, day] = parts;
      return `${month}/${day}`;
    };
    if (end && start !== end) {
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
    return formatDate(start);
  };

  const formatTime24 = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getMarkedDates = () => {
    let marked: any = {};
    if (startDate) {
      marked[startDate] = { startingDay: true, color: '#F58220', textColor: 'white' };
    }
    if (endDate) {
      marked[endDate] = { endingDay: true, color: '#F58220', textColor: 'white' };
      
      // Fill dates in between
      if (startDate && endDate) {
        let curr = parseDateString(startDate);
        curr.setDate(curr.getDate() + 1);
        const end = parseDateString(endDate);
        while (curr < end) {
          marked[formatToDateString(curr)] = { color: '#F5E6D3', textColor: '#0F2C59' };
          curr.setDate(curr.getDate() + 1);
        }
      }
    }
    return marked;
  };

  const onDayPress = (day: any) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(day.dateString);
      setEndDate('');
    } else if (startDate && !endDate) {
      const start = parseDateString(startDate);
      const current = parseDateString(day.dateString);
      if (current < start) {
        setStartDate(day.dateString);
        setEndDate(startDate);
      } else if (current > start) {
        setEndDate(day.dateString);
      } else {
        setEndDate('');
      }
    }
  };

  // Explicit parameters passed in mutationFn to completely prevent React stale closures
  const createSlotMutation = useMutation({
    mutationFn: async (payload: {
      editingId: string | null;
      title: string;
      locationName: string;
      locationCity: string;
      locationAddress: string;
      capacity: string;
      startDate: string;
      endDate: string;
      startTime: Date;
      endTime: Date;
    }) => {
      // If we are editing, delete the old schedule first (cancellation of the slot)
      if (payload.editingId) {
        const delRes = await api.delete(`/coach-app/schedules/${payload.editingId}`);
        if (delRes.data && delRes.data.success === false) {
          throw new Error(delRes.data.message || 'Failed to cancel the existing schedule');
        }
      }

      // 1. Create Location
      const locResponse = await api.post('/coach-app/locations', {
        name: payload.locationName || "Default Location",
        city: payload.locationCity || "City",
        address: payload.locationAddress || "Address",
        latitude: 0,
        longitude: 0
      });
      const locationId = locResponse.data?.data?._id || locResponse.data?.data?.id || locResponse.data?._id || locResponse.data?.id;

      if (!locationId) {
        throw new Error(`Could not resolve locationId`);
      }

      // 2. Create Schedule
      const schedPayload = {
        locationId,
        title: payload.title,
        startDate: payload.startDate, // "YYYY-MM-DD"
        endDate: payload.endDate || payload.startDate,
        daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], // Simplified
        startTime: formatTime24(payload.startTime),
        endTime: formatTime24(payload.endTime),
        capacity: parseInt(payload.capacity) || 1
      };
      
      const schedResponse = await api.post('/coach-app/schedules', schedPayload);
      return schedResponse.data;
    },
    onSuccess: () => {
      refetchSchedules();
      setIsModalVisible(false);
      setEditingSlotId(null);
      setNewTitle('');
      setStartDate('');
      setEndDate('');
      setLocationName('');
      setLocationAddress('');
      setLocationCity('');
      setCapacity('1');
      setFormErrors({});
      setSubmitError(null);
    },
    onError: (error: any) => {
      let serverMessage = '';
      if (error?.response?.data) {
        const data = error.response.data;
        serverMessage = typeof data.message === 'string' ? data.message : 
                        (Array.isArray(data.message) ? data.message[0] : 
                        (data.error || ''));
      }
      if (!serverMessage) {
        serverMessage = error.message || '';
      }

      const isConflict = error?.response?.status === 409 || 
                         error?.response?.status === 400 || 
                         serverMessage.toLowerCase().includes('conflict') || 
                         serverMessage.toLowerCase().includes('already') ||
                         serverMessage.toLowerCase().includes('overlap') ||
                         serverMessage.toLowerCase().includes('has');

      if (isConflict) {
        setFormErrors(prev => ({
          ...prev,
          dates: "The same dates and same time is already confirmed in another slot so do check that.",
          times: "Please choose a different date or time."
        }));
        setSubmitError(null);
      } else {
        setSubmitError(serverMessage || 'Failed to save slot');
      }
    }
  });

  const { data: fetchedSchedules, isLoading: isSchedulesLoading, refetch: refetchSchedules } = useQuery({
    queryKey: ['coachSchedules'],
    queryFn: async () => {
      const res = await api.get('/coach-app/schedules?status=active');
      return res.data?.data || res.data || [];
    }
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/coach-app/schedules/${id}`);
      return response.data;
    },
    onSuccess: () => {
      refetchSchedules();
      setDeleteError(null);
      Alert.alert('Success', 'Slot deleted successfully');
    },
    onError: (error: any) => {
      setDeleteError(error?.response?.data?.message || error.message || 'Failed to delete slot (already booked slots cannot be deleted)');
    }
  });

  const mapBackendScheduleToSlot = (sched: any): Slot => {
    const formatTime12 = (timeStr: string) => {
      if (!timeStr) return '';
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr);
      if (isNaN(h)) return timeStr;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 || 12;
      return `${String(displayHour).padStart(2, '0')}:${mStr} ${ampm}`;
    };

    const start12 = formatTime12(sched.startTime);
    const end12 = formatTime12(sched.endTime);
    const timeDisplay = start12 && end12 ? `${start12} - ${end12}` : (start12 || sched.startTime || '');

    let durationStr = '1 Hr';
    if (sched.startTime && sched.endTime) {
      const [sh, sm] = sched.startTime.split(':').map(Number);
      const [eh, em] = sched.endTime.split(':').map(Number);
      if (!isNaN(sh) && !isNaN(eh)) {
        const diffHrs = (eh + em/60) - (sh + sm/60);
        const resolvedHrs = diffHrs < 0 ? diffHrs + 24 : diffHrs;
        durationStr = `${Math.round(resolvedHrs * 10) / 10} Hr${resolvedHrs > 1 ? 's' : ''}`;
      }
    }

    let dateDisplay = sched.startDate || '';
    if (sched.startDate && sched.endDate && sched.startDate !== sched.endDate) {
      dateDisplay = `${sched.startDate} - ${sched.endDate}`;
    }

    // Safely combine date and time to preserve accurate values inside the form when editing
    const startTimeObj = parseTimeAndDateToDateObject(sched.startDate, sched.startTime);
    const endTimeObj = parseTimeAndDateToDateObject(sched.startDate, sched.endTime);

    const loc = (sched.location && typeof sched.location === 'object') ? sched.location : 
                ((sched.locationId && typeof sched.locationId === 'object') ? sched.locationId : null);

    return {
      id: sched._id || sched.id || Math.random().toString(),
      title: sched.title || 'Coaching Session',
      type: `Capacity: ${sched.capacity || 1} Person${(sched.capacity || 1) > 1 ? 's' : ''}`,
      date: dateDisplay,
      time: timeDisplay,
      duration: durationStr,
      raw: {
        startDateStr: sched.startDate || '',
        endDateStr: sched.endDate || '',
        startTimeIso: startTimeObj.toISOString(),
        endTimeIso: endTimeObj.toISOString(),
        locationName: loc?.name || sched.locationName || '',
        locationAddress: loc?.address || sched.locationAddress || '',
        locationCity: loc?.city || sched.locationCity || '',
        capacity: sched.capacity ? sched.capacity.toString() : '1'
      }
    };
  };

  const slotsList = Array.isArray(fetchedSchedules) ? fetchedSchedules.map(mapBackendScheduleToSlot) : [];

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!newTitle.trim()) errs.title = 'Title is required';
    if (!locationName.trim()) errs.locationName = 'Location name is required';
    if (!locationCity.trim()) errs.locationCity = 'City is required';
    if (!locationAddress.trim()) errs.locationAddress = 'Address is required';
    if (!startDate) errs.dates = 'Date selection is required';

    const diff = endTime.getTime() - startTime.getTime();
    if (diff <= 0) {
      errs.times = 'End time must be after start time';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateField = (field: string, val: string) => {
    let err = '';
    if (field === 'title') {
      if (!val.trim()) err = 'Title is required';
    } else if (field === 'locationName') {
      if (!val.trim()) err = 'Location name is required';
    } else if (field === 'locationCity') {
      if (!val.trim()) err = 'City is required';
    } else if (field === 'locationAddress') {
      if (!val.trim()) err = 'Address is required';
    }

    setFormErrors(prev => {
      const next = { ...prev };
      if (err) {
        next[field] = err;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const handleSaveSlot = () => {
    if (!validate()) return;
    createSlotMutation.mutate({
      editingId: editingSlotId,
      title: newTitle,
      locationName,
      locationCity,
      locationAddress,
      capacity,
      startDate,
      endDate,
      startTime,
      endTime
    });
  };

  const handleEditSlot = (slot: Slot) => {
    setEditingSlotId(slot.id);
    setNewTitle(slot.title);
    setSubmitError(null);
    if (slot.raw) {
      setStartDate(slot.raw.startDateStr);
      setEndDate(slot.raw.endDateStr);
      setLocationName(slot.raw.locationName || '');
      setLocationAddress(slot.raw.locationAddress || '');
      setLocationCity(slot.raw.locationCity || '');
      setCapacity(slot.raw.capacity === '2' ? '2' : '1');
      
      // Parse dates safely from the dynamic ISO fields
      setStartTime(new Date(slot.raw.startTimeIso));
      setEndTime(new Date(slot.raw.endTimeIso));
    } else {
      setStartDate('');
      setEndDate('');
      setStartTime(new Date());
      setEndTime(new Date(new Date().getTime() + 60 * 60 * 1000));
      setLocationName('');
      setLocationAddress('');
      setLocationCity('');
      setCapacity('1');
    }
    setFormErrors({});
    setIsModalVisible(true);
  };

  const [slotToDelete, setSlotToDelete] = useState<string | null>(null);

  const handleDeleteSlot = (id: string) => {
    setSlotToDelete(id);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 110, 130) }}>
        <View className="flex-row justify-between items-center mb-6">
          <Typography variant="h2" color="secondary" className="font-outfit-bold">
            My Schedule
          </Typography>
          <TouchableOpacity 
            onPress={() => {
              setEditingSlotId(null);
              setNewTitle('');
              setStartDate('');
              setEndDate('');
              setStartTime(new Date());
              setEndTime(new Date(new Date().getTime() + 60 * 60 * 1000));
              setLocationName('');
              setLocationAddress('');
              setLocationCity('');
              setCapacity('1');
              setFormErrors({});
              setSubmitError(null);
              setIsModalVisible(true);
            }}
            activeOpacity={0.8}
            className="bg-primary px-4 py-2 rounded-full flex-row items-center shadow-sm"
          >
            <Ionicons name="add" size={16} color="white" />
            <Typography variant="subtitle2" color="white" weight="bold" className="ml-1 font-outfit-bold">Add Slot</Typography>
          </TouchableOpacity>
        </View>

        <Typography variant="body1" color="muted" className="mb-4 font-outfit">
          Manage dynamic slot availability configurations
        </Typography>

        {deleteError && (
          <View className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex-row items-start shadow-sm animate-fade-in">
            <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5 mt-0.5" />
            <View className="flex-1">
              <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-red-800">
                Deletion Failed
              </Typography>
              <Typography variant="caption" className="font-outfit text-red-600 mt-0.5">
                {deleteError}
              </Typography>
            </View>
            <TouchableOpacity onPress={() => setDeleteError(null)} className="p-1 -mr-1 -mt-1">
              <Ionicons name="close" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        {isSchedulesLoading ? (
          <ActivityIndicator size="large" color="#FF5100" style={{ marginTop: 40 }} />
        ) : slotsList.length === 0 ? (
          <View className="items-center justify-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Ionicons name="calendar-outline" size={40} color="#9CA3AF" className="mb-2" />
            <Typography variant="body2" color="muted" align="center" className="font-outfit">No availability slots created yet.</Typography>
          </View>
        ) : (
          slotsList.map((slot, index) => (
            <Card key={slot.id} className={`mb-4 ${index === 0 ? 'border-l-4 border-primary' : ''}`}>
              <View className="flex-row justify-between">
                <View className="flex-1 mr-4">
                  <Typography variant="h3" color="secondary" className="font-outfit-bold">{slot.title}</Typography>
                  <Typography variant="caption" color="muted" className="mt-1 font-outfit">{slot.date}</Typography>
                  {slot.raw?.locationName ? (
                    <Typography variant="overline" color="text" className="mt-1 font-outfit opacity-75">{slot.raw.locationName} ({slot.raw.locationCity})</Typography>
                  ) : null}
                </View>
                <View className="items-end">
                  <Typography variant="body1" color="primary" className="font-outfit-bold font-bold">{slot.time}</Typography>
                  <Typography variant="body2" color="muted" className="font-outfit">{slot.duration}</Typography>
                  <View className="flex-row mt-3 items-center">
                    <TouchableOpacity onPress={() => handleEditSlot(slot)} activeOpacity={0.7} className="mr-3 bg-blue-50 p-2 rounded-full border border-blue-100 shadow-sm">
                      <Ionicons name="pencil" size={14} color="#3B82F6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteSlot(slot.id)} activeOpacity={0.7} className="bg-red-50 p-2 rounded-full border border-red-100 shadow-sm">
                      <Ionicons name="trash" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add Slot Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="bg-white rounded-t-3xl p-6 shadow-xl max-h-[85%]">
            <ScrollView 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 60, 80) }}
            >
              <View className="flex-row justify-between items-center mb-6">
                <Typography variant="h2" color="secondary" className="font-outfit-bold">{editingSlotId ? 'Edit Slot' : 'Add New Slot'}</Typography>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#0F2C59" />
                </TouchableOpacity>
              </View>

              {submitError && (
                <View className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex-row items-start shadow-sm">
                  <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5 mt-0.5" />
                  <View className="flex-1">
                    <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-red-800">
                      Save Failed
                    </Typography>
                    <Typography variant="caption" className="font-outfit text-red-600 mt-0.5">
                      {submitError}
                    </Typography>
                  </View>
                  <TouchableOpacity onPress={() => setSubmitError(null)} className="p-1 -mr-1 -mt-1">
                    <Ionicons name="close" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}

              <View className="space-y-4 mb-6">
                <TextInput 
                  label="Title"
                  placeholder="e.g. Badminton Coaching"
                  value={newTitle}
                  onChangeText={(text) => {
                    setNewTitle(text);
                    validateField('title', text);
                  }}
                  onBlur={() => validateField('title', newTitle)}
                  error={formErrors.title}
                />

                <TextInput 
                  label="Location Name"
                  placeholder="e.g. Ameerpet Cricket Ground"
                  value={locationName}
                  onChangeText={(text) => {
                    setLocationName(text);
                    validateField('locationName', text);
                  }}
                  onBlur={() => validateField('locationName', locationName)}
                  error={formErrors.locationName}
                />

                <View className="flex-row gap-4 mb-4">
                  <View className="flex-1">
                    <TextInput 
                      label="City"
                      placeholder="e.g. Hyderabad"
                      value={locationCity}
                      onChangeText={(text) => {
                        setLocationCity(text);
                        validateField('locationCity', text);
                      }}
                      onBlur={() => validateField('locationCity', locationCity)}
                      error={formErrors.locationCity}
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput 
                      label="Address"
                      placeholder="e.g. 123 Main St"
                      value={locationAddress}
                      onChangeText={(text) => {
                        setLocationAddress(text);
                        validateField('locationAddress', text);
                      }}
                      onBlur={() => validateField('locationAddress', locationAddress)}
                      error={formErrors.locationAddress}
                    />
                  </View>
                </View>

                <View className="flex-row gap-4 mb-4">
                  <View className="flex-1">
                    <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold">
                      Capacity
                    </Typography>
                    <View className="flex-row bg-gray-100 rounded-full p-1 h-14 items-center">
                      <TouchableOpacity 
                        onPress={() => setCapacity('1')}
                        activeOpacity={0.8}
                        className={`flex-1 h-full rounded-full items-center justify-center ${capacity === '1' ? 'bg-primary' : 'bg-transparent'}`}
                      >
                        <Typography color={capacity === '1' ? 'white' : 'secondary'} weight={capacity === '1' ? 'bold' : 'normal'} className="font-outfit text-sm">
                          1 Person
                        </Typography>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => setCapacity('2')}
                        activeOpacity={0.8}
                        className={`flex-1 h-full rounded-full items-center justify-center ${capacity === '2' ? 'bg-primary' : 'bg-transparent'}`}
                      >
                        <Typography color={capacity === '2' ? 'white' : 'secondary'} weight={capacity === '2' ? 'bold' : 'normal'} className="font-outfit text-sm">
                          2 Persons
                        </Typography>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex-1">
                    <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold">Select Dates</Typography>
                    <TouchableOpacity 
                      onPress={() => setShowCalendarModal(true)}
                      activeOpacity={0.8}
                      className={`bg-white border-2 rounded-full h-14 px-5 flex-row justify-between items-center ${
                        formErrors.dates ? 'border-red-500' : 'border-gray-200'
                      }`}
                    >
                      <Typography color="secondary" numberOfLines={1} className="font-outfit text-sm">
                        {formatDisplayDates(startDate, endDate)}
                      </Typography>
                      <Ionicons name="calendar-outline" size={20} color="#0F2C59" />
                    </TouchableOpacity>
                    {formErrors.dates && (
                      <Typography variant="caption" color="error" className="mt-1 ml-2 font-outfit">
                        {formErrors.dates}
                      </Typography>
                    )}
                  </View>
                </View>

                {/* Inline Start Time Pill Selector */}
                <View className="mb-4">
                  <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold uppercase tracking-wider text-gray-500">
                    Start Time
                  </Typography>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                    {['06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM'].map((tStr) => {
                      const timeDate = (()=>{
                        const [t, mod] = tStr.split(' ');
                        let [h, m] = t.split(':').map(Number);
                        if (mod === 'PM' && h < 12) h += 12;
                        if (mod === 'AM' && h === 12) h = 0;
                        const d = new Date();
                        d.setHours(h, m, 0, 0);
                        return d;
                      })();
                      const isSelected = startTime.getHours() === timeDate.getHours() && startTime.getMinutes() === timeDate.getMinutes();

                      return (
                        <TouchableOpacity
                          key={tStr}
                          onPress={() => setStartTime(timeDate)}
                          activeOpacity={0.8}
                          className={`px-4 py-2.5 rounded-full border-2 mr-2 justify-center items-center ${
                            isSelected ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                          }`}
                        >
                          <Typography color={isSelected ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
                            {tStr}
                          </Typography>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Inline End Time Pill Selector */}
                <View className="mb-4">
                  <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold uppercase tracking-wider text-gray-500">
                    End Time
                  </Typography>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                    {['07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM'].map((tStr) => {
                      const timeDate = (()=>{
                        const [t, mod] = tStr.split(' ');
                        let [h, m] = t.split(':').map(Number);
                        if (mod === 'PM' && h < 12) h += 12;
                        if (mod === 'AM' && h === 12) h = 0;
                        const d = new Date();
                        d.setHours(h, m, 0, 0);
                        return d;
                      })();
                      const isSelected = endTime.getHours() === timeDate.getHours() && endTime.getMinutes() === timeDate.getMinutes();

                      return (
                        <TouchableOpacity
                          key={tStr}
                          onPress={() => setEndTime(timeDate)}
                          activeOpacity={0.8}
                          className={`px-4 py-2.5 rounded-full border-2 mr-2 justify-center items-center ${
                            isSelected ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                          }`}
                        >
                          <Typography color={isSelected ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
                            {tStr}
                          </Typography>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {formErrors.times && (
                  <Typography variant="caption" color="error" className="mb-4 ml-1 font-outfit">
                    {formErrors.times}
                  </Typography>
                )}
              </View>

              <Button 
                title="Save Availability Slot" 
                onPress={handleSaveSlot} 
                isLoading={createSlotMutation.isPending}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Calendar Range Selection Overlay */}
        {showCalendarModal && (
          <View className="absolute top-0 bottom-0 left-0 right-0 justify-center bg-black/60 px-4 z-50">
            <View className="bg-white rounded-3xl p-6 shadow-xl">
              <View className="flex-row justify-between items-center mb-4">
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold">Select Range</Typography>
                <TouchableOpacity onPress={() => setShowCalendarModal(false)}>
                  <Ionicons name="close-circle" size={28} color="#0F2C59" />
                </TouchableOpacity>
              </View>
              <Typography variant="body2" color="muted" className="mb-4 font-outfit">
                Tap a start date, then tap an end date to select a range of days.
              </Typography>
              <Calendar
                minDate={formatToDateString(new Date())}
                markingType={'period'}
                markedDates={getMarkedDates()}
                onDayPress={onDayPress}
                theme={{
                  todayTextColor: '#F58220',
                  arrowColor: '#0F2C59',
                }}
              />
              <Button 
                title="Confirm Dates" 
                className="mt-6" 
                onPress={() => setShowCalendarModal(false)} 
              />
            </View>
          </View>
        )}
      </Modal>
      {/* Modern Confirm Modal for Slot Deletion */}
      <ConfirmModal
        visible={!!slotToDelete}
        onClose={() => setSlotToDelete(null)}
        onConfirm={() => {
          if (slotToDelete) {
            deleteSlotMutation.mutate(slotToDelete);
            setSlotToDelete(null);
          }
        }}
        title="Delete Availability Slot"
        message="Are you sure you want to delete this coaching availability slot?"
        confirmText="Delete Slot"
        cancelText="Cancel"
        variant="danger"
        iconName="trash"
        isLoading={deleteSlotMutation.isPending}
      />
    </SafeAreaView>
  );
}
