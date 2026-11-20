import { Linking } from 'react-native';
import { isRoutePermittedForRole, assertRoleNavigation, PLAYER_PARENT_ONLY_ROUTES, COACH_ONLY_ROUTES } from './roleSecurity';
import { showThemedModal } from '@/store';

export interface NormalizedBanner {
  id: string;
  title?: string;
  desc?: string;
  color: string;
  bgStyle?: { backgroundColor: string };
  icon?: string;
  route: string;
  buttonText?: string;
  imageUrl?: string;
  order?: number;
}

export const extractBannersList = (rawResponse: any): any[] => {
  if (!rawResponse) return [];
  if (Array.isArray(rawResponse)) return rawResponse;
  if (Array.isArray(rawResponse.banners)) return rawResponse.banners;
  if (Array.isArray(rawResponse.data)) return rawResponse.data;
  if (Array.isArray(rawResponse.data?.banners)) return rawResponse.data.banners;
  if (Array.isArray(rawResponse.data?.data)) return rawResponse.data.data;
  if (Array.isArray(rawResponse.items)) return rawResponse.items;
  return [];
};

export const normalizeBanners = (
  rawResponse: any, 
  defaultRoute: string,
  defaultBanners: NormalizedBanner[] = [],
  userRole?: string
): NormalizedBanner[] => {
  const list = extractBannersList(rawResponse);
  if (!Array.isArray(list) || list.length === 0) return defaultBanners;

  const validBanners = list.filter((b: any) => b && b.isActive !== false && b.status !== 'inactive');
  if (validBanners.length === 0) return defaultBanners;

  const mapped: NormalizedBanner[] = validBanners.map((b: any, idx: number) => {
    const rawImage = b.imageUrl || b.image || b.bannerUrl || b.photo || b.posterUrl || b.mediaUrl;
    let rawRoute = b.link || b.route || b.targetUrl || b.actionUrl || b.url || defaultRoute;
    const rawColor = b.color || b.backgroundColor || b.bg || (idx % 3 === 0 ? 'bg-primary' : idx % 3 === 1 ? 'bg-[#4B9C73]' : 'bg-[#0F2C59]');
    const isTailwindClass = typeof rawColor === 'string' && rawColor.startsWith('bg-');

    return {
      id: b._id || b.id || idx.toString(),
      title: b.title || b.name || b.heading || '',
      desc: b.description || b.desc || b.subtitle || b.text || '',
      color: isTailwindClass ? rawColor : 'bg-primary',
      bgStyle: !isTailwindClass && typeof rawColor === 'string' && (rawColor.startsWith('#') || rawColor.startsWith('rgb')) ? { backgroundColor: rawColor } : undefined,
      icon: b.icon || b.iconName,
      route: rawRoute,
      buttonText: b.buttonText || b.ctaText || b.cta || b.actionText || '',
      imageUrl: typeof rawImage === 'string' && rawImage.trim() ? rawImage.trim() : undefined,
      order: typeof b.order === 'number' ? b.order : (typeof b.priority === 'number' ? b.priority : idx)
    };
  });

  return mapped.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export const handleBannerNavigation = (
  banner: NormalizedBanner, 
  router: any, 
  userRole?: string
) => {
  if (!banner.route) return;

  const routeStr = banner.route.trim();

  // If coach clicks a banner that leads to player/parent features:
  if (userRole === 'coach') {
    const isForbidden = PLAYER_PARENT_ONLY_ROUTES.some(p => routeStr.toLowerCase().includes(p.toLowerCase()));
    if (isForbidden) {
      showThemedModal({
        title: 'Player & Parent Feature',
        message: 'This feature is designed for athletes and parents to book coaching sessions and explore venues. As a Coach, please manage your schedules, batches, and earnings from your Coach Dashboard.',
        variant: 'primary',
        iconName: 'information-circle-outline',
        confirmText: 'Got It'
      });
      return;
    }
  }

  // If athlete or parent clicks a coach-only section:
  if (userRole === 'individual' || userRole === 'player' || userRole === 'parent') {
    const isCoachRoute = COACH_ONLY_ROUTES.some(p => routeStr.toLowerCase().includes(p.toLowerCase()));
    if (isCoachRoute) {
      showThemedModal({
        title: 'Coach Only Section',
        message: 'This section is reserved for verified Arenova coaches to manage their training sessions and schedules.',
        variant: 'primary',
        iconName: 'fitness-outline',
        confirmText: 'Got It'
      });
      return;
    }
  }

  if (routeStr.startsWith('http://') || routeStr.startsWith('https://')) {
    Linking.openURL(routeStr).catch(() => null);
  } else {
    router.push(routeStr as any);
  }
};
