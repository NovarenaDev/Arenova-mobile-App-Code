import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../store';

// We'll use a mocked base URL or environment variable later
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://arenova-backend-production-3192.up.railway.app/api';

export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TYbWhPnXGMgB0p';

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
    if (token) {
      token = token.trim();
      if (token.startsWith('Bearer ')) {
        config.headers.Authorization = token;
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
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
    
    // Handle 401 Unauthorized globally without crashing active React render tree
    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (originalRequest) originalRequest._retry = true;
      setTimeout(() => {
        useAuthStore.getState().logout();
      }, 0);
    }
    
    return Promise.reject(error);
  }
);
