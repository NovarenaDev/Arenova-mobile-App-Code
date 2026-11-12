import { Alert } from 'react-native';

export const PLAYER_PARENT_ONLY_ROUTES = [
  '/(individual)',
  '/(parent)',
  '/individual',
  '/parent',
  '/search',
  '/venues',
  '/venue-details',
  '/select-sport',
  '/select-date',
  '/select-player',
  '/payment',
  '/booking-confirmed',
  '/coach-profile',
  '/my-tournaments'
];

export const COACH_ONLY_ROUTES = [
  '/(coach)',
  '/coach-dashboard',
  '/schedule',
  '/wallet'
];

export const isRoutePermittedForRole = (routeStr: string, role?: string): boolean => {
  if (!routeStr) return false;
  const clean = routeStr.trim().toLowerCase();

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return true;
  }

  if (role === 'coach') {
    const isPlayerRoute = PLAYER_PARENT_ONLY_ROUTES.some(p => clean.includes(p.toLowerCase()));
    return !isPlayerRoute;
  }

  if (role === 'individual' || role === 'player' || role === 'parent') {
    const isCoachRoute = COACH_ONLY_ROUTES.some(p => clean.includes(p.toLowerCase()));
    return !isCoachRoute;
  }

  return true;
};

export const assertRoleNavigation = (targetRoute: string, role?: string): boolean => {
  if (!targetRoute) return false;

  const clean = targetRoute.trim().toLowerCase();

  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return true;
  }

  if (role === 'coach') {
    const isForbidden = PLAYER_PARENT_ONLY_ROUTES.some(p => clean.includes(p.toLowerCase()));
    if (isForbidden) {
      Alert.alert(
        'Access Denied (Role Boundary)',
        'You are logged in with a Coach account. Coaches cannot book other coaches or access player/parent booking screens.'
      );
      return false;
    }
  }

  if (role === 'individual' || role === 'player' || role === 'parent') {
    const isForbidden = COACH_ONLY_ROUTES.some(p => clean.includes(p.toLowerCase()));
    if (isForbidden) {
      Alert.alert(
        'Access Denied (Role Boundary)',
        'This portal is strictly reserved for registered coaching partners.'
      );
      return false;
    }
  }

  return true;
};
