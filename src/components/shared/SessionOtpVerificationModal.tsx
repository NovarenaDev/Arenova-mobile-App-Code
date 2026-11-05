import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard,
  Text 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { api } from '@/services/api';

export interface SessionOtpModalProps {
  visible: boolean;
  onClose: () => void;
  session?: {
    id?: string;
    title?: string;
    sport?: string;
    date?: string;
    time?: string;
    location?: string;
    type?: 'individual' | 'group';
    studentName?: string;
  } | null;
  onSuccess?: (res?: any) => void;
}

export function SessionOtpVerificationModal({ visible, onClose, session, onSuccess }: SessionOtpModalProps) {
  const [otp, setOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [alreadyStartedNotice, setAlreadyStartedNotice] = useState(false);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      setIsSuccess(false);
      setAlreadyStartedNotice(false);
      setIsVerifying(false);
      setOtp('');
      setErrorMsg('');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setOtp('');
      setErrorMsg('');
      setIsSuccess(false);
      setAlreadyStartedNotice(false);
    }
  }, [visible, session]);

  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length < 4) {
      setErrorMsg('Please enter the complete 4-digit code.');
      return;
    }

    const sessionId = session?.id;
    if (!sessionId) {
      Alert.alert('Error', 'Missing session or booking reference.');
      return;
    }

    Keyboard.dismiss();
    setErrorMsg('');
    setIsVerifying(true);

    try {
      // Primary coach session start endpoint
      await api.put(`/coach-app/sessions/${sessionId}/start`, { otp: trimmedOtp });
      setIsVerifying(false);
      setIsSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      // Try fallback endpoint if PUT is not supported or 404
      if (err?.response?.status === 404) {
        try {
          await api.post(`/coach-app/sessions/${sessionId}/start`, { otp: trimmedOtp });
          setIsVerifying(false);
          setIsSuccess(true);
          setTimeout(() => {
            if (onSuccess) onSuccess();
            onClose();
          }, 1200);
          return;
        } catch (_) {
          // Fall through to error handler
        }
      }

      setIsVerifying(false);
      const serverMsg = 
        err?.response?.data?.message || 
        err?.response?.data?.error || 
        err?.message || 
        'Invalid attendance code or outside session start window (±15 min).';

      const lowerMsg = serverMsg.toLowerCase();
      if (
        lowerMsg.includes('already started') || 
        lowerMsg.includes('already active') || 
        lowerMsg.includes('already verified') ||
        lowerMsg.includes('session in progress') ||
        lowerMsg.includes('already ongoing') ||
        lowerMsg.includes('already begun')
      ) {
        setAlreadyStartedNotice(true);
        setIsSuccess(true);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1100);
        return;
      }

      setErrorMsg(serverMsg);
    }
  };

  const handleBoxPress = () => {
    inputRef.current?.focus();
  };

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="fade" 
      statusBarTranslucent 
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View 
          className="flex-1 justify-center items-center px-5" 
          style={{ backgroundColor: 'rgba(6, 19, 37, 0.72)' }}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
            className="w-full max-w-[390px] items-center justify-center"
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View 
                className="w-full bg-white rounded-[32px] p-6 shadow-2xl border border-gray-100"
                style={{ elevation: 24 }}
              >
                {/* Header */}
                <View className="flex-row items-center justify-between pb-4 border-b border-gray-100 mb-4">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-200/80 items-center justify-center mr-3">
                      <Ionicons name="key" size={22} color="#FF5100" />
                    </View>
                    <View className="flex-1">
                      <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold text-lg leading-5">
                        Start Session
                      </Typography>
                      <Typography variant="caption" color="muted" className="font-outfit text-xs mt-0.5">
                        Attendance Verification
                      </Typography>
                    </View>
                  </View>

                  <TouchableOpacity 
                    onPress={onClose} 
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
                  >
                    <Ionicons name="close" size={20} color="#0F2C59" />
                  </TouchableOpacity>
                </View>

                {isSuccess ? (
                  <View className="py-6 items-center justify-center">
                    <View className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 items-center justify-center mb-4">
                      <Ionicons name="checkmark-circle" size={54} color="#10B981" />
                    </View>
                    <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-xl mb-1 text-center">
                      {alreadyStartedNotice ? 'Session Already Active!' : 'Attendance Verified!'}
                    </Typography>
                    <Typography variant="body2" color="muted" align="center" className="font-outfit px-4 text-xs">
                      {alreadyStartedNotice 
                        ? 'This session is already in progress. Redirecting to your Current sessions tab...' 
                        : 'Session has officially started. Moving to your current session...'}
                    </Typography>
                  </View>
                ) : (
                  <View>
                    {/* Session Details Card */}
                    <View className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 mb-4">
                      <View className="flex-row items-center justify-between mb-1.5">
                        <View className="flex-row items-center flex-1 mr-2">
                          <Ionicons name="person-circle-outline" size={18} color="#0F2C59" style={{ marginRight: 6 }} />
                          <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold text-sm" numberOfLines={1}>
                            {session?.studentName || 'Registered Student'}
                          </Typography>
                        </View>
                        {session?.sport && (
                          <View className="bg-orange-100/70 border border-orange-200 px-2.5 py-0.5 rounded-full">
                            <Typography variant="caption" weight="bold" className="text-[#FF5100] text-[10px] font-outfit-bold">
                              {session.sport}
                            </Typography>
                          </View>
                        )}
                      </View>

                      <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={14} color="#64748B" style={{ marginRight: 4 }} />
                        <Typography variant="caption" color="muted" className="font-outfit text-xs">
                          {session?.date || 'Today'} {session?.time ? `• ${session.time}` : ''}
                        </Typography>
                      </View>
                    </View>

                    {/* Instruction */}
                    <Typography variant="caption" color="muted" align="center" className="font-outfit text-xs text-gray-500 mb-4 px-2 leading-4">
                      Ask the player or parent for the 4-digit code shown on their booking card to verify attendance.
                    </Typography>

                    {/* 4-Digit OTP Boxes (uses native styles to avoid CSS-interop className calculation on each keystroke) */}
                    <TouchableOpacity 
                      activeOpacity={0.9} 
                      onPress={handleBoxPress}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 16
                      }}
                    >
                      {[0, 1, 2, 3].map((index) => {
                        const digit = otp[index] || '';
                        const isFocusedBox = otp.length === index;
                        const isFilled = digit.length > 0;

                        return (
                          <View
                            key={index}
                            style={{
                              width: 56,
                              height: 64,
                              borderRadius: 16,
                              borderWidth: 2,
                              borderColor: isFocusedBox ? '#0F2C59' : isFilled ? '#0F2C59' : '#E2E8F0',
                              backgroundColor: isFocusedBox ? '#EFF6FF' : isFilled ? '#FFFFFF' : '#F8FAFC',
                              alignItems: 'center',
                              justifyContent: 'center',
                              elevation: isFocusedBox ? 2 : 0,
                              shadowColor: '#0F2C59',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: isFocusedBox ? 0.12 : 0,
                              shadowRadius: 4
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: 'Outfit_700Bold',
                                fontSize: 26,
                                fontWeight: '700',
                                color: isFilled ? '#0F2C59' : '#CBD5E1',
                                textAlign: 'center',
                                includeFontPadding: false
                              }}
                            >
                              {isFilled ? digit : '•'}
                            </Text>
                          </View>
                        );
                      })}
                    </TouchableOpacity>

                    {/* Hidden Native TextInput */}
                    <TextInput
                      ref={inputRef}
                      value={otp}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
                        setOtp(cleaned);
                        if (errorMsg) setErrorMsg('');
                      }}
                      keyboardType="number-pad"
                      maxLength={4}
                      style={{ position: 'absolute', opacity: 0.01, height: 1, width: 1 }}
                      caretHidden
                    />

                    {/* Error Banner */}
                    {errorMsg ? (
                      <View className="mb-4 bg-red-50 border border-red-200 rounded-xl p-2.5 flex-row items-center">
                        <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                        <Typography variant="caption" className="font-outfit text-red-600 flex-1 text-xs">
                          {errorMsg}
                        </Typography>
                      </View>
                    ) : (
                      <View className="h-2" />
                    )}

                    {/* Verify & Start Button */}
                    <Button
                      title={isVerifying ? 'Verifying Code...' : 'Verify & Start Session'}
                      onPress={handleVerifyOtp}
                      isLoading={isVerifying}
                      disabled={otp.length < 4 || isVerifying}
                      variant="primary"
                      className="w-full mb-2.5"
                    />

                    {/* Dismiss Button */}
                    <TouchableOpacity 
                      onPress={onClose}
                      disabled={isVerifying}
                      className="py-2 items-center justify-center"
                    >
                      <Typography variant="body2" color="muted" weight="bold" className="font-outfit-bold text-xs text-gray-400">
                        Dismiss
                      </Typography>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
