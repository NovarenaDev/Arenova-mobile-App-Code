import { Alert } from 'react-native';
import { showThemedModal, ModalVariant } from '@/store/modalStore';
import { Ionicons } from '@expo/vector-icons';

type IoniconsGlyph = keyof typeof Ionicons.glyphMap;

let isBridgeInitialized = false;

export const setupModernAlerts = () => {
  if (isBridgeInitialized) return;
  isBridgeInitialized = true;

  Alert.alert = (
    title: string,
    message?: string,
    buttons?: Array<{
      text?: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>,
    options?: any
  ) => {
    const titleLower = (title || '').toLowerCase();
    const msgLower = (message || '').toLowerCase();

    // Determine variant & icon
    let variant: ModalVariant = 'primary';
    let iconName: IoniconsGlyph = 'information-circle-outline';

    if (
      titleLower.includes('error') ||
      titleLower.includes('failed') ||
      titleLower.includes('denied') ||
      titleLower.includes('invalid') ||
      titleLower.includes('cannot') ||
      titleLower.includes('issue') ||
      msgLower.includes('failed') ||
      msgLower.includes('error')
    ) {
      variant = 'danger';
      iconName = 'alert-circle-outline';
    } else if (
      titleLower.includes('success') ||
      titleLower.includes('completed') ||
      titleLower.includes('done') ||
      titleLower.includes('verified') ||
      titleLower.includes('approved') ||
      titleLower.includes('added') ||
      titleLower.includes('updated') ||
      titleLower.includes('congratulations') ||
      titleLower.includes('caught up') ||
      msgLower.includes('successfully') ||
      msgLower.includes('has been added')
    ) {
      variant = 'success';
      iconName = 'checkmark-circle-outline';
    } else if (
      titleLower.includes('cancel') ||
      titleLower.includes('warning') ||
      titleLower.includes('pending') ||
      titleLower.includes('exit') ||
      titleLower.includes('delete') ||
      titleLower.includes('remove') ||
      titleLower.includes('cleared')
    ) {
      variant = titleLower.includes('delete') || titleLower.includes('remove') ? 'danger' : 'warning';
      iconName = titleLower.includes('delete') || titleLower.includes('remove') ? 'trash-outline' : 'alert-circle-outline';
    }

    // Two or more buttons -> confirmation modal
    if (buttons && buttons.length >= 2) {
      const cancelBtn = buttons.find((b) => b.style === 'cancel') || buttons[0];
      const confirmBtn = buttons.find((b) => b !== cancelBtn) || buttons[1];

      if (confirmBtn?.style === 'destructive' || titleLower.includes('delete') || titleLower.includes('remove')) {
        variant = 'danger';
        iconName = 'trash-outline';
      }

      showThemedModal({
        title: title || 'Confirmation',
        message: message || '',
        variant,
        iconName,
        cancelText: cancelBtn?.text || 'Cancel',
        confirmText: confirmBtn?.text || 'Confirm',
        onCancel: cancelBtn?.onPress,
        onConfirm: confirmBtn?.onPress,
      });
      return;
    }

    // Single button or notice
    const singleBtn = buttons && buttons.length > 0 ? buttons[0] : undefined;

    showThemedModal({
      title: title || 'Notice',
      message: message || '',
      variant,
      iconName,
      confirmText: singleBtn?.text || 'OK',
      onConfirm: singleBtn?.onPress,
    });
  };
};
