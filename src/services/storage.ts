import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Universal safe storage wrapper:
 * - Falls back to localStorage on web
 * - Avoids throwing exceptions if storage operations fail
 * - Sanitizes overly large JSON payloads to respect Android SecureStore 2048-byte limits
 */
export const safeStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (!key || typeof value !== 'string') return;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }

      let payload = value;
      // Android KeyStore / SharedPreferences limit is 2048 bytes
      if (Platform.OS === 'android' && payload.length > 2000) {
        try {
          const parsed = JSON.parse(payload);
          if (parsed && typeof parsed === 'object') {
            // Strip large base64 strings or non-critical bulky metadata
            if (typeof parsed.avatar === 'string' && parsed.avatar.length > 300) {
              delete parsed.avatar;
            }
            if (typeof parsed.idProof === 'string' && parsed.idProof.length > 300) {
              delete parsed.idProof;
            }
            if (Array.isArray(parsed.certificates)) {
              parsed.certificates = parsed.certificates.filter(
                (c: any) => typeof c === 'string' && c.length < 300 && !c.startsWith('data:')
              );
            }
            payload = JSON.stringify(parsed);
          }
        } catch (_) {
          payload = payload.slice(0, 2000);
        }
      }

      await SecureStore.setItemAsync(key, payload);
    } catch (err) {
      console.warn(`[safeStorage] setItem failed for key "${key}":`, err);
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (!key) return null;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.warn(`[safeStorage] getItem failed for key "${key}":`, err);
      return null;
    }
  },

  async deleteItem(key: string): Promise<void> {
    if (!key) return;
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.warn(`[safeStorage] deleteItem failed for key "${key}":`, err);
    }
  }
};
