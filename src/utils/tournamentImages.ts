const DYNAMIC_SPORT_IMAGES: Record<string, string> = {
  football: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&auto=format&fit=crop&q=80',
  soccer: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&auto=format&fit=crop&q=80',
  badminton: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80',
  swimming: 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=800&auto=format&fit=crop&q=80',
  tennis: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&auto=format&fit=crop&q=80',
  yoga: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop&q=80',
  fitness: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
  basketball: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=80',
  cricket: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&auto=format&fit=crop&q=80',
  athletics: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80',
  gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1517649763962-0c623266010b?w=800&auto=format&fit=crop&q=80',
};

export const getTournamentBanner = (t: any): string => {
  if (!t) return DYNAMIC_SPORT_IMAGES.default;

  const rawUrl = t.bannerUrl || t.imageUrl || t.image || t.banner || t.coverImage || t.posterUrl || t.photoUrl;
  if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim() !== '') {
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return rawUrl;
    }
    const backendOrigin = 'http://16.112.182.86';
    return `${backendOrigin}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  }

  const sportName = (t.sport || t.sportName || t.name || t.title || '').toLowerCase();
  for (const key of Object.keys(DYNAMIC_SPORT_IMAGES)) {
    if (key !== 'default' && sportName.includes(key)) {
      return DYNAMIC_SPORT_IMAGES[key];
    }
  }

  return DYNAMIC_SPORT_IMAGES.default;
};
