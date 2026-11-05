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

/**
 * Format 24-hr time (HH:mm) into human-friendly AM/PM
 */
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

/**
 * Format recurring weekdays e.g. ["MON", "WED", "FRI"] -> "Mon, Wed, Fri"
 */
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

/**
 * Format ISO Date to readable localized date string
 */
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

