import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { queryClient } from '@/services/queryClient';

export type UserRole = 'coach' | 'parent' | 'individual' | 'player' | null;

interface User {
  id: string;
  name?: string;
  phone: string;
  email?: string;
  role: UserRole;
  isRegistered: boolean; // false if only OTP verified but profile not complete
  password?: string;
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
  setToken: (token: string) => void;
  setUser: (user: User) => void;
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
    SecureStore.setItemAsync('auth_token', token).catch(console.error);
    set({ token });
  },

  setUser: (user) => {
    SecureStore.setItemAsync('auth_user', JSON.stringify(user)).catch(console.error);
    set({ user });
  },

  setChildren: (children) => {
    SecureStore.setItemAsync('parent_children', JSON.stringify(children)).catch(console.error);
    set({ children });
  },

  addChild: (child) => {
    const current = get().children;
    const exists = current.some(c => c._id === child._id || c.name.toLowerCase() === child.name.toLowerCase());
    const updated = exists 
      ? current.map(c => (c._id === child._id || c.name.toLowerCase() === child.name.toLowerCase()) ? child : c)
      : [...current, child];
    SecureStore.setItemAsync('parent_children', JSON.stringify(updated)).catch(console.error);
    set({ children: updated });
  },

  updateChild: (id, updatedData) => {
    const current = get().children;
    const updated = current.map(c => (c._id === id || c.id === id) ? { ...c, ...updatedData } : c);
    SecureStore.setItemAsync('parent_children', JSON.stringify(updated)).catch(console.error);
    set({ children: updated });
  },

  removeChild: (id) => {
    const current = get().children;
    const updated = current.filter(c => c._id !== id && c.id !== id);
    SecureStore.setItemAsync('parent_children', JSON.stringify(updated)).catch(console.error);
    set({ children: updated });
  },

  setSelectedLocationId: (id) => {
    if (id) {
      SecureStore.setItemAsync('selected_location_id', id).catch(console.error);
    } else {
      SecureStore.deleteItemAsync('selected_location_id').catch(console.error);
    }
    set({ selectedLocationId: id });
  },

  setSoundEnabled: (enabled) => {
    SecureStore.setItemAsync('pref_sound', enabled ? 'true' : 'false').catch(console.error);
    set({ soundEnabled: enabled });
  },

  setVibrationEnabled: (enabled) => {
    SecureStore.setItemAsync('pref_vibration', enabled ? 'true' : 'false').catch(console.error);
    set({ vibrationEnabled: enabled });
  },

  logout: () => {
    SecureStore.deleteItemAsync('auth_token').catch(console.error);
    SecureStore.deleteItemAsync('auth_user').catch(console.error);
    SecureStore.deleteItemAsync('parent_children').catch(console.error);
    SecureStore.deleteItemAsync('selected_location_id').catch(console.error);
    SecureStore.deleteItemAsync('pref_sound').catch(console.error);
    SecureStore.deleteItemAsync('pref_vibration').catch(console.error);
    queryClient.clear();
    set({ token: null, user: null, children: [], selectedLocationId: null, soundEnabled: true, vibrationEnabled: true });
  },

  hydrateAuth: async () => {
    try {
      const [token, userStr, childrenStr, selectedLocationId, soundVal, vibrationVal] = await Promise.all([
        SecureStore.getItemAsync('auth_token'),
        SecureStore.getItemAsync('auth_user'),
        SecureStore.getItemAsync('parent_children'),
        SecureStore.getItemAsync('selected_location_id'),
        SecureStore.getItemAsync('pref_sound'),
        SecureStore.getItemAsync('pref_vibration'),
      ]);

      set({
        token,
        user: userStr ? JSON.parse(userStr) : null,
        children: childrenStr ? JSON.parse(childrenStr) : [],
        selectedLocationId,
        soundEnabled: soundVal !== 'false',
        vibrationEnabled: vibrationVal !== 'false',
        isLoading: false
      });
    } catch (e) {
      console.error('Failed to hydrate auth state:', e);
      set({ isLoading: false });
    }
  },
}));
