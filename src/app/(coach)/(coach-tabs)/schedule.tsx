import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography, Card, Button, TextInput, ConfirmModal } from '@/components/ui';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';

interface Slot {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string;
  duration: string;
  sport?: string;
  raw?: {
    startDateStr: string;
    endDateStr: string;
    startTimeIso: string;
    endTimeIso: string;
    locationName?: string;
    locationAddress?: string;
    locationCity?: string;
    capacity?: string;
    sport?: string;
  };
}

// Helper to safely normalize and extract sport strings from strings or objects
const cleanSport = (sp: any): string => {
  if (!sp) return '';
  if (typeof sp === 'string') return sp.trim();
  if (typeof sp === 'object') {
    return String(sp.name || sp.sport || sp.title || sp.label || '').trim();
  }
  return String(sp).trim();
};

// Safe locations array extractor
const extractLocationsArray = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.locations)) return raw.locations;
  if (Array.isArray(raw?.data?.locations)) return raw.data.locations;
  return [];
};

// Convert backend 24h format and date string to a valid Date object in local time
const parseTimeAndDateToDateObject = (dateStr: any, timeStr: any): Date => {
  if (!dateStr || typeof dateStr !== 'string' || !timeStr || typeof timeStr !== 'string') return new Date();
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0);
  } catch {
    return new Date();
  }
};

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  
  const { data: profileResponse } = useQuery({
    queryKey: ['coachProfile'],
    queryFn: async () => {
      const res = await api.get('/coaches/my/profile');
      return res.data?.data || res.data;
    }
  });

  const { data: locationsResponse } = useQuery({
    queryKey: ['coachLocations'],
    queryFn: async () => {
      const res = await api.get('/coach-app/locations');
      return res.data?.data || res.data || [];
    }
  });

  // Extract coach's registered sports dynamically
  const coachRegisteredSports = useMemo(() => {
    const list: string[] = [];
    const add = (item: any) => {
      const s = cleanSport(item);
      if (s && s.toLowerCase() !== 'sports' && !list.some(existing => existing.toLowerCase() === s.toLowerCase())) {
        list.push(s);
      }
    };
    if (Array.isArray(profileResponse?.sports)) profileResponse.sports.forEach(add);
    if (Array.isArray(profileResponse?.profile?.sports)) profileResponse.profile.sports.forEach(add);
    if (profileResponse?.sport) add(profileResponse.sport);
    if (profileResponse?.profile?.sport) add(profileResponse.profile.sport);
    if (Array.isArray(user?.sports)) user.sports.forEach(add);
    return list;
  }, [profileResponse, user]);

  // Only show the coach's registered sports from onboarding/profile
  const availableSports = useMemo(() => {
    if (coachRegisteredSports.length > 0) {
      return coachRegisteredSports;
    }
    const fallback = cleanSport(profileResponse?.sport || (user as any)?.sport || user?.sports?.[0] || 'Tennis');
    return [fallback];
  }, [coachRegisteredSports, profileResponse, user]);

  // Pricing details dynamically resolved from profile (no hardcoded fallback)
  const coachApprovedIndividualPrice = 
    profileResponse?.individualPrice ?? 
    profileResponse?.profile?.individualPrice ?? 
    profileResponse?.requestedIndividualPrice ?? 
    profileResponse?.profile?.requestedIndividualPrice ??
    profileResponse?.pricePerSession ??
    profileResponse?.price ??
    profileResponse?.fee;

  const coachApprovedGroupPrice = 
    profileResponse?.groupPricePerPerson ?? 
    profileResponse?.profile?.groupPricePerPerson ?? 
    profileResponse?.requestedGroupPricePerPerson ?? 
    profileResponse?.profile?.requestedGroupPricePerPerson;

  // Form States
  const [selectedSport, setSelectedSport] = useState<string>('Tennis');
  const [newTitle, setNewTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Dynamic fee calculation based on selected capacity
  const resolvedSlotFee = useMemo(() => {
    const cap = parseInt(capacity, 10) || 1;
    if (cap > 1 && coachApprovedGroupPrice && Number(coachApprovedGroupPrice) > 0) {
      return Number(coachApprovedGroupPrice);
    }
    if (coachApprovedIndividualPrice && Number(coachApprovedIndividualPrice) > 0) {
      return Number(coachApprovedIndividualPrice);
    }
    return 0;
  }, [capacity, coachApprovedGroupPrice, coachApprovedIndividualPrice]);

  // Sync selected sport from coach profile when loaded
  useEffect(() => {
    if (coachRegisteredSports.length > 0 && (!selectedSport || selectedSport === 'Tennis')) {
      const primary = coachRegisteredSports[0];
      setSelectedSport(primary);
      if (!newTitle.trim() || newTitle.includes('Coaching')) {
        setNewTitle(`${primary} Coaching`);
      }
    }
  }, [coachRegisteredSports]);
  
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

  const formatTime24 = (d: any): string => {
    if (!d) return '09:00';
    if (typeof d === 'string') {
      if (d.includes(':')) {
        const parts = d.trim().split(' ');
        const timePart = parts[0];
        const ampm = parts[1]?.toUpperCase();
        let [hStr, mStr] = timePart.split(':');
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10) || 0;
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
      return d;
    }
    if (d instanceof Date || typeof d?.getHours === 'function') {
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    const dateObj = new Date(d);
    if (!isNaN(dateObj.getTime())) {
      return `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
    }
    return '09:00';
  };

  const TIME_SLOTS = [
    '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM',
    '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM',
    '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
    '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
    '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
    '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
    '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM',
    '10:00 PM'
  ];

  const parseTimeStringToDate = (tStr: string): Date => {
    const [t, mod] = tStr.split(' ');
    let [h, m] = t.split(':').map(Number);
    if (mod === 'PM' && h < 12) h += 12;
    if (mod === 'AM' && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const formatTime12Display = (date: Date): string => {
    let h = date.getHours();
    const m = String(date.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  };

  const handleSelectStartTime = (timeStr: string) => {
    const newStart = parseTimeStringToDate(timeStr);
    setStartTime(newStart);
    // Auto-advance End Time by current selected duration (capped at 2 hours / 120 mins)
    const effectiveDuration = Math.min(selectedDuration, 120);
    const newEnd = new Date(newStart.getTime() + effectiveDuration * 60 * 1000);
    setEndTime(newEnd);
    if (formErrors.times) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next.times;
        return next;
      });
    }
  };

  const handleSelectDuration = (durationMins: number) => {
    if (durationMins > 120) {
      setFormErrors(prev => ({
        ...prev,
        times: "You can't create a slot exceeding 2 hours duration."
      }));
      Alert.alert(
        'Duration Limit Exceeded',
        "You can't create a slot exceeding 2 hours duration. Maximum allowed slot duration is 2 hours (120 mins)."
      );
      return;
    }

    setSelectedDuration(durationMins);
    const newEnd = new Date(startTime.getTime() + durationMins * 60 * 1000);
    setEndTime(newEnd);
    if (formErrors.times) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next.times;
        return next;
      });
    }
  };

  const handleSelectEndTime = (timeStr: string) => {
    const newEnd = parseTimeStringToDate(timeStr);
    const startMs = startTime.getTime();
    const endMs = newEnd.getTime();
    const diffMins = Math.round((endMs - startMs) / (60 * 1000));

    if (diffMins > 120) {
      setFormErrors(prev => ({
        ...prev,
        times: "You can't create a slot exceeding 2 hours duration."
      }));
      Alert.alert(
        'Duration Limit Exceeded',
        "You can't create a slot exceeding 2 hours duration. Please select a time slot within 2 hours of start time."
      );
      return;
    }

    if (diffMins <= 0) {
      setFormErrors(prev => ({
        ...prev,
        times: 'End time must be after start time'
      }));
      return;
    }

    setEndTime(newEnd);
    setSelectedDuration(diffMins);
    if (formErrors.times) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next.times;
        return next;
      });
    }
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

  const createSlotMutation = useMutation({
    mutationFn: async (payload: {
      editingId: string | null;
      title: string;
      sport: string;
      locationName: string;
      locationCity: string;
      locationAddress: string;
      capacity: string;
      price?: string;
      startDate: string;
      endDate: string;
      startTime: any;
      endTime: any;
    }) => {
      if (payload.editingId) {
        await api.delete(`/coach-app/schedules/${payload.editingId}`).catch(() => {});
      }

      let locationId = '';
      const existingLocs = extractLocationsArray(locationsResponse);
      const locName = String(payload.locationName || '').trim();
      const matchingLoc = existingLocs.find((l: any) => 
        String(l?.name || '').toLowerCase() === locName.toLowerCase()
      );

      if (matchingLoc) {
        locationId = matchingLoc._id || matchingLoc.id;
      } else {
        const locResponse = await api.post('/coach-app/locations', {
          name: locName || "Sports Facility",
          city: String(payload.locationCity || "City").trim(),
          address: String(payload.locationAddress || "Address").trim(),
          latitude: 17.385,
          longitude: 78.4867
        });
        locationId = locResponse.data?.data?._id || locResponse.data?.data?.id || locResponse.data?._id || locResponse.data?.id;
      }

      if (!locationId) {
        throw new Error('Could not resolve location reference.');
      }

      const sport = cleanSport(payload.sport) || coachRegisteredSports[0] || 'Tennis';
      const cap = parseInt(payload.capacity, 10) || 1;
      const parsedPrice = payload.price && !isNaN(Number(payload.price)) ? Number(payload.price) : undefined;
      const isSingleSlot = !payload.endDate || payload.startDate === payload.endDate;

      if (isSingleSlot) {
        const sessionPayload: any = {
          locationId,
          title: String(payload.title || `${sport} Coaching`).trim(),
          date: payload.startDate,
          startTime: formatTime24(payload.startTime),
          endTime: formatTime24(payload.endTime),
          capacity: cap,
          sport
        };
        if (parsedPrice !== undefined) {
          sessionPayload.price = parsedPrice;
          sessionPayload.pricePerPerson = parsedPrice;
        }
        const res = await api.post('/coach-app/sessions', sessionPayload);
        return res.data;
      } else {
        const schedPayload: any = {
          locationId,
          title: String(payload.title || `${sport} Coaching`).trim(),
          startDate: payload.startDate,
          endDate: payload.endDate,
          daysOfWeek: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
          startTime: formatTime24(payload.startTime),
          endTime: formatTime24(payload.endTime),
          capacity: cap,
          sport
        };
        if (parsedPrice !== undefined) {
          schedPayload.price = parsedPrice;
          schedPayload.pricePerPerson = parsedPrice;
        }
        const schedResponse = await api.post('/coach-app/schedules', schedPayload);
        return schedResponse.data;
      }
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
        if (typeof data.message === 'string') {
          serverMessage = data.message;
        } else if (Array.isArray(data.message) && typeof data.message[0] === 'string') {
          serverMessage = data.message[0];
        } else if (typeof data.error === 'string') {
          serverMessage = data.error;
        } else if (typeof data.error?.message === 'string') {
          serverMessage = data.error.message;
        }
      }
      if (!serverMessage) {
        serverMessage = error?.message || 'Failed to save slot';
      }

      const lowerMsg = String(serverMessage).toLowerCase();
      const isConflict = error?.response?.status === 409 || 
                         error?.response?.status === 400 || 
                         lowerMsg.includes('conflict') || 
                         lowerMsg.includes('already') ||
                         lowerMsg.includes('overlap') ||
                         lowerMsg.includes('has');

      if (isConflict) {
        setFormErrors(prev => ({
          ...prev,
          dates: "The same dates and same time is already confirmed in another slot so do check that.",
          times: "Please choose a different date or time."
        }));
        setSubmitError(null);
      } else {
        setSubmitError(serverMessage);
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
      setDeleteError(error?.response?.data?.message || error?.message || 'Failed to delete slot (already booked slots cannot be deleted)');
    }
  });

  const mapBackendScheduleToSlot = (sched: any): Slot => {
    const formatTime12 = (timeStr: any) => {
      if (!timeStr || typeof timeStr !== 'string') return '';
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr, 10);
      if (isNaN(h)) return timeStr;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h % 12 || 12;
      return `${String(displayHour).padStart(2, '0')}:${mStr || '00'} ${ampm}`;
    };

    const start12 = formatTime12(sched?.startTime);
    const end12 = formatTime12(sched?.endTime);
    const timeDisplay = start12 && end12 ? `${start12} - ${end12}` : (start12 || sched?.startTime || '');

    let durationStr = '1 Hr';
    if (typeof sched?.startTime === 'string' && typeof sched?.endTime === 'string') {
      const [sh, sm] = sched.startTime.split(':').map(Number);
      const [eh, em] = sched.endTime.split(':').map(Number);
      if (!isNaN(sh) && !isNaN(eh)) {
        const diffHrs = (eh + (em || 0)/60) - (sh + (sm || 0)/60);
        const resolvedHrs = diffHrs < 0 ? diffHrs + 24 : diffHrs;
        durationStr = `${Math.round(resolvedHrs * 10) / 10} Hr${resolvedHrs > 1 ? 's' : ''}`;
      }
    }

    let dateDisplay = sched?.startDate || '';
    if (sched?.startDate && sched?.endDate && sched.startDate !== sched.endDate) {
      dateDisplay = `${sched.startDate} - ${sched.endDate}`;
    }

    // Safely combine date and time to preserve accurate values inside the form when editing
    const startTimeObj = parseTimeAndDateToDateObject(sched?.startDate, sched?.startTime);
    const endTimeObj = parseTimeAndDateToDateObject(sched?.startDate, sched?.endTime);

    const loc = (sched?.location && typeof sched.location === 'object') ? sched.location : 
                ((sched?.locationId && typeof sched.locationId === 'object') ? sched.locationId : null);

    const slotSport = cleanSport(sched?.sport || sched?.sportName || coachRegisteredSports[0] || 'Tennis');

    return {
      id: sched?._id || sched?.id || Math.random().toString(),
      title: sched?.title || `${slotSport} Coaching`,
      type: `Capacity: ${sched?.capacity || 1} Person${(sched?.capacity || 1) > 1 ? 's' : ''}`,
      date: dateDisplay,
      time: timeDisplay,
      duration: durationStr,
      sport: slotSport,
      raw: {
        startDateStr: sched?.startDate || '',
        endDateStr: sched?.endDate || '',
        startTimeIso: startTimeObj.toISOString(),
        endTimeIso: endTimeObj.toISOString(),
        locationName: loc?.name || sched?.locationName || '',
        locationAddress: loc?.address || sched?.locationAddress || '',
        locationCity: loc?.city || sched?.locationCity || '',
        capacity: sched?.capacity ? sched.capacity.toString() : '1',
        sport: slotSport
      }
    };
  };

  const slotsList = Array.isArray(fetchedSchedules) ? fetchedSchedules.map(mapBackendScheduleToSlot) : [];

  // Existing slots scheduled for the selected date
  const existingSlotsForSelectedDate = useMemo(() => {
    if (!startDate) return [];
    return slotsList.filter(s => {
      const raw = s.raw;
      if (!raw?.startDateStr) return false;
      if (raw.endDateStr && raw.endDateStr !== raw.startDateStr) {
        return startDate >= raw.startDateStr && startDate <= raw.endDateStr;
      }
      return raw.startDateStr === startDate;
    });
  }, [startDate, slotsList]);

  // Available End Time slots strictly after current startTime and up to 2 hours (120 mins)
  const availableEndSlots = useMemo(() => {
    const startMins = startTime.getHours() * 60 + startTime.getMinutes();
    return TIME_SLOTS.filter(tStr => {
      const d = parseTimeStringToDate(tStr);
      const endMins = d.getHours() * 60 + d.getMinutes();
      const diff = endMins - startMins;
      return diff > 0 && diff <= 120;
    });
  }, [startTime]);

  const validate = () => {
    const errs: Record<string, string> = {};
    const titleVal = String(newTitle || '').trim();
    const locNameVal = String(locationName || '').trim();
    const locCityVal = String(locationCity || '').trim();
    const locAddressVal = String(locationAddress || '').trim();

    if (!titleVal) errs.title = 'Title is required';
    if (!locNameVal) errs.locationName = 'Location name is required';
    if (!locCityVal) errs.locationCity = 'City is required';
    if (!locAddressVal) errs.locationAddress = 'Address is required';
    if (!startDate) errs.dates = 'Date selection is required';

    const sTime = startTime instanceof Date ? startTime : new Date(startTime);
    const eTime = endTime instanceof Date ? endTime : new Date(endTime);
    if (!isNaN(sTime.getTime()) && !isNaN(eTime.getTime())) {
      const diffMs = eTime.getTime() - sTime.getTime();
      const diffMins = Math.round(diffMs / (60 * 1000));
      if (diffMs <= 0) {
        errs.times = 'End time must be after start time';
      } else if (diffMins > 120) {
        errs.times = "You can't create a slot exceeding 2 hours duration.";
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateField = (field: string, val: string | undefined | null) => {
    const cleanVal = String(val || '').trim();
    let err = '';
    if (field === 'title' && !cleanVal) err = 'Title is required';
    if (field === 'locationName' && !cleanVal) err = 'Location name is required';
    if (field === 'locationCity' && !cleanVal) err = 'City is required';
    if (field === 'locationAddress' && !cleanVal) err = 'Address is required';

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
    if (!validate()) {
      const sTime = startTime instanceof Date ? startTime : new Date(startTime);
      const eTime = endTime instanceof Date ? endTime : new Date(endTime);
      const diffMins = Math.round((eTime.getTime() - sTime.getTime()) / (60 * 1000));
      if (diffMins > 120) {
        Alert.alert('Duration Limit', "You can't create a slot exceeding 2 hours duration. Please select a duration of 2 hours or less.");
      }
      return;
    }
    const finalSport = cleanSport(selectedSport) || coachRegisteredSports[0] || 'Tennis';
    createSlotMutation.mutate({
      editingId: editingSlotId,
      title: String(newTitle || '').trim() || `${finalSport} Coaching`,
      sport: finalSport,
      locationName,
      locationCity,
      locationAddress,
      capacity,
      price: resolvedSlotFee > 0 ? String(resolvedSlotFee) : undefined,
      startDate,
      endDate,
      startTime,
      endTime
    });
  };

  const handleEditSlot = (slot: Slot) => {
    setEditingSlotId(slot.id);
    setNewTitle(slot.title);
    if (slot.sport) {
      setSelectedSport(slot.sport);
    }
    setSubmitError(null);
    if (slot.raw) {
      setStartDate(slot.raw.startDateStr);
      setEndDate(slot.raw.endDateStr);
      setLocationName(slot.raw.locationName || '');
      setLocationAddress(slot.raw.locationAddress || '');
      setLocationCity(slot.raw.locationCity || '');
      setCapacity(slot.raw.capacity === '2' ? '2' : '1');
      if (slot.raw.sport) {
        setSelectedSport(slot.raw.sport);
      }
      
      const sObj = new Date(slot.raw.startTimeIso);
      const eObj = new Date(slot.raw.endTimeIso);
      setStartTime(sObj);
      setEndTime(eObj);
      const diffMins = Math.round((eObj.getTime() - sObj.getTime()) / (60 * 1000));
      if (diffMins > 0) {
        setSelectedDuration(diffMins);
      }
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

  const handleOpenAddSlot = () => {
    setEditingSlotId(null);
    const initialSport = coachRegisteredSports[0] || cleanSport(selectedSport) || 'Tennis';
    setSelectedSport(initialSport);
    setNewTitle(`${initialSport} Coaching`);
    setStartDate('');
    setEndDate('');

    // Pre-fill location if coach already has existing locations to keep venue consistent
    const existingLocs = extractLocationsArray(locationsResponse);
    if (existingLocs.length > 0) {
      const primaryLoc = existingLocs[0];
      setLocationName(primaryLoc.name || '');
      setLocationCity(primaryLoc.city || '');
      setLocationAddress(primaryLoc.address || '');
    } else {
      setLocationName('');
      setLocationAddress('');
      setLocationCity('');
    }

    const defaultStart = parseTimeStringToDate('06:00 PM');
    const defaultEnd = parseTimeStringToDate('07:00 PM');
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setSelectedDuration(60);

    setCapacity('1');
    setFormErrors({});
    setSubmitError(null);
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
            onPress={handleOpenAddSlot}
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
                {/* Session Sport Selector (strictly from coach's profile sports) */}
                <View className="mb-2">
                  <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold uppercase tracking-wider text-gray-500">
                    Session Sport
                  </Typography>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                    {availableSports.map((sp) => {
                      const s = cleanSport(sp);
                      const isSelected = cleanSport(selectedSport).toLowerCase() === s.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={s}
                          onPress={() => {
                            setSelectedSport(s);
                            setNewTitle(`${s} Coaching`);
                            if (formErrors.title) {
                              validateField('title', `${s} Coaching`);
                            }
                          }}
                          activeOpacity={0.8}
                          className={`px-4 py-2 rounded-full border-2 mr-2 justify-center items-center ${
                            isSelected ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                          }`}
                        >
                          <Typography color={isSelected ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
                            {s}
                          </Typography>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <TextInput 
                  label="Title"
                  placeholder={`e.g. ${selectedSport} Coaching`}
                  value={newTitle}
                  onChangeText={(text) => {
                    setNewTitle(text);
                    validateField('title', text);
                  }}
                  onBlur={() => validateField('title', newTitle)}
                  error={formErrors.title}
                />

                {/* Quick Venue Selection if coach has existing locations */}
                {(() => {
                  const existingLocs = extractLocationsArray(locationsResponse);
                  if (existingLocs.length === 0) return null;
                  return (
                    <View className="mb-2">
                      <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold uppercase tracking-wider text-gray-500">
                        Select Existing Venue
                      </Typography>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                        {existingLocs.map((loc: any) => {
                          const isLocSelected = String(locationName || '').toLowerCase() === String(loc.name || '').toLowerCase();
                          return (
                            <TouchableOpacity
                              key={loc._id || loc.id}
                              onPress={() => {
                                setLocationName(loc.name || '');
                                setLocationCity(loc.city || '');
                                setLocationAddress(loc.address || '');
                                validateField('locationName', loc.name || '');
                                validateField('locationCity', loc.city || '');
                                validateField('locationAddress', loc.address || '');
                              }}
                              activeOpacity={0.8}
                              className={`px-3.5 py-2 rounded-xl border mr-2 flex-row items-center ${
                                isLocSelected ? 'bg-secondary border-secondary' : 'bg-white border-gray-200'
                              }`}
                            >
                              <Ionicons name="location" size={13} color={isLocSelected ? '#FF5100' : '#6B7280'} style={{ marginRight: 4 }} />
                              <Typography color={isLocSelected ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
                                {loc.name}
                              </Typography>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  );
                })()}

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

                {/* Dynamic Session Fee Badge (No input box needed) */}
                <View className="mb-4 flex-row items-center bg-orange-50/90 border border-orange-200/80 px-4 py-3 rounded-2xl">
                  <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center mr-3">
                    <Ionicons name="pricetag" size={16} color="#FF5100" />
                  </View>
                  <View className="flex-1">
                    <Typography variant="caption" color="muted" weight="bold" className="font-outfit-bold text-[10px] uppercase tracking-wider">
                      {parseInt(capacity, 10) > 1 ? 'Approved Group Fee' : 'Approved Individual Fee'}
                    </Typography>
                    <Typography variant="body1" color="primary" weight="bold" className="font-outfit-bold text-base mt-0.5">
                      {resolvedSlotFee > 0 ? `₹${resolvedSlotFee}${parseInt(capacity, 10) > 1 ? ' / person' : ''}` : 'Free Session'}
                    </Typography>
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

                {/* Existing Slots on this date (prevents accidental overlap) */}
                {existingSlotsForSelectedDate.length > 0 && (
                  <View className="mb-4 bg-blue-50/90 border border-blue-200/80 rounded-2xl p-3.5">
                    <View className="flex-row items-center mb-1.5">
                      <Ionicons name="information-circle" size={16} color="#0F2C59" style={{ marginRight: 6 }} />
                      <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">
                        Already Scheduled on {startDate}:
                      </Typography>
                    </View>
                    <View className="flex-row flex-wrap gap-1.5">
                      {existingSlotsForSelectedDate.map(slot => (
                        <View key={slot.id} className="bg-white border border-blue-200/60 px-2.5 py-1 rounded-lg">
                          <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-[11px]">
                            {slot.time} • {slot.sport}
                          </Typography>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Session Duration Selector (30 mins, 45 mins, 1 hr, etc.) */}
                <View className="mb-3">
                  <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold uppercase tracking-wider text-gray-500">
                    Session Duration
                  </Typography>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { label: '30 Mins', mins: 30 },
                      { label: '45 Mins', mins: 45 },
                      { label: '1 Hour', mins: 60 },
                      { label: '1.5 Hours', mins: 90 },
                      { label: '2 Hours', mins: 120 }
                    ].map(dur => {
                      const isDurSelected = selectedDuration === dur.mins;
                      return (
                        <TouchableOpacity
                          key={dur.mins}
                          onPress={() => handleSelectDuration(dur.mins)}
                          activeOpacity={0.8}
                          className={`px-3.5 py-2 rounded-full border ${
                            isDurSelected ? 'bg-secondary border-secondary' : 'bg-white border-gray-200'
                          }`}
                        >
                          <Typography color={isDurSelected ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
                            {dur.label}
                          </Typography>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Inline Start Time Pill Selector (30-min increments) */}
                <View className="mb-3">
                  <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold uppercase tracking-wider text-gray-500">
                    Start Time
                  </Typography>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                    {TIME_SLOTS.map((tStr) => {
                      const timeDate = parseTimeStringToDate(tStr);
                      const isSelected = startTime.getHours() === timeDate.getHours() && startTime.getMinutes() === timeDate.getMinutes();

                      return (
                        <TouchableOpacity
                          key={tStr}
                          onPress={() => handleSelectStartTime(tStr)}
                          activeOpacity={0.8}
                          className={`px-3.5 py-2 rounded-full border-2 mr-2 justify-center items-center ${
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

                {/* Inline End Time Pill Selector (strictly after Start Time, max 2 hours) */}
                <View className="mb-4">
                  <View className="flex-row justify-between items-center mb-2">
                    <Typography variant="caption" color="secondary" weight="bold" className="ml-1 font-outfit-bold uppercase tracking-wider text-gray-500">
                      End Time (Max 2 Hours)
                    </Typography>
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs mr-1">
                      {formatTime12Display(endTime)} ({selectedDuration} mins)
                    </Typography>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                    {availableEndSlots.map((tStr) => {
                      const timeDate = parseTimeStringToDate(tStr);
                      const isSelected = endTime.getHours() === timeDate.getHours() && endTime.getMinutes() === timeDate.getMinutes();

                      return (
                        <TouchableOpacity
                          key={tStr}
                          onPress={() => handleSelectEndTime(tStr)}
                          activeOpacity={0.8}
                          className={`px-3.5 py-2 rounded-full border-2 mr-2 justify-center items-center ${
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
                  <View className="mb-4 flex-row items-center bg-red-50 border border-red-200 px-3.5 py-2.5 rounded-xl">
                    <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                    <Typography variant="caption" weight="bold" className="font-outfit-bold text-xs text-red-600 flex-1">
                      {formErrors.times}
                    </Typography>
                  </View>
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
