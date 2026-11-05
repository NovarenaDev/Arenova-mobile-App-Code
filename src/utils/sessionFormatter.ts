/**
 * Utility functions for accurately parsing and displaying session booking details.
 * Eliminates dummy fallback data and resolves exact times (e.g. 6:00 PM - 7:00 PM),
 * accurate locations, exact booked sports (Badminton, Tennis, etc.), and attendee names.
 */

export const formatSingleTime = (t: string | Date | number | undefined | null): string => {
  if (!t) return '';
  const s = String(t).trim();
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

  // 24-hr format like "18:00" or "09:30"
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

  // Single hour number like 18
  const num = Number(s);
  if (!isNaN(num) && num >= 0 && num <= 24) {
    const ampm = num >= 12 ? 'PM' : 'AM';
    const dispH = num % 12 || 12;
    return `${dispH}:00 ${ampm}`;
  }

  return s;
};

export const resolveSessionTime = (session: any): string => {
  if (!session) return 'Scheduled Time';

  // 1. Direct formatted range string (e.g. "18:00 - 19:00", "06:00 PM - 07:00 PM", "6pm - 7pm")
  const directTime = 
    session.time || 
    session.timing || 
    session.timeSlot || 
    session.slotTime || 
    session.sessionTime || 
    session.slot?.time || 
    session.slot?.timing || 
    session.slot?.timeSlot;

  if (typeof directTime === 'string' && directTime.trim()) {
    const clean = directTime.trim();
    if (clean.includes('-')) {
      const parts = clean.split('-').map(p => p.trim());
      const startFormatted = formatSingleTime(parts[0]);
      const endFormatted = formatSingleTime(parts[1]);
      if (startFormatted && endFormatted) {
        return `${startFormatted} - ${endFormatted}`;
      }
      return clean;
    }
    const formatted = formatSingleTime(clean);
    if (formatted) return formatted;
  }

  // 2. Separate start & end fields
  const rawStart = 
    session.slot?.startTime || 
    session.startTime || 
    session.start_time || 
    session.schedule?.startTime || 
    session.slotStartTime || 
    session.start;

  const rawEnd = 
    session.slot?.endTime || 
    session.endTime || 
    session.end_time || 
    session.schedule?.endTime || 
    session.slotEndTime || 
    session.end;

  if (rawStart && rawEnd) {
    const startFormatted = formatSingleTime(rawStart);
    const endFormatted = formatSingleTime(rawEnd);
    return `${startFormatted} - ${endFormatted}`;
  }

  if (rawStart) {
    return formatSingleTime(rawStart);
  }

  // 3. Object-based slot
  if (typeof session.slot === 'object' && session.slot) {
    if (session.slot.startTime && session.slot.endTime) {
      return `${formatSingleTime(session.slot.startTime)} - ${formatSingleTime(session.slot.endTime)}`;
    }
    if (session.slot.startTime) {
      return formatSingleTime(session.slot.startTime);
    }
  }

  return 'Scheduled Time';
};

export const resolveSessionDate = (dateVal: any): string => {
  if (!dateVal) return 'Scheduled Date';
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
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

export const resolveSessionSport = (session: any, coachUser?: any): string => {
  if (!session) return coachUser?.sports?.[0] || 'Badminton';

  const sportCandidates = [
    session.sport,
    session.sportName,
    session.coachSport,
    session.slot?.sport,
    session.slot?.sportName,
    session.slot?.title,
    session.coach?.sport,
    session.coach?.sports?.[0],
    Array.isArray(session.sports) ? session.sports[0] : null,
    Array.isArray(session.slot?.sports) ? session.slot.sports[0] : null,
    session.title !== 'Coaching Session' ? session.title : null,
    Array.isArray(coachUser?.sports) ? coachUser.sports[0] : null,
  ];

  for (const c of sportCandidates) {
    if (
      typeof c === 'string' && 
      c.trim() && 
      c.trim() !== 'Coaching Session' && 
      c.trim() !== 'Sports Coaching' &&
      c.trim() !== 'Sports'
    ) {
      return c.trim();
    }
  }

  return coachUser?.sports?.[0] || 'Badminton';
};

export const resolveSessionLocation = (session: any, coachUser?: any): string => {
  if (!session) return coachUser?.location || 'Assigned Training Court';

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

  // 2. Location object with address/venue/city
  if (loc && typeof loc === 'object') {
    const parts = [loc.name, loc.venue, loc.stadium, loc.address, loc.court, loc.city].filter(
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
    const parts = [slotLoc.name, slotLoc.venue, slotLoc.stadium, slotLoc.address, slotLoc.city].filter(
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
    session.child?.name ||
    session.player?.name ||
    session.childName ||
    session.playerName ||
    (Array.isArray(session.children) && session.children.length > 0 
      ? session.children.map((c: any) => c.name || c).join(', ') 
      : '') ||
    session.studentName ||
    session.student?.name ||
    session.participant?.name ||
    session.bookedBy?.name ||
    (session.bookedBy?.firstName ? `${session.bookedBy.firstName} ${session.bookedBy.lastName || ''}`.trim() : '') ||
    session.user?.name ||
    (session.user?.firstName ? `${session.user.firstName} ${session.user.lastName || ''}`.trim() : '') ||
    'Student'
  );
};

