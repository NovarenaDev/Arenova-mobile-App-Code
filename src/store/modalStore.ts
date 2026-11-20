import { create } from 'zustand';
import { Ionicons } from '@expo/vector-icons';

export type ModalVariant = 'primary' | 'warning' | 'danger' | 'info' | 'success';

export interface ThemedModalConfig {
  title: string;
  message: string;
  variant?: ModalVariant;
  iconName?: keyof typeof Ionicons.glyphMap;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  dismissible?: boolean;
}

interface ModalStoreState {
  isOpen: boolean;
  config: ThemedModalConfig | null;
  show: (config: ThemedModalConfig) => void;
  hide: () => void;
}

export const useModalStore = create<ModalStoreState>((set) => ({
  isOpen: false,
  config: null,
  show: (config) => set({ isOpen: true, config }),
  hide: () => set({ isOpen: false, config: null }),
}));

export const showThemedModal = (config: ThemedModalConfig) => {
  useModalStore.getState().show(config);
};

export const hideThemedModal = () => {
  useModalStore.getState().hide();
};
