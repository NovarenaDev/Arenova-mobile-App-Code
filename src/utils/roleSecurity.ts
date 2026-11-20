export const PLAYER_PARENT_ONLY_ROUTES = [
  '/(individual)',
  '/(parent)',
  '/individual',
  '/parent',
  'individual',
  'parent',
  '/search',
  'search',
  '/venues',
  'venues',
  '/venue-details',
  'venue-details',
  '/select-sport',
  'select-sport',
  '/select-date',
  'select-date',
  '/select-player',
  'select-player',
  '/payment',
  'payment',
  '/booking-confirmed',
  'booking-confirmed',
  '/coach-profile',
  'coach-profile',
  '/my-tournaments',
  'my-tournaments',
  '/tournaments',
  'tournaments',
  '/tournament-details',
  'tournament-details',
  '/family',
  'family'
];

export const COACH_ONLY_ROUTES = [
  '/(coach)',
  '/coach-dashboard',
  'coach-dashboard',
  '/schedule',
  'schedule',
  '/wallet',
  'wallet',
  '/locations',
  'locations',
  '/onboarding',
  'onboarding'
];

export const isRoutePermittedForRole = (routeStr: string, role?: string): boolean => {
  if (!routeStr) return false;
  const clean = routeStr.trim().toLowerCase();

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return true;
  }

  // Remove leading/trailing slashes, hash, and query params for robust matching
  const normalized = clean.replace(/^[/#]+/, '').split('?')[0].trim();

  if (role === 'coach') {
    // If it explicitly belongs to coach section, it is permitted
    const isCoachSection = COACH_ONLY_ROUTES.some(c => {
      const normC = c.toLowerCase().replace(/^[/#]+/, '');
      return normalized === normC || normalized.startsWith(normC + '/') || clean.includes(c.toLowerCase());
    });
    if (isCoachSection) return true;

    // Check if it belongs to athlete or parent features
    const isPlayerRoute = PLAYER_PARENT_ONLY_ROUTES.some(p => {
      const normP = p.toLowerCase().replace(/^[/#]+/, '');
      return normalized === normP || normalized.startsWith(normP + '/') || clean.includes(p.toLowerCase());
    });
    return !isPlayerRoute;
  }

  if (role === 'individual' || role === 'player' || role === 'parent') {
    const isCoachRoute = COACH_ONLY_ROUTES.some(c => {
      const normC = c.toLowerCase().replace(/^[/#]+/, '');
      return normalized === normC || normalized.startsWith(normC + '/') || clean.includes(c.toLowerCase());
    });
    return !isCoachRoute;
  }

  return true;
};

export const assertRoleNavigation = (targetRoute: string, role?: string): boolean => {
  return isRoutePermittedForRole(targetRoute, role);
};
