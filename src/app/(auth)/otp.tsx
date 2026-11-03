import React, { useState } from 'react';
import { View, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Typography, Button, TextInput } from '@/components/ui';
import { useAuthStore } from '@/store';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/services/api';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '@/services/firebase';

const formatPhoneForApi = (rawPhone: string): string => {
  const digits = (rawPhone || '').trim().replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
};

export default function OTPScreen() {
  const insets = useSafeAreaInsets();
  const { role, action, name, phone, email, idProof, verificationId } = useLocalSearchParams<{ 
    role: string; 
    action: string; 
    name?: string;
    phone: string;
    email?: string;
    idProof?: string;
    verificationId?: string;
  }>();

  const setUser = useAuthStore(state => state.setUser);
  const setToken = useAuthStore(state => state.setToken);

  const [otp, setOtp] = useState('');

  const [isFirebaseLoading, setIsFirebaseLoading] = useState(false);

  const verifyMutation = useMutation<any, any, string | void>({
    mutationFn: async (firebaseIdToken?: string | void) => {
      let response;
      if (action === 'verify-email' || (!phone && !!email)) {
        const endpoint = role === 'coach' ? '/auth/coach/verify-email-otp' : '/auth/verify-email-otp';
        response = await api.post(endpoint, {
          email: (email || '').trim().toLowerCase(),
          otp: otp.trim()
        });
      } else {
        const endpoint = role === 'coach' ? '/auth/coach/verify-otp' : '/auth/verify-otp';
        const cleanPhone = formatPhoneForApi(phone || '');
        const cleanOtp = otp.trim();
        const purpose = action === 'register' ? 'register' : 'login';

        const payload: any = {
          phone: String(cleanPhone),
          otp: String(cleanOtp),
          purpose
        };

        if (action === 'register' && role !== 'coach') {
          const nameParts = (name || '').trim().split(/\s+/);
          payload.firstName = nameParts[0] || 'User';
          payload.lastName = nameParts.slice(1).join(' ') || '.';
          payload.role = role === 'individual' ? 'player' : 'parent';
        }

        response = await api.post(endpoint, payload);
      }
      return response.data;
    },
    onSuccess: async (data) => {
      if (!data.token && !data.jwt && !data.access_token && !(data.data && data.data.token)) {
        alert("Debug: " + JSON.stringify(data));
      }
      
      const realToken = data.token || data.jwt || data.access_token || (data.data && data.data.token);
      setToken(realToken);
      
      const userObj = data.user || data.data?.user;
      let resolvedStatus = 'active';

      if (role === 'coach') {
        try {
          const profileRes = await api.get('/coaches/my/profile');
          const profileObj = profileRes.data?.data || profileRes.data;
          const kycStatus = profileObj?.kyc || profileObj?.profile?.kyc || profileObj?.status || userObj?.kyc || 'pending';
          resolvedStatus = kycStatus === 'approved' ? 'active' : kycStatus;
        } catch (e) {
          const userKyc = userObj?.kyc || userObj?.status || 'pending';
          resolvedStatus = userKyc === 'approved' ? 'active' : userKyc;
        }
      } else {
        resolvedStatus = userObj?.status || 'active';
      }

      const userPhone = userObj?.phone || userObj?.phoneNumber || phone || '0000000000';
      setUser({ 
        id: userObj?._id || userObj?.id || '1', 
        name: userObj?.name || name || '',
        phone: userPhone, 
        email: email || '',
        role: (role as any) || 'individual', 
        isRegistered: true,
        idProof: idProof || '',
        status: resolvedStatus,
        isEmailVerified: userObj?.emailVerified || userObj?.isEmailVerified || false
      });

      if (action === 'register') {
        if (role === 'coach') {
          router.push({ pathname: '/(coach)/onboarding', params: { role, phone } });
        } else {
          router.replace(role === 'parent' ? '/(parent)/(parent-tabs)/parent-dashboard' : '/(individual)/(individual-tabs)/individual-dashboard');
        }
      } else {
        const userStatus = data.user?.status || data.data?.user?.status;
        let targetRoute = '';
        if (role === 'coach') {
          if (userStatus === 'active') {
            targetRoute = '/(coach)/(coach-tabs)/coach-dashboard';
          } else {
            targetRoute = '/(coach)/onboarding?fromLogin=true';
          }
        } else if (role === 'parent') {
          targetRoute = '/(parent)/(parent-tabs)/parent-dashboard';
        } else {
          targetRoute = '/(individual)/(individual-tabs)/individual-dashboard';
        }
        router.replace(targetRoute as any);
      }
    },
    onError: (error: any) => {
      alert(error?.response?.data?.message || 'Verification failed');
    }
  });

  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    setIsResending(true);
    try {
      if (action === 'verify-email' || (!phone && !!email)) {
        const endpoint = role === 'coach' ? '/auth/coach/resend-email-otp' : '/auth/send-email-otp';
        await api.post(endpoint, {
          email: (email || '').trim().toLowerCase()
        });
      } else {
        const endpoint = role === 'coach' ? '/auth/coach/send-otp' : '/auth/send-otp';
        const cleanPhone = formatPhoneForApi(phone || '');
        const purpose = action === 'register' ? 'register' : 'login';
        await api.post(endpoint, {
          phone: String(cleanPhone),
          purpose
        });
      }
      alert('Verification code resent successfully.');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 6) return;
    
    if (!verificationId) {
      verifyMutation.mutate();
      return;
    }

    try {
      setIsFirebaseLoading(true);
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const result = await signInWithCredential(auth, credential);
      const idToken = await result.user.getIdToken();
      setIsFirebaseLoading(false);
      
      verifyMutation.mutate(idToken);
    } catch (err: any) {
      setIsFirebaseLoading(false);
      verifyMutation.mutate();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingBottom: Math.max(insets.bottom + 32, 48) }} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          
          <TouchableOpacity onPress={() => {
            try {
              router.back();
            } catch (e) {
              router.replace('/(auth)/role-selection');
            }
          }} className="mb-8">
            <Ionicons name="arrow-back" size={28} color="#0F2C59" />
          </TouchableOpacity>

          <View className="mb-10">
            <Typography variant="h2" color="secondary" className="mb-2 font-bold">
              OTP Verification
            </Typography>
            <Typography variant="body1" color="muted">
              Please enter the 6-digit verification code sent to +{phone || 'your number'}.
            </Typography>
          </View>

          <View className="flex-1">
            {/* Simple OTP Input */}
            <TextInput
              placeholder="Enter 6-digit OTP"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              className="text-center text-2xl tracking-widest font-bold h-16 bg-gray-50 rounded-xl"
            />
            
            <View className="mt-8">
              <Button 
                title="Verify & Proceed" 
                onPress={handleVerifyOTP} 
                isLoading={verifyMutation.isPending || isFirebaseLoading}
                disabled={otp.length < 6 || verifyMutation.isPending || isFirebaseLoading}
              />
            </View>

            <TouchableOpacity 
              className="mt-6 self-center"
              onPress={handleResend}
              disabled={isResending}
            >
              <Typography variant="body2" color="primary" weight="semibold">
                {isResending ? 'Resending code...' : "Didn't receive the code? Resend"}
              </Typography>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
