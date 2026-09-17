import React from 'react';
import { View, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from './Typography';

export interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  iconName?: keyof typeof Ionicons.glyphMap;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  iconName,
  isLoading = false,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          badgeBg: '#FEF2F2',
          badgeBorder: '#FEE2E2',
          iconColor: '#EF4444',
          cardBorder: 'rgba(239, 68, 68, 0.15)',
          confirmBg: '#EF4444',
          defaultIcon: 'trash-outline' as const,
        };
      case 'warning':
        return {
          badgeBg: '#FFF7ED',
          badgeBorder: '#FFEDD5',
          iconColor: '#F97316',
          cardBorder: 'rgba(249, 115, 22, 0.15)',
          confirmBg: '#FF5100',
          defaultIcon: 'alert-circle-outline' as const,
        };
      case 'info':
        return {
          badgeBg: '#F0F9FF',
          badgeBorder: '#E0F2FE',
          iconColor: '#0F2C59',
          cardBorder: 'rgba(15, 44, 89, 0.15)',
          confirmBg: '#0F2C59',
          defaultIcon: 'information-circle-outline' as const,
        };
      case 'success':
        return {
          badgeBg: '#ECFDF5',
          badgeBorder: '#D1FAE5',
          iconColor: '#10B981',
          cardBorder: 'rgba(16, 185, 129, 0.15)',
          confirmBg: '#10B981',
          defaultIcon: 'checkmark-circle-outline' as const,
        };
    }
  };

  const styles = getVariantStyles();
  const activeIcon = iconName || styles.defaultIcon;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(15, 44, 89, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View 
          style={{ 
            backgroundColor: '#FFFFFF', 
            borderRadius: 28, 
            padding: 24, 
            width: '100%', 
            maxWidth: 360, 
            alignItems: 'center',
            shadowColor: '#000000', 
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25, 
            shadowRadius: 20, 
            elevation: 10,
            borderWidth: 1,
            borderColor: styles.cardBorder
          }}
        >
          {/* Icon Badge */}
          <View 
            style={{ 
              width: 64, 
              height: 64, 
              borderRadius: 32, 
              backgroundColor: styles.badgeBg, 
              alignItems: 'center', 
              justifyContent: 'center', 
              marginBottom: 16,
              borderWidth: 1,
              borderColor: styles.badgeBorder
            }}
          >
            <Ionicons name={activeIcon} size={30} color={styles.iconColor} />
          </View>

          {/* Title & Description */}
          <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold text-xl text-center mb-2">
            {title}
          </Typography>

          <Typography variant="body2" color="muted" className="font-outfit text-center text-sm leading-5 mb-6 text-gray-500">
            {message}
          </Typography>

          {/* Action Buttons */}
          <View className="flex-row w-full gap-3">
            <TouchableOpacity
              style={{ 
                flex: 1, 
                paddingVertical: 14, 
                borderRadius: 16, 
                backgroundColor: '#F3F4F6', 
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#E5E7EB'
              }}
              activeOpacity={0.8}
              onPress={onClose}
              disabled={isLoading}
            >
              <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold text-sm">
                {cancelText}
              </Typography>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ 
                flex: 1.2, 
                paddingVertical: 14, 
                borderRadius: 16, 
                backgroundColor: styles.confirmBg, 
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: styles.confirmBg,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
                elevation: 4
              }}
              activeOpacity={0.8}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Typography variant="subtitle2" style={{ color: '#FFFFFF' }} weight="bold" className="font-outfit-bold text-sm">
                  {confirmText}
                </Typography>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
