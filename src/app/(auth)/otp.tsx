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

  const verifyMutation = useMutation({
    mutationFn: async (firebaseIdToken: string) => {
      const endpoint = role === 'coach' ? '/auth/coach/verify-firebase' : '/auth/verify-firebase'; // Assuming similar for player
      const payload = {
        firebaseIdToken: firebaseIdToken
      };
      const response = await api.post(endpoint, payload);
      return response.data;
    },
    onSuccess: async (data) => {
      if (!data.token && !data.jwt && !data.access_token && !(data.data && data.data.token)) {
        alert("Debug: " + JSON.stringify(data));
      }
      
      const realToken = data.token || data.jwt || data.access_token || (data.data && data.data.token);
      // Save user session
      setToken(realToken);
      
      const userObj = data.user || data.data?.user;
      let resolvedStatus = 'active';

      if (role === 'coach') {
        try {
          // Fetch coach profile dynamically to verify accurate kyc status
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

      // Navigate based on flow
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

  const handleVerifyOTP = async () => {
    if (otp.length < 6 || !verificationId) return;
    
    try {
      setIsFirebaseLoading(true);
      // 1. Create Firebase credential
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      // 2. Sign in with credential
      const result = await signInWithCredential(auth, credential);
      // 3. Get Firebase ID Token
      const idToken = await result.user.getIdToken();
      setIsFirebaseLoading(false);
      
      // 4. Send token to our Node backend
      verifyMutation.mutate(idToken);
    } catch (err: any) {
      setIsFirebaseLoading(false);
      alert(err.message || 'Invalid OTP');
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

            <TouchableOpacity className="mt-6 self-center">
              <Typography variant="body2" color="primary" weight="semibold">
                Didn't receive the code? Resend
              </Typography>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
