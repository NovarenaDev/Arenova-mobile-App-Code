import React from 'react';
import { View, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from './Typography';
import { useModalStore, ModalVariant, ThemedModalConfig } from '@/store/modalStore';

export interface ThemedModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ModalVariant;
  iconName?: keyof typeof Ionicons.glyphMap;
  isLoading?: boolean;
  dismissible?: boolean;
}

export const ThemedModal: React.FC<ThemedModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'OK',
  cancelText,
  variant = 'primary',
  iconName,
  isLoading = false,
  dismissible = true,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          badgeBg: '#FFF5F0',
          badgeBorder: '#FED7AA',
          iconColor: '#FF5100',
          cardBorder: 'rgba(255, 81, 0, 0.15)',
          confirmBg: '#FF5100',
          defaultIcon: 'information-circle-outline' as const,
        };
      case 'warning':
        return {
          badgeBg: '#FFFBEB',
          badgeBorder: '#FDE68A',
          iconColor: '#F59E0B',
          cardBorder: 'rgba(245, 158, 11, 0.15)',
          confirmBg: '#FF5100',
          defaultIcon: 'alert-circle-outline' as const,
        };
      case 'danger':
        return {
          badgeBg: '#FEF2F2',
          badgeBorder: '#FEE2E2',
          iconColor: '#EF4444',
          cardBorder: 'rgba(239, 68, 68, 0.15)',
          confirmBg: '#EF4444',
          defaultIcon: 'close-circle-outline' as const,
        };
      case 'info':
        return {
          badgeBg: '#F0F4F8',
          badgeBorder: '#D9E2EC',
          iconColor: '#0F2C59',
          cardBorder: 'rgba(15, 44, 89, 0.15)',
          confirmBg: '#0F2C59',
          defaultIcon: 'shield-outline' as const,
        };
      case 'success':
        return {
          badgeBg: '#ECFDF5',
          badgeBorder: '#A7F3D0',
          iconColor: '#10B981',
          cardBorder: 'rgba(16, 185, 129, 0.15)',
          confirmBg: '#10B981',
          defaultIcon: 'checkmark-circle-outline' as const,
        };
      default:
        return {
          badgeBg: '#FFF5F0',
          badgeBorder: '#FED7AA',
          iconColor: '#FF5100',
          cardBorder: 'rgba(255, 81, 0, 0.15)',
          confirmBg: '#FF5100',
          defaultIcon: 'information-circle-outline' as const,
        };
    }
  };

  const styles = getVariantStyles();
  const activeIcon = iconName || styles.defaultIcon;
  const isConfirmMode = Boolean(cancelText);

  const handleConfirmPress = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dismissible) onClose();
      }}
    >
      <View 
        style={{ 
          flex: 1, 
          backgroundColor: 'rgba(15, 44, 89, 0.70)', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: 24 
        }}
      >
        <View 
          style={{ 
            backgroundColor: '#FFFFFF', 
            borderRadius: 28, 
            padding: 24, 
            width: '100%', 
            maxWidth: 360, 
            alignItems: 'center',
            shadowColor: '#0F2C59', 
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.25, 
            shadowRadius: 24, 
            elevation: 12,
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
              borderWidth: 1.5,
              borderColor: styles.badgeBorder
            }}
          >
            <Ionicons name={activeIcon} size={32} color={styles.iconColor} />
          </View>

          {/* Title */}
          <Typography 
            variant="h3" 
            color="secondary" 
            weight="bold" 
            className="font-outfit-bold text-xl text-center mb-2.5 text-[#0F2C59]"
          >
            {title}
          </Typography>

          {/* Description */}
          <Typography 
            variant="body2" 
            color="muted" 
            className="font-outfit text-center text-sm leading-5 mb-6 text-gray-600 px-1"
          >
            {message}
          </Typography>

          {/* Action Buttons */}
          {isConfirmMode ? (
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
                <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold text-sm text-[#0F2C59]">
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
                onPress={handleConfirmPress}
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
          ) : (
            <TouchableOpacity
              style={{ 
                width: '100%', 
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
              onPress={handleConfirmPress}
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
          )}
        </View>
      </View>
    </Modal>
  );
};

export const ThemedModalRoot: React.FC = () => {
  const { isOpen, config, hide } = useModalStore();

  if (!isOpen || !config) return null;

  const handleClose = () => {
    if (config.onCancel) {
      config.onCancel();
    }
    hide();
  };

  const handleConfirm = () => {
    if (config.onConfirm) {
      config.onConfirm();
    }
    hide();
  };

  return (
    <ThemedModal
      visible={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={config.title}
      message={config.message}
      confirmText={config.confirmText}
      cancelText={config.cancelText}
      variant={config.variant}
      iconName={config.iconName}
      dismissible={config.dismissible !== false}
    />
  );
};
