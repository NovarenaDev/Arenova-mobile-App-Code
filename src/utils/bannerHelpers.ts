import { Linking, Alert } from 'react-native';
import { isRoutePermittedForRole, assertRoleNavigation } from './roleSecurity';

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

    // Strict role sanitization: purge cross-role routes at ingestion
    if (userRole && !isRoutePermittedForRole(rawRoute, userRole)) {
      rawRoute = '';
    }

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

  // Strict role navigation boundary assertion
  if (!assertRoleNavigation(routeStr, userRole)) {
    return;
  }

  if (routeStr.startsWith('http://') || routeStr.startsWith('https://')) {
    Linking.openURL(routeStr).catch(() => null);
  } else {
    router.push(routeStr as any);
  }
};
