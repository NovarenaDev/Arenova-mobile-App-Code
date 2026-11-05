import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes: cache data to prevent rapid refetch loops
      gcTime: 1000 * 60 * 10,   // 10 minutes cache lifetime
      refetchOnWindowFocus: false, // Prevent background refetches on screen focus
      refetchOnReconnect: false,
      retry: (failureCount, error: any) => {
        // Never auto-retry if the server rate-limited (429) or returned auth/client error
        const status = error?.response?.status;
        if (status === 429 || status === 400 || status === 401 || status === 403 || status === 404) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false, // Never retry mutations automatically (prevents duplicate orders/OTPs/payments)
    },
  },
});
