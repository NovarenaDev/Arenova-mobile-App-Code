import { create } from 'zustand';
import { safeStorage } from '@/services/storage';
import { queryClient } from '@/services/queryClient';

export type UserRole = 'coach' | 'parent' | 'individual' | 'player' | null;

export interface User {
  id: string;
  name?: string;
  phone: string;
  email?: string;
  role: UserRole;
  isRegistered: boolean; // false if only OTP verified but profile not complete
  password?: string;
  hasPassword?: boolean;
  sports?: string[];
  location?: string;
  achievements?: string;
  experience?: string;
  description?: string;
  certificates?: string[];
  status?: string;
  isEmailVerified?: boolean;
  skills?: string;
  idProof?: string;
  avatar?: string;
}

export interface Child {
  _id: string;
  id?: string;
  name: string;
  age: number;
  sport?: string;
  school?: string;
  avatar?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  children: Child[];
  isLoading: boolean;
  selectedLocationId: string | null;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setChildren: (children: Child[]) => void;
  addChild: (child: Child) => void;
  updateChild: (id: string, updatedChild: Partial<Child>) => void;
  removeChild: (id: string) => void;
  setSelectedLocationId: (id: string | null) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  logout: () => void;
  hydrateAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  children: [],
  isLoading: true,
  selectedLocationId: null,
  soundEnabled: true,
  vibrationEnabled: true,

  setToken: (token) => {
    const cleanToken = token ? token.trim() : null;
    if (cleanToken) {
      safeStorage.setItem('auth_token', cleanToken).catch(console.error);
    } else {
      safeStorage.deleteItem('auth_token').catch(console.error);
    }
    set({ token: cleanToken });
  },

  setUser: (user) => {
    if (user) {
      safeStorage.setItem('auth_user', JSON.stringify(user)).catch(console.error);
    } else {
      safeStorage.deleteItem('auth_user').catch(console.error);
    }
    set({ user });
  },

  setChildren: (children) => {
    safeStorage.setItem('parent_children', JSON.stringify(children || [])).catch(console.error);
    set({ children: children || [] });
  },

  addChild: (child) => {
    const current = get().children;
    const exists = current.some(c => c._id === child._id || (c.name && child.name && c.name.toLowerCase() === child.name.toLowerCase()));
    const updated = exists 
      ? current.map(c => (c._id === child._id || (c.name && child.name && c.name.toLowerCase() === child.name.toLowerCase())) ? child : c)
      : [...current, child];
    safeStorage.setItem('parent_children', JSON.stringify(updated)).catch(console.error);
    set({ children: updated });
  },

  updateChild: (id, updatedData) => {
    const current = get().children;
    const updated = current.map(c => (c._id === id || c.id === id) ? { ...c, ...updatedData } : c);
    safeStorage.setItem('parent_children', JSON.stringify(updated)).catch(console.error);
    set({ children: updated });
  },

  removeChild: (id) => {
    const current = get().children;
    const updated = current.filter(c => c._id !== id && c.id !== id);
    safeStorage.setItem('parent_children', JSON.stringify(updated)).catch(console.error);
    set({ children: updated });
  },

  setSelectedLocationId: (id) => {
    if (id) {
      safeStorage.setItem('selected_location_id', id).catch(console.error);
    } else {
      safeStorage.deleteItem('selected_location_id').catch(console.error);
    }
    set({ selectedLocationId: id });
  },

  setSoundEnabled: (enabled) => {
    safeStorage.setItem('pref_sound', enabled ? 'true' : 'false').catch(console.error);
    set({ soundEnabled: enabled });
  },

  setVibrationEnabled: (enabled) => {
    safeStorage.setItem('pref_vibration', enabled ? 'true' : 'false').catch(console.error);
    set({ vibrationEnabled: enabled });
  },

  logout: () => {
    safeStorage.deleteItem('auth_token').catch(console.error);
    safeStorage.deleteItem('auth_user').catch(console.error);
    safeStorage.deleteItem('parent_children').catch(console.error);
    safeStorage.deleteItem('selected_location_id').catch(console.error);
    safeStorage.deleteItem('pref_sound').catch(console.error);
    safeStorage.deleteItem('pref_vibration').catch(console.error);
    queryClient.clear();
    set({ token: null, user: null, children: [], selectedLocationId: null, soundEnabled: true, vibrationEnabled: true });
  },

  hydrateAuth: async () => {
    try {
      const [token, userStr, childrenStr, selectedLocationId, soundVal, vibrationVal] = await Promise.all([
        safeStorage.getItem('auth_token'),
        safeStorage.getItem('auth_user'),
        safeStorage.getItem('parent_children'),
        safeStorage.getItem('selected_location_id'),
        safeStorage.getItem('pref_sound'),
        safeStorage.getItem('pref_vibration'),
      ]);

      let parsedUser: User | null = null;
      if (userStr) {
        try {
          parsedUser = JSON.parse(userStr);
        } catch (e) {
          console.warn('[authStore] Failed to parse stored auth_user:', e);
        }
      }

      let parsedChildren: Child[] = [];
      if (childrenStr) {
        try {
          const parsed = JSON.parse(childrenStr);
          parsedChildren = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.warn('[authStore] Failed to parse stored parent_children:', e);
        }
      }

      const validToken = token && token.trim().length > 0 ? token.trim() : null;

      set({
        token: validToken,
        user: parsedUser,
        children: parsedChildren,
        selectedLocationId: selectedLocationId || null,
        soundEnabled: soundVal !== 'false',
        vibrationEnabled: vibrationVal !== 'false',
        isLoading: false
      });
    } catch (e) {
      console.error('[authStore] Failed to hydrate auth state:', e);
      set({ isLoading: false });
    }
  },
}));
