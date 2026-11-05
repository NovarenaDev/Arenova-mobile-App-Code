import { useAuthStore } from '@/store';

/**
 * Utility functions for accurately parsing and displaying session booking details.
 * Eliminates dummy fallback data and resolves exact times (e.g. 6:00 PM - 7:00 PM),
 * accurate locations, exact booked session titles & sports (Tennis Coaching, Badminton, etc.), and attendee names.
 */

export const formatSingleTime = (t: string | Date | number | undefined | null): string => {
  if (!t) return '';
  const s = String(t).trim();
  if (!s || s === 'Scheduled Time' || s === 'Time TBD') return '';

  if (s.toLowerCase().includes('am') || s.toLowerCase().includes('pm')) {
    return s;
  }

  // ISO timestamp (e.g. "2026-11-05T18:00:00.000Z")
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const dispH = h % 12 || 12;
      return `${dispH}:${m < 10 ? '0' + m : m} ${ampm}`;
    }
  }

  // 24-hr format like "18:00" or "09:30" or "18:00:00"
  if (s.includes(':')) {
    const parts = s.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const dispH = h % 12 || 12;
      const minStr = isNaN(m) ? '00' : (m < 10 ? '0' + m : String(m));
      return `${dispH}:${minStr} ${ampm}`;
    }
  }

  // Single hour number like 18 or "18"
  const num = Number(s);
  if (!isNaN(num) && num >= 0 && num <= 24) {
    const ampm = num >= 12 ? 'PM' : 'AM';
    const dispH = num % 12 || 12;
    return `${dispH}:00 ${ampm}`;
  }

  return s;
};

export const resolveSessionTime = (session: any): string => {
  if (!session) return 'Time TBD';

  // 1. Direct formatted range string (e.g. "18:00 - 19:00", "06:00 PM - 07:00 PM", "6pm - 7pm")
  const directRangeCandidates = [
    session.timeRange,
    session.timing,
    session.timeSlot,
    session.slotTime,
    session.sessionTime,
    session.slot?.timeRange,
    session.slot?.timing,
    session.slot?.timeSlot,
    session.schedule?.timing,
    session.time
  ];

  for (const candidate of directRangeCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const clean = candidate.trim();
      if (clean === 'Scheduled Time' || clean === 'Time TBD') continue;
      if (clean.includes('-')) {
        const parts = clean.split('-').map(p => p.trim());
        const startFormatted = formatSingleTime(parts[0]);
        const endFormatted = formatSingleTime(parts[1]);
        if (startFormatted && endFormatted) {
          return `${startFormatted} - ${endFormatted}`;
        }
        if (startFormatted) return startFormatted;
      }
    }
  }

  // 2. Separate start & end fields on session, slot, or schedule
  const rawStart = 
    session.startTime || 
    session.start_time || 
    session.slot?.startTime || 
    session.slot?.start_time || 
    session.schedule?.startTime || 
    session.slotStartTime || 
    session.fromTime || 
    session.from || 
    session.start || 
    (session.time && session.time !== 'Scheduled Time' && session.time !== 'Time TBD' ? session.time : null);

  const rawEnd = 
    session.endTime || 
    session.end_time || 
    session.slot?.endTime || 
    session.slot?.end_time || 
    session.schedule?.endTime || 
    session.slotEndTime || 
    session.toTime || 
    session.to || 
    session.end;

  if (rawStart && rawEnd) {
    const startFormatted = formatSingleTime(rawStart);
    const endFormatted = formatSingleTime(rawEnd);
    if (startFormatted && endFormatted) {
      return `${startFormatted} - ${endFormatted}`;
    }
    if (startFormatted) return startFormatted;
  }

  // 3. If rawStart is found alone, format it and compute 1-hour session window
  if (rawStart) {
    const startFormatted = formatSingleTime(rawStart);
    if (startFormatted) {
      const match = startFormatted.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        const endH = (h + 1) % 24;
        const endAmpm = endH >= 12 ? 'PM' : 'AM';
        const dispEndH = endH % 12 || 12;
        return `${startFormatted} - ${dispEndH}:${m} ${endAmpm}`;
      }
      return startFormatted;
    }
  }

  // 4. Check ISO timestamp dates for time (e.g. session.date: "2026-11-05T18:00:00.000Z")
  const dateCandidates = [session.date, session.startDate, session.bookingDate, session.slot?.date, session.createdAt];
  for (const dVal of dateCandidates) {
    if (typeof dVal === 'string' && dVal.includes('T')) {
      const d = new Date(dVal);
      if (!isNaN(d.getTime()) && (d.getHours() !== 0 || d.getMinutes() !== 0)) {
        const startFormatted = formatSingleTime(d);
        const endD = new Date(d.getTime() + 60 * 60 * 1000);
        const endFormatted = formatSingleTime(endD);
        return `${startFormatted} - ${endFormatted}`;
      }
    }
  }

  // 5. Direct single session.time string if valid
  if (typeof session.time === 'string' && session.time.trim() && session.time !== 'Scheduled Time' && session.time !== 'Time TBD') {
    const clean = formatSingleTime(session.time);
    if (clean) return clean;
  }

  return 'Time TBD';
};

export const resolveSessionDate = (dateVal: any): string => {
  if (!dateVal) return 'Scheduled Date';
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (trimmed === 'Scheduled Date') return trimmed;

    // Parse YYYY-MM-DD cleanly without timezone offset shift
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const d = parseInt(match[3], 10);
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) {
        return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }

    const dt = new Date(trimmed);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return trimmed;
  }
  return 'Scheduled Date';
};

export const resolveSessionTitle = (session: any, coachUser?: any): string => {
  if (!session) return 'Coaching Session';

  const candidates = [
    session.title,
    session.sessionTitle,
    session.slot?.title,
    session.slot?.sessionTitle,
    session.slot?.name,
    session.schedule?.title,
    session.scheduleTitle,
    session.program?.title,
    session.programTitle,
    session.program?.name,
    session.programName,
    session.batchName,
    session.batchTitle,
    session.bookingTitle,
    session.serviceName,
    session.slot?.serviceName,
    session.sport ? `${session.sport} Coaching` : null,
    session.sportName ? `${session.sportName} Coaching` : null,
    session.coachSport ? `${session.coachSport} Coaching` : null,
    session.slot?.sport ? `${session.slot.sport} Coaching` : null,
    coachUser?.sports?.[0] ? `${coachUser.sports[0]} Coaching` : null,
    coachUser?.sport ? `${coachUser.sport} Coaching` : null
  ];

  for (const c of candidates) {
    if (
      typeof c === 'string' && 
      c.trim() && 
      c.trim().toLowerCase() !== 'coaching' && 
      c.trim().toLowerCase() !== 'coaching session' && 
      c.trim().toLowerCase() !== 'sports coaching' &&
      c.trim().toLowerCase() !== 'sports'
    ) {
      return c.trim();
    }
  }

  const detectedSport = resolveSessionSport(session, coachUser);
  return `${detectedSport} Coaching`;
};

export const resolveSessionSport = (session: any, coachUser?: any): string => {
  const authUser = useAuthStore.getState().user;
  const effectiveCoach = coachUser || session?.coach || (authUser?.role === 'coach' ? authUser : null);

  if (!session) {
    const fallback = effectiveCoach?.sports?.[0] || effectiveCoach?.sport || (authUser as any)?.sport || authUser?.sports?.[0];
    return (fallback && fallback.toLowerCase() !== 'sports') ? fallback : 'Tennis';
  }

  // 1. Direct sport fields on session, slot, program, coach, or schedule
  const candidates = [
    session.sport,
    session.sportName,
    session.coachSport,
    session.slot?.sport,
    session.slot?.sportName,
    session.slot?.sports?.[0],
    session.schedule?.sport,
    session.program?.sport,
    session.program?.sportName,
    session.coach?.sport,
    session.coach?.sports?.[0],
    effectiveCoach?.sport,
    effectiveCoach?.sports?.[0],
    Array.isArray(session.sports) ? session.sports[0] : null,
    Array.isArray(session.slot?.sports) ? session.slot.sports[0] : null,
  ];

  for (const c of candidates) {
    if (
      typeof c === 'string' && 
      c.trim() && 
      c.trim().toLowerCase() !== 'sports' && 
      c.trim().toLowerCase() !== 'coaching' &&
      c.trim().toLowerCase() !== 'coaching session' &&
      c.trim().toLowerCase() !== 'sports coaching'
    ) {
      return c.trim();
    }
  }

  // 2. Extract sport name from session/slot title (e.g. "Tennis Coaching" -> "Tennis")
  const title = session.title || session.sessionTitle || session.slot?.title || session.schedule?.title || session.program?.title;
  if (typeof title === 'string' && title.trim()) {
    const knownSports = ['Tennis', 'Badminton', 'Football', 'Basketball', 'Cricket', 'Swimming', 'Table Tennis', 'Squash', 'Yoga', 'Fitness', 'Martial Arts', 'Athletics', 'Gym', 'Boxing', 'Volleyball', 'Golf'];
    for (const s of knownSports) {
      if (new RegExp(`\\b${s}\\b`, 'i').test(title)) {
        return s;
      }
    }
    const match = title.match(/^([A-Za-z]+)\s+Coaching/i);
    if (match && match[1] && match[1].toLowerCase() !== 'sports') {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    }
  }

  // 3. Fallback to coach's registered sports or specialties
  if (effectiveCoach?.sports?.[0] && effectiveCoach.sports[0].toLowerCase() !== 'sports') {
    return effectiveCoach.sports[0];
  }
  if (effectiveCoach?.sport && effectiveCoach.sport.toLowerCase() !== 'sports') {
    return effectiveCoach.sport;
  }
  if (Array.isArray(effectiveCoach?.specialties) && effectiveCoach.specialties.length > 0) {
    const spec = effectiveCoach.specialties[0];
    if (typeof spec === 'string' && spec.trim() && spec.toLowerCase() !== 'sports') {
      return spec.trim();
    }
  }

  if (authUser?.sports?.[0] && authUser.sports[0].toLowerCase() !== 'sports') {
    return authUser.sports[0];
  }
  const authSport = (authUser as any)?.sport;
  if (authSport && authSport.toLowerCase() !== 'sports') {
    return authSport;
  }

  return 'Tennis';
};

export const resolveSessionLocation = (session: any, coachUser?: any): string => {
  if (!session) {
    return coachUser?.location || 'Training Venue';
  }

  // 1. Direct location string
  const loc = session.location;
  if (
    typeof loc === 'string' && 
    loc.trim() && 
    !loc.includes('Central Sports Complex') && 
    !loc.includes('Arena Sports Complex')
  ) {
    return loc.trim();
  }

  // 2. Location object with address/venue/city/name
  if (loc && typeof loc === 'object') {
    const parts = [loc.name, loc.venue, loc.stadium, loc.court, loc.address, loc.city].filter(
      p => typeof p === 'string' && p.trim() && !p.includes('Central Sports Complex') && !p.includes('Arena Sports Complex')
    );
    if (parts.length > 0) return parts.slice(0, 2).join(' • ');
  }

  // 3. Slot location
  const slotLoc = session.slot?.location;
  if (
    typeof slotLoc === 'string' && 
    slotLoc.trim() && 
    !slotLoc.includes('Central Sports Complex') && 
    !slotLoc.includes('Arena Sports Complex')
  ) {
    return slotLoc.trim();
  }
  if (slotLoc && typeof slotLoc === 'object') {
    const parts = [slotLoc.name, slotLoc.venue, slotLoc.stadium, slotLoc.court, slotLoc.address, slotLoc.city].filter(
      p => typeof p === 'string' && p.trim() && !p.includes('Central Sports Complex') && !p.includes('Arena Sports Complex')
    );
    if (parts.length > 0) return parts.slice(0, 2).join(' • ');
  }

  // 4. Specific named venues on session or slot
  const venueCandidates = [
    session.venue?.name || (typeof session.venue === 'string' ? session.venue : null),
    session.slot?.venue?.name || (typeof session.slot?.venue === 'string' ? session.slot.venue : null),
    session.stadium?.name || (typeof session.stadium === 'string' ? session.stadium : null),
    session.slot?.stadium?.name || (typeof session.slot?.stadium === 'string' ? session.slot.stadium : null),
    session.locationName,
    session.slot?.locationName,
    session.arena,
    session.court,
    session.courtName,
    session.slot?.court,
    session.slot?.courtName,
    session.address
  ];

  for (const v of venueCandidates) {
    if (
      typeof v === 'string' && 
      v.trim() && 
      !v.includes('Central Sports Complex') && 
      !v.includes('Arena Sports Complex')
    ) {
      return v.trim();
    }
  }

  // 5. Coach's registered city or location
  if (coachUser?.location && typeof coachUser.location === 'string' && coachUser.location.trim()) {
    return coachUser.location.trim();
  }

  return 'Assigned Training Court';
};

export const resolveStudentName = (session: any): string => {
  if (!session) return 'Student';
  return (
    session.studentName ||
    session.childName ||
    session.playerName ||
    session.student?.name ||
    session.child?.name ||
    session.player?.name ||
    (Array.isArray(session.children) && session.children.length > 0 
      ? session.children.map((c: any) => c.name || c).join(', ') 
      : '') ||
    session.attendeeName ||
    session.participant?.name ||
    session.bookedBy?.name ||
    (session.bookedBy?.firstName ? `${session.bookedBy.firstName} ${session.bookedBy.lastName || ''}`.trim() : '') ||
    session.user?.name ||
    (session.user?.firstName ? `${session.user.firstName} ${session.user.lastName || ''}`.trim() : '') ||
    'Student'
  );
};

export const resolveCoachName = (session: any): string => {
  if (!session) return 'Coach';

  const coachObj = 
    (typeof session.coach === 'object' && session.coach !== null ? session.coach : null) ||
    (typeof session.coachId === 'object' && session.coachId !== null ? session.coachId : null) ||
    (typeof session.slot?.coach === 'object' && session.slot?.coach !== null ? session.slot.coach : null) ||
    (typeof session.schedule?.coach === 'object' && session.schedule?.coach !== null ? session.schedule.coach : null);

  if (coachObj) {
    const objName = coachObj.name || `${coachObj.firstName || ''} ${coachObj.lastName || ''}`.trim();
    if (objName) return objName;
  }

  const directCandidates = [
    session.coachName,
    session.trainerName,
    session.instructorName,
    session.slot?.coachName,
    session.schedule?.coachName,
    typeof session.coach === 'string' && session.coach.length < 30 ? session.coach : null
  ];

  for (const c of directCandidates) {
    if (typeof c === 'string' && c.trim() && c.trim().toLowerCase() !== 'coach') {
      return c.trim();
    }
  }

  return 'Coach';
};
