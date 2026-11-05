import axios from 'axios';
import { useAuthStore } from '../store';
import { safeStorage } from './storage';

// Default base URL pointing to live HTTPS API domain
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.getarenova.com/api';

export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_ToWiCACQpuVBCX';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    let token = useAuthStore.getState().token;
    
    // Fallback: If memory hasn't hydrated yet, read token directly from safeStorage
    if (!token) {
      try {
        const storedToken = await safeStorage.getItem('auth_token');
        if (storedToken && storedToken.trim().length > 0) {
          token = storedToken.trim();
          useAuthStore.setState({ token });
        }
      } catch (_) {
        // ignore
      }
    }

    if (token) {
      const cleanToken = token.trim();
      if (cleanToken.startsWith('Bearer ')) {
        config.headers.Authorization = cleanToken;
      } else {
        config.headers.Authorization = `Bearer ${cleanToken}`;
      }
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = (originalRequest?.url || '').toString();

    // Endpoints where a 401 should NEVER trigger global session logout
    const isAuthRoute = url.includes('/auth/');
    const isPublicOrOptional = 
      url.includes('/banners') || 
      url.includes('/options') || 
      url.includes('/public') ||
      url.includes('/coaches/my/profile') ||
      url.includes('/coach-app/status');

    const hadAuthHeader = !!originalRequest?.headers?.Authorization;

    // Only handle true expired/invalid token on authenticated protected routes
    if (
      status === 401 && 
      !originalRequest?._retry && 
      !isAuthRoute && 
      !isPublicOrOptional && 
      hadAuthHeader
    ) {
      if (originalRequest) originalRequest._retry = true;
      const currentToken = useAuthStore.getState().token;
      if (currentToken) {
        console.warn(`[API Interceptor] 401 Unauthorized on protected endpoint: ${url}. Logging out session.`);
        setTimeout(() => {
          useAuthStore.getState().logout();
        }, 100);
      }
    }
    
    return Promise.reject(error);
  }
);
