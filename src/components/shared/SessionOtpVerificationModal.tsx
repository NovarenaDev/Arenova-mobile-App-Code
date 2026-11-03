import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
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

  useEffect(() => {
    if (visible) {
      setIsSuccess(false);
      setIsVerifying(false);
      setOtp('');
      setErrorMsg('');
    }
  }, [visible, session]);

  const handleVerifyOtp = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length < 4) {
      setErrorMsg('Please enter a valid 4-digit attendance code.');
      return;
    }

    const sessionId = session?.id;
    if (!sessionId) {
      Alert.alert('Error', 'Missing session or booking reference.');
      return;
    }

    setErrorMsg('');
    setIsVerifying(true);

    try {
      await api.put(`/coach-app/sessions/${sessionId}/start`, { otp: trimmedOtp });
      setIsVerifying(false);
      setIsSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setIsVerifying(false);
      const serverMsg = err?.response?.data?.message || err?.message || 'Invalid attendance code or outside start window (±15 min of scheduled start).';
      setErrorMsg(serverMsg);
      Alert.alert('Verification Failed', serverMsg);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end z-50">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
        <View className="bg-white rounded-t-[32px] px-6 pt-4 pb-8 max-h-[90%] shadow-2xl border-t border-gray-100">
          
          <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

          <View className="flex-row justify-between items-center pb-3 border-b border-gray-100 mb-4">
            <View>
              <Typography variant="h3" color="secondary" weight="bold" className="text-xl font-outfit-bold">
                Session OTP Verification
              </Typography>
              <Typography variant="caption" color="muted" className="font-outfit text-xs">
                {session?.sport || 'Coaching Session'} • {session?.date || 'Today'} {session?.time ? `• ${session.time}` : ''}
              </Typography>
            </View>
            <TouchableOpacity onPress={onClose} className="w-9 h-9 rounded-full bg-gray-100 justify-center items-center">
              <Ionicons name="close" size={20} color="#0F2C59" />
            </TouchableOpacity>
          </View>

          {isSuccess ? (
            <View className="py-10 items-center justify-center">
              <View className="w-20 h-20 rounded-full bg-emerald-100 items-center justify-center mb-4">
                <Ionicons name="checkmark-circle" size={54} color="#10B981" />
              </View>
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold mb-1">
                OTP Verified!
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="font-outfit px-4">
                Session has been started successfully.
              </Typography>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} className="mb-2">
              <View className="bg-orange-50 p-4 rounded-2xl mb-4 border border-orange-200 flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mr-3">
                  <Ionicons name="key-outline" size={22} color="#FF5100" />
                </View>
                <View className="flex-1">
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                    {session?.studentName ? `Participant: ${session.studentName}` : 'Session Attendance'}
                  </Typography>
                  <Typography variant="caption" color="muted" className="font-outfit text-xs">
                    Ask the player or parent for their 4-digit private attendance code. One code starts the group session.
                  </Typography>
                </View>
              </View>

              <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold">
                Enter 4-Digit Attendance Code
              </Typography>

              <TextInput
                className="bg-gray-100 rounded-2xl px-4 py-3.5 text-center text-2xl font-bold tracking-[12px] text-[#0F2C59] border border-gray-200 mb-2"
                placeholder="••••"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={4}
                value={otp}
                onChangeText={(text) => {
                  setOtp(text);
                  if (errorMsg) setErrorMsg('');
                }}
              />

              {errorMsg ? (
                <Typography variant="caption" className="text-red-500 mb-3 ml-1 font-outfit">
                  {errorMsg}
                </Typography>
              ) : (
                <View className="mb-4" />
              )}

              <Button
                title={isVerifying ? 'Verifying...' : 'Verify & Start Session'}
                onPress={handleVerifyOtp}
                isLoading={isVerifying}
                disabled={otp.length < 4 || isVerifying}
                variant="primary"
              />
            </ScrollView>
          )}

        </View>
      </View>
    </Modal>
  );
}
