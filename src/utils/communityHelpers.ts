import * as Location from 'expo-location';

export interface CommunityPlan {
  _id?: string;
  planIndex: number;
  duration: number;
  unit: 'week' | 'month';
  label: string;
  price: number;
  isActive: boolean;
}

export interface CommunityProgram {
  _id: string;
  communityId?: string;
  sport: string;
  title: string;
  startDate?: string;
  endDate?: string;
  sessionDays: string[];
  sessionStartTime: string;
  sessionEndTime: string;
  capacity: number;
  activeSubscribers?: number;
  status?: string;
  plans: CommunityPlan[];
  coaches?: Array<{
    coachId: {
      _id: string;
      name: string;
      avatar?: string;
    } | string;
    salary?: number;
    isActive: boolean;
  }>;
}

export interface CommunityCenter {
  _id: string;
  name: string;
  description: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  attendanceRadius: number;
  timeZone: string;
  status: string;
  image?: string;
  programs?: CommunityProgram[];
  sports?: string[];
  subscriberCount?: number;
}

export interface UserChild {
  _id: string;
  name: string;
  age?: number;
  sport?: string;
  school?: string;
}

export interface CommunitySubscription {
  _id: string;
  programId: string | any;
  userId?: string;
  participantId?: string;
  participantName: string;
  status: 'active' | 'expired' | 'cancelled' | string;
  paymentStatus: 'paid' | 'refunded' | 'partially_refunded' | string;
  plan: {
    duration: number;
    unit: string;
    label?: string;
    price: number;
    startDate: string;
    endDate: string;
  };
  communityName?: string;
  programTitle?: string;
  sport?: string;
  createdAt?: string;
  refundStatus?: string;
  refundedAmountPaise?: number;
}

export interface CoachAttendanceToday {
  date: string;
  timeZone: string;
  isScheduled: boolean;
  programStatus: string;
  communityStatus: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  attendance: {
    _id: string;
    status: 'started' | 'completed' | 'no_show' | string;
    startAt?: string;
    endAt?: string;
    autoClosed?: boolean;
    endedBy?: 'coach' | 'system' | string;
    reviewRequired?: boolean;
  } | null;
  openAttendance: any | null;
}

export interface NormalizedCoachProgram {
  programId: string;
  title: string;
  sport: string;
  communityName: string;
  communityAddress: string;
  communityCity: string;
  timeZone: string;
  sessionDays: string[];
  sessionStartTime: string;
  sessionEndTime: string;
  salary: number;
  subscribersCount: number;
  isAttendanceActive: boolean;
  latitude?: number;
  longitude?: number;
  attendanceRadius?: number;
  rawItem: any;
}

export const formatTimeHHmm = (timeStr?: string): string => {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
};

export const formatWeekdays = (days?: string[]): string => {
  if (!days || !Array.isArray(days) || days.length === 0) return 'Daily';
  if (days.length === 7) return 'Every Day (Mon - Sun)';
  if (days.length === 5 && !days.includes('SAT') && !days.includes('SUN')) return 'Weekdays (Mon - Fri)';
  if (days.length === 2 && days.includes('SAT') && days.includes('SUN')) return 'Weekends (Sat & Sun)';

  const map: Record<string, string> = {
    MON: 'Mon',
    TUE: 'Tue',
    WED: 'Wed',
    THU: 'Thu',
    FRI: 'Fri',
    SAT: 'Sat',
    SUN: 'Sun',
  };

  return days.map(d => map[d.toUpperCase()] || d).join(', ');
};

export const formatDateOnly = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return isoString;
  }
};

/**
 * Check if today (Asia/Kolkata IST) matches any of the program session weekdays
 */
export const isProgramScheduledToday = (sessionDays?: string[]): boolean => {
  if (!sessionDays || !Array.isArray(sessionDays) || sessionDays.length === 0) return true;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short'
    });
    const weekdayShort = formatter.format(new Date()).toUpperCase(); // "MON", "TUE", etc.
    return sessionDays.some(d => d.toUpperCase().startsWith(weekdayShort.slice(0, 3)));
  } catch {
    const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const today = dayMap[new Date().getDay()];
    return sessionDays.map(d => d.toUpperCase()).includes(today);
  }
};

/**
 * Normalize any coach-app/communities response structure into standard items
 */
export const normalizeCoachPrograms = (rawList: any): NormalizedCoachProgram[] => {
  const items = Array.isArray(rawList?.data)
    ? rawList.data
    : Array.isArray(rawList)
    ? rawList
    : [];

  const result: NormalizedCoachProgram[] = [];

  for (const item of items) {
    if (!item) continue;

    // Case 1: Community center containing an array of nested programs
    if (item.programs && Array.isArray(item.programs) && item.programs.length > 0) {
      for (const prog of item.programs) {
        if (!prog) continue;
        const progId = String(prog._id || prog.id || prog.programId || '');
        if (!progId) continue;

        result.push({
          programId: progId,
          title: prog.title || prog.name || 'Coaching Batch',
          sport: prog.sport || 'Sports',
          communityName: item.name || item.communityName || 'Sports Academy',
          communityAddress: item.address || item.location || '',
          communityCity: item.city || '',
          timeZone: item.timeZone || 'Asia/Kolkata',
          sessionDays: prog.sessionDays || [],
          sessionStartTime: prog.sessionStartTime || '',
          sessionEndTime: prog.sessionEndTime || '',
          salary: prog.salary ?? prog.ownSalary ?? item.salary ?? 0,
          subscribersCount: prog.activeSubscribersCount ?? prog.subscribersCount ?? 0,
          isAttendanceActive: !!(prog.isAttendanceActive || prog.todayAttendance?.status === 'started' || prog.attendance?.status === 'started'),
          latitude: item.latitude ?? prog.latitude,
          longitude: item.longitude ?? prog.longitude,
          attendanceRadius: item.attendanceRadius ?? prog.attendanceRadius ?? 300,
          rawItem: prog
        });
      }
    } else {
      // Case 2: Direct program or assignment object
      const progId = String(item.programId || item.program?._id || item._id || item.id || '');
      if (!progId) continue;

      const commObj = item.community || {};
      const commName = commObj.name || item.communityName || 'Sports Academy';
      const commAddress = commObj.address || item.address || item.location || '';
      const commCity = commObj.city || item.city || '';
      const timeZone = commObj.timeZone || item.timeZone || 'Asia/Kolkata';

      result.push({
        programId: progId,
        title: item.title || item.program?.title || item.name || 'Coaching Batch',
        sport: item.sport || item.program?.sport || 'Sports',
        communityName: commName,
        communityAddress: commAddress,
        communityCity: commCity,
        timeZone: timeZone,
        sessionDays: item.sessionDays || item.program?.sessionDays || [],
        sessionStartTime: item.sessionStartTime || item.program?.sessionStartTime || '',
        sessionEndTime: item.sessionEndTime || item.program?.sessionEndTime || '',
        salary: item.salary ?? item.ownSalary ?? item.program?.salary ?? 0,
        subscribersCount: item.activeSubscribersCount ?? item.subscribersCount ?? item.program?.activeSubscribersCount ?? 0,
        isAttendanceActive: !!(item.isAttendanceActive || item.todayAttendance?.status === 'started' || item.attendance?.status === 'started'),
        latitude: commObj.latitude ?? item.latitude,
        longitude: commObj.longitude ?? item.longitude,
        attendanceRadius: commObj.attendanceRadius ?? item.attendanceRadius ?? 300,
        rawItem: item
      });
    }
  }

  return result;
};

/**
 * Acquire GPS location quickly with last-known fallback and timeout safety
 */
export const getQuickLocationCoordinates = async (): Promise<{ latitude: number; longitude: number }> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }

  // 1. Try last known position first (fastest, especially indoors)
  try {
    const last = await Location.getLastKnownPositionAsync();
    if (last && last.coords) {
      const ageMs = Date.now() - (last.timestamp || 0);
      if (ageMs < 5 * 60 * 1000) {
        return { latitude: last.coords.latitude, longitude: last.coords.longitude };
      }
    }
  } catch (_) {}

  // 2. Fetch fresh position with Balanced accuracy and 10s timeout
  const locPromise = Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), 10000)
  );

  const loc = await Promise.race([locPromise, timeoutPromise]);
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
};

/**
 * Transform server attendance error into clear, actionable user messages
 */
export const formatCommunityAttendanceError = (
  err: any, 
  isStart: boolean
): { title: string; message: string; isAlreadyStarted?: boolean; isAlreadyEnded?: boolean } => {
  const rawMsg = err?.response?.data?.message || err?.message || '';
  const status = err?.response?.status;
  const lower = rawMsg.toLowerCase();

  if (err?.message === 'PERMISSION_DENIED') {
    return {
      title: 'GPS Access Required',
      message: 'Location access is required to verify your physical presence at the community coaching venue.'
    };
  }

  if (err?.message === 'LOCATION_TIMEOUT') {
    return {
      title: 'GPS Signal Delayed',
      message: 'Could not acquire GPS coordinates in time. Please ensure device Location/GPS is turned on with high accuracy and try again.'
    };
  }

  if (lower.includes('already started') || lower.includes('in progress') || lower.includes('already active')) {
    return {
      title: 'Session Already Live',
      message: 'Your GPS attendance check-in has already been recorded and is currently active for today.',
      isAlreadyStarted: true
    };
  }

  if (lower.includes('already end') || lower.includes('already completed') || lower.includes('already closed')) {
    return {
      title: 'Session Completed',
      message: 'This session has already been marked completed for today.',
      isAlreadyEnded: true
    };
  }

  if (lower.includes('not near') || lower.includes('distance') || lower.includes('radius') || lower.includes('location')) {
    return {
      title: 'Outside Venue Radius',
      message: 'You must be physically present within the community coaching facility boundary to record attendance. Please move closer to the academy grounds and try again.'
    };
  }

  if (lower.includes('not scheduled') || lower.includes('no session')) {
    return {
      title: 'No Session Scheduled',
      message: 'This coaching batch is not scheduled for today. Please check the session days in the program details.'
    };
  }

  if (lower.includes('outside') || lower.includes('time window') || lower.includes('hours') || lower.includes('early') || lower.includes('late')) {
    return {
      title: 'Outside Session Hours',
      message: 'Attendance check-in is only available during the scheduled program batch hours.'
    };
  }

  if (status === 403 || lower.includes('not assigned') || lower.includes('unauthorized')) {
    return {
      title: 'Assignment Required',
      message: 'Your coach account is not actively assigned to this program batch. Please contact your academy administrator.'
    };
  }

  return {
    title: isStart ? 'Check-in Notice' : 'Check-out Notice',
    message: rawMsg || (isStart ? 'Could not record GPS check-in at this time. Please try again.' : 'Could not record session check-out. Please try again.')
  };
};
