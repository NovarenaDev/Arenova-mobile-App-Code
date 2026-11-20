import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ThemedModal, ThemedModalProps } from './ThemedModal';
import { ModalVariant } from '@/store/modalStore';

export interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success' | 'primary';
  iconName?: keyof typeof Ionicons.glyphMap;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  variant = 'danger',
  ...props
}) => {
  return (
    <ThemedModal
      {...props}
      variant={variant as ModalVariant}
    />
  );
};
