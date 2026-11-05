import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useAuthStore } from '@/store';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/services/api';

const formatPhoneForApi = (rawPhone: string): string => {
  const digits = rawPhone.trim().replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
};

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { role, phone: paramPhone } = useLocalSearchParams<{ role: string; phone?: string }>();
  const [authMode, setAuthMode] = useState<'email' | 'phone'>('email');
  
  const [phoneNumber, setPhoneNumber] = useState(paramPhone || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [screenError, setScreenError] = useState<string | null>(null);

  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [isPhoneSending, setIsPhoneSending] = useState(false);
  const [isPhoneVerifying, setIsPhoneVerifying] = useState(false);
  const [screenSuccess, setScreenSuccess] = useState<string | null>(null);

  // Forgot Password State
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [isSendingForgotOtp, setIsSendingForgotOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const sanitizeErrorMessage = (err: any): string => {
    let message = '';
    if (err && typeof err === 'object') {
      if (err.response?.data) {
        const data = err.response.data;
        message = typeof data.message === 'string' ? data.message : 
                  (Array.isArray(data.message) ? data.message[0] : 
                  (data.error || ''));
      }
      if (!message) {
        message = err.message || '';
      }
    } else if (typeof err === 'string') {
      message = err;
    }

    if (!message) return 'An unexpected error occurred. Please try again.';

    if (message.toLowerCase().includes('not found') || 
        message.toLowerCase().includes('no account') || 
        message.toLowerCase().includes('not registered') || 
        message.toLowerCase().includes('user does not exist') ||
        message.toLowerCase().includes('coach not found') ||
        message.toLowerCase().includes('no coach found') ||
        message.toLowerCase().includes('no user found')) {
      return role === 'coach'
        ? 'This mobile number has no registered coach account. Please register first.'
        : 'This mobile number has no registered account. Please register first.';
    }
    if (message.toLowerCase().includes('auth/invalid-credential') || 
        message.toLowerCase().includes('auth/user-not-found') || 
        message.toLowerCase().includes('invalid credential') || 
        message.toLowerCase().includes('user-not-found') ||
        message.toLowerCase().includes('incorrect') ||
        message.toLowerCase().includes('invalid email or password')) {
      return 'Incorrect email or password. Please verify your credentials and try again.';
    }
    if (message.toLowerCase().includes('auth/invalid-email') || message.toLowerCase().includes('invalid-email')) {
      return 'The email address is invalid. Please enter a correct email.';
    }
    if (message.includes('auth/wrong-password') || message.includes('wrong-password')) {
      return 'Incorrect password. Please try again.';
    }
    if (message.includes('auth/email-already-in-use') || message.includes('email-already-in-use')) {
      return 'This email address is already in use by another account.';
    }
    if (message.includes('auth/weak-password') || message.includes('weak-password')) {
      return 'The password is too weak. Please use a stronger password.';
    }
    if (message.includes('auth/network-request-failed')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    if (message.toLowerCase().includes('too many') || message.toLowerCase().includes('rate limit') || err?.response?.status === 429) {
      return 'Too many requests sent in a short time. Please wait a few minutes before trying again.';
    }
    let clean = message.replace(/^Firebase:\s*/i, '');
    clean = clean.replace(/^Error:\s*/i, '');
    clean = clean.replace(/\(auth\/[^)]+\)\.?/g, '');
    return clean.trim();
  };
  
  const [isLoading, setIsLoading] = useState(false);
  
  const setToken = useAuthStore(state => state.setToken);
  const setUser = useAuthStore(state => state.setUser);

  const resolveUserRole = (rawRole?: string): 'parent' | 'individual' | 'coach' => {
    if (role === 'coach' || rawRole === 'coach') return 'coach';
    if (role === 'parent' || rawRole === 'parent') return 'parent';
    if (role === 'individual' || rawRole === 'individual' || rawRole === 'player') return 'individual';
    return rawRole === 'parent' ? 'parent' : (role as any) || 'parent';
  };

  const processSuccessfulLogin = async (data: any, identifier: string) => {
    const realToken = data.token || data.jwt || data.access_token || (data.data && data.data.token);
    if (realToken) {
      setToken(realToken);
    }
    const userObj = data.user || data.data?.user || data.coach || data.data?.coach || data.data;
    const finalRole = resolveUserRole(userObj?.role || role);
    let resolvedStatus = 'active';
    let profileObj: any = null;
    let statusObj: any = null;

    if (finalRole === 'coach') {
      try {
        const [profileRes, statusRes] = await Promise.allSettled([
          api.get('/coaches/my/profile', {
            headers: realToken ? { Authorization: `Bearer ${realToken}` } : undefined
          }),
          api.get('/coach-app/status', {
            headers: realToken ? { Authorization: `Bearer ${realToken}` } : undefined
          })
        ]);

        if (profileRes.status === 'fulfilled') {
          profileObj = profileRes.value.data?.data || profileRes.value.data;
        }
        if (statusRes.status === 'fulfilled') {
          statusObj = statusRes.value.data?.data || statusRes.value.data;
        }

        const kycStatus = (
          statusObj?.kyc || 
          statusObj?.status || 
          profileObj?.kyc || 
          profileObj?.profile?.kyc || 
          userObj?.kyc || 
          userObj?.status || 
          ''
        ).toString().toLowerCase();

        const screenName = (statusObj?.screen || '').toString().toLowerCase();

        if (kycStatus === 'approved' || screenName === 'dashboard' || kycStatus === 'active') {
          resolvedStatus = 'active';
        } else if (kycStatus === 'under_review' || screenName === 'under_review') {
          resolvedStatus = 'under_review';
        } else if (kycStatus === 'rejected' || screenName === 'rejected') {
          resolvedStatus = 'rejected';
        } else {
          resolvedStatus = 'pending';
        }
      } catch (e) {
        resolvedStatus = 'pending';
      }
    } else {
      resolvedStatus = userObj?.status || 'active';
    }

    const coachLocation = profileObj?.profile?.address?.city || 
                          (typeof profileObj?.address === 'string' ? profileObj.address : profileObj?.address?.city) || 
                          profileObj?.location || 
                          profileObj?.city || 
                          userObj?.location || 
                          userObj?.city || '';

    const coachUserId = data?.data?._id || data?._id || profileObj?._id || profileObj?.id || userObj?._id || userObj?.id || '1';

    setUser({
      id: coachUserId,
      name: profileObj?.name || userObj?.name || `${userObj?.firstName || ''} ${userObj?.lastName || ''}`.trim() || userObj?.email || identifier,
      phone: profileObj?.phone || profileObj?.phoneNumber || userObj?.phone || userObj?.phoneNumber || phoneNumber || '',
      email: profileObj?.email || userObj?.email || email || '',
      role: finalRole,
      status: resolvedStatus,
      isRegistered: true,
      hasPassword: true,
      location: coachLocation,
      sports: profileObj?.sports || profileObj?.profile?.sports || userObj?.sports || [],
      experience: profileObj?.experience ? String(profileObj.experience) : (userObj?.experience ? String(userObj.experience) : ''),
      description: profileObj?.bio || profileObj?.description || profileObj?.profile?.description || userObj?.description || '',
      avatar: profileObj?.avatar || profileObj?.profile?.avatar || userObj?.avatar || '',
    });

    if (finalRole === 'coach') {
      if (resolvedStatus === 'active') {
        router.replace('/(coach)/(coach-tabs)/coach-dashboard');
      } else {
        router.replace('/(coach)/onboarding');
      }
    } else if (finalRole === 'parent') {
      router.replace('/(parent)/(parent-tabs)/parent-dashboard');
    } else {
      router.replace('/(individual)/(individual-tabs)/individual-dashboard');
    }
  };

  const directLoginMutation = useMutation({
    mutationFn: async () => {
      const cleanInput = email.trim();
      const isPhoneLike = /^[0-9+]{10,15}$/.test(cleanInput);

      if (role === 'coach') {
        const loginPayload: any = { password };
        if (isPhoneLike) {
          const formatted = formatPhoneForApi(cleanInput);
          loginPayload.phone = formatted;
          loginPayload.phoneNumber = formatted;
          loginPayload.email = cleanInput;
        } else {
          loginPayload.email = cleanInput.toLowerCase();
        }
        const response = await api.post('/auth/coach/login', loginPayload);
        return response.data;
      } else {
        const loginPayload: any = { password };
        if (isPhoneLike) {
          const formatted = formatPhoneForApi(cleanInput);
          loginPayload.phone = formatted;
          loginPayload.phoneNumber = formatted;
          loginPayload.email = cleanInput;
        } else {
          loginPayload.email = cleanInput.toLowerCase();
        }

        const response = await api.post('/auth/login', loginPayload);
        return response.data;
      }
    },
    onSuccess: async (data) => {
      await processSuccessfulLogin(data, email.trim().toLowerCase());
      setIsLoading(false);
    },
    onError: async (error: any) => {
      setIsLoading(false);
      setScreenError(sanitizeErrorMessage(error));
    }
  });

  const handleSendForgotPasswordOtp = async () => {
    const cleanForgotEmail = forgotEmail.trim().toLowerCase();
    if (!cleanForgotEmail || !validateEmail(cleanForgotEmail)) {
      setForgotError('Please enter a valid registered email address.');
      return;
    }
    setForgotError(null);
    setForgotSuccess(null);
    setIsSendingForgotOtp(true);
    try {
      const res = await api.post('/auth/forgot-password', {
        email: cleanForgotEmail
      });
      setIsSendingForgotOtp(false);
      setForgotStep(2);
      setForgotSuccess(res.data?.message || `Password reset code sent to ${cleanForgotEmail}.`);
    } catch (err: any) {
      setIsSendingForgotOtp(false);
      const msg = err?.response?.data?.message || err?.message || 'Failed to send password reset code. Please check your email.';
      setForgotError(msg);
    }
  };

  const handleResetPassword = async () => {
    const cleanForgotEmail = forgotEmail.trim().toLowerCase();
    const cleanOtp = forgotOtp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setForgotError('Please enter the 6-digit verification code.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setForgotError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('New password and confirmation do not match.');
      return;
    }

    setForgotError(null);
    setForgotSuccess(null);
    setIsResettingPassword(true);

    try {
      const res = await api.post('/auth/reset-password', {
        email: cleanForgotEmail,
        otp: cleanOtp,
        newPassword
      });
      setIsResettingPassword(false);
      const successMsg = res.data?.message || 'Password has been reset successfully. You can now log in with your new password.';
      Alert.alert('Password Reset Success', successMsg);
      setShowForgotPasswordModal(false);
      setForgotStep(1);
      setForgotOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
      setEmail(cleanForgotEmail);
      setScreenSuccess(successMsg);
    } catch (err: any) {
      setIsResettingPassword(false);
      const msg = err?.response?.data?.message || err?.message || 'Failed to reset password. Please verify the code.';
      setForgotError(msg);
    }
  };

  const handleSendPhoneOtp = async () => {
    const cleanPhone = formatPhoneForApi(phoneNumber);
    if (!cleanPhone || cleanPhone.length < 10) {
      setScreenError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setScreenError(null);
    setScreenSuccess(null);
    setIsPhoneSending(true);

    const endpoint = role === 'coach' ? '/auth/coach/send-otp' : '/auth/send-otp';

    try {
      const response = await api.post(endpoint, {
        phone: String(cleanPhone),
        purpose: 'login'
      });

      if ((response.status === 200 || response.status === 201) && response.data?.success !== false) {
        setIsPhoneSending(false);
        setPhoneOtpSent(true);
        setScreenSuccess(`Verification code sent to +91 ${cleanPhone}. Please enter the 6-digit OTP below.`);
      } else {
        setIsPhoneSending(false);
        setScreenError(response.data?.message || 'Failed to send OTP. Please try again.');
      }
    } catch (sendErr: any) {
      setIsPhoneSending(false);
      const status = sendErr?.response?.status;
      const data = sendErr?.response?.data;
      const backendMessage = data?.message || data?.error;

      if (status === 404) {
        setScreenError(role === 'coach'
          ? 'This mobile number is not registered as a coach yet. Please register your account first.'
          : 'This mobile number is not registered yet. Please register your account first.');
      } else if (status === 429) {
        setScreenError(backendMessage || 'Too many OTP requests from this number or device. Please wait a few minutes before trying again.');
      } else if (status === 403 || status === 401) {
        setScreenError(backendMessage || 'Account access restricted. Please check your account role or contact support.');
      } else {
        setScreenError(sanitizeErrorMessage(sendErr));
      }
    }
  };

  const handleVerifyPhoneOtp = async () => {
    const cleanPhone = formatPhoneForApi(phoneNumber);
    const cleanOtp = phoneOtp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setScreenError('Please enter the 6-digit verification code.');
      return;
    }
    setScreenError(null);
    setScreenSuccess(null);
    setIsPhoneVerifying(true);

    try {
      const endpoint = role === 'coach' ? '/auth/coach/verify-otp' : '/auth/verify-otp';
      const res = await api.post(endpoint, {
        phone: String(cleanPhone),
        otp: String(cleanOtp),
        purpose: 'login'
      });

      await processSuccessfulLogin(res.data, cleanPhone);
      setIsPhoneVerifying(false);
    } catch (err: any) {
      setIsPhoneVerifying(false);
      const status = err?.response?.status;
      const data = err?.response?.data;
      const backendMessage = data?.message || data?.error;

      if (status === 404) {
        setScreenError(role === 'coach'
          ? 'This mobile number is not registered as a coach yet. Please register your account first.'
          : 'This mobile number is not registered yet. Please register your account first.');
      } else if (status === 429) {
        setScreenError(backendMessage || 'Too many OTP verification attempts. Please wait a few minutes before trying again.');
      } else if (status === 403 || status === 401) {
        setScreenError(backendMessage || 'Account access restricted. Please contact support.');
      } else {
        setScreenError(sanitizeErrorMessage(err?.response?.data?.message || err?.message || 'Invalid or expired OTP. Please try again.'));
      }
    }
  };

  const validateEmail = (text: string) => {
    const reg = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w\w+)+$/;
    return reg.test(text.trim());
  };

  const validateIdentifier = (text: string) => {
    const clean = text.trim();
    if (!clean) return false;
    const isEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w\w+)+$/.test(clean);
    const isPhone = /^[0-9+]{10,14}$/.test(clean.replace(/\s+/g, ''));
    return isEmail || isPhone;
  };

  const validateField = (field: string, val: string) => {
    let err = '';
    if (field === 'email') {
      if (!val.trim()) {
        err = 'Email or mobile number is required';
      } else if (!validateIdentifier(val)) {
        err = 'Please enter a valid email or 10-digit mobile number';
      }
    } else if (field === 'password') {
      if (!val) {
        err = 'Password is required';
      } else if (val.length < 6) {
        err = 'Password must be at least 6 characters';
      }
    }

    setErrors(prev => {
      const next = { ...prev };
      if (err) {
        next[field] = err;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const handleEmailLogin = async () => {
    const newErrors: Record<string, string> = {};
    const cleanIdentifier = email.trim();
    if (!cleanIdentifier) {
      newErrors.email = 'Email or mobile number is required';
    } else if (!validateIdentifier(cleanIdentifier)) {
      newErrors.email = 'Please enter a valid email or 10-digit mobile number';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    setScreenError(null);
    setScreenSuccess(null);
    setIsLoading(true);
    directLoginMutation.mutate();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="px-6 py-4 z-10">
          <TouchableOpacity onPress={() => {
            try {
              router.back();
            } catch (e) {
              router.replace('/(auth)/role-selection');
            }
          }} className="p-2 -ml-2 w-12">
            <Ionicons name="arrow-back" size={28} color="#0F2C59" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          className="flex-1 px-6 pt-4" 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 60, 80) }}
        >
          
          <View className="mb-8 items-center">
            <Typography variant="h1" color="secondary" className="mb-2 font-bold text-center font-outfit-bold">
              {role === 'parent' ? 'Parent Portal Login' : (role === 'individual' ? 'Athlete Login' : 'Login to Arenova')}
            </Typography>
            <Typography variant="body1" color="muted" className="text-center font-outfit">
              {role === 'parent' 
                ? 'Access child profiles and manage session bookings.' 
                : (role === 'individual' 
                  ? 'Track your training progress and book coach sessions.' 
                  : 'Enter your credentials to access your coach account.')}
            </Typography>
          </View>

          {screenError && (
            <View className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm animate-fade-in">
              <View className="flex-row items-start">
                <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5 mt-0.5" />
                <View className="flex-1">
                  <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-red-800">
                    Authentication Notice
                  </Typography>
                  <Typography variant="caption" className="font-outfit text-red-600 mt-0.5">
                    {screenError}
                  </Typography>
                </View>
                <TouchableOpacity onPress={() => setScreenError(null)} className="p-1 -mr-1 -mt-1">
                  <Ionicons name="close" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {(screenError.toLowerCase().includes('register') ||
                screenError.toLowerCase().includes('no account') ||
                screenError.toLowerCase().includes('not found') ||
                screenError.toLowerCase().includes('not registered') ||
                screenError.toLowerCase().includes('does not exist')) && (
                <TouchableOpacity
                  onPress={() => router.push({ 
                    pathname: '/(auth)/register', 
                    params: { 
                      role, 
                      phone: phoneNumber.trim() || undefined 
                    } 
                  })}
                  activeOpacity={0.85}
                  className="mt-3 py-2.5 px-4 bg-[#FF5100] rounded-xl flex-row items-center justify-center shadow-sm"
                >
                  <Typography variant="caption" weight="bold" className="text-white font-outfit-bold mr-1.5">
                    {role === 'coach' ? 'Register as Coach Now' : (role === 'parent' ? 'Register as Parent Now' : 'Register as Athlete Now')}
                  </Typography>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {screenSuccess && (
            <View className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex-row items-start shadow-sm">
              <Ionicons name="checkmark-circle" size={20} color="#10B981" className="mr-2.5 mt-0.5" />
              <View className="flex-1">
                <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-emerald-800">
                  Verification Code Sent
                </Typography>
                <Typography variant="caption" className="font-outfit text-emerald-600 mt-0.5">
                  {screenSuccess}
                </Typography>
              </View>
              <TouchableOpacity onPress={() => setScreenSuccess(null)} className="p-1 -mr-1 -mt-1">
                <Ionicons name="close" size={16} color="#10B981" />
              </TouchableOpacity>
            </View>
          )}

          {/* Toggle Button */}
          <View className="flex-row bg-gray-200 rounded-full p-1 mb-8">
            <TouchableOpacity 
              onPress={() => {
                setAuthMode('email');
                setPhoneOtpSent(false);
                setScreenError(null);
                setScreenSuccess(null);
              }} 
              className="flex-1 py-3 rounded-full items-center"
              style={authMode === 'email' ? {
                backgroundColor: 'white',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 1,
                elevation: 1
              } : {}}
            >
              <Typography variant="subtitle2" color={authMode === 'email' ? 'secondary' : 'muted'} weight="bold" className="font-outfit-bold">Password Login</Typography>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                setAuthMode('phone');
                setScreenError(null);
                setScreenSuccess(null);
              }} 
              className="flex-1 py-3 rounded-full items-center"
              style={authMode === 'phone' ? {
                backgroundColor: 'white',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 1,
                elevation: 1
              } : {}}
            >
              <Typography variant="subtitle2" color={authMode === 'phone' ? 'secondary' : 'muted'} weight="bold" className="font-outfit-bold">OTP Login</Typography>
            </TouchableOpacity>
          </View>

          <View className="space-y-4 mb-8">
            {authMode === 'phone' ? (
              !phoneOtpSent ? (
                <>
                  <TextInput 
                    label="Mobile Number"
                    placeholder="Enter 10-digit mobile number" 
                    keyboardType="phone-pad" 
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    maxLength={10}
                  />
                  <TouchableOpacity 
                    onPress={() => {
                      if (phoneNumber.trim()) {
                        setEmail(phoneNumber.trim());
                      }
                      setAuthMode('email');
                    }}
                    className="py-1 items-center"
                  >
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                      Have a password? Log in with password instead
                    </Typography>
                  </TouchableOpacity>
                  <View className="flex-row justify-between items-center mt-3">
                    <TouchableOpacity onPress={() => setAuthMode('email')}>
                      <Typography variant="caption" color="secondary" weight="medium" className="font-outfit">
                        Login with Password
                      </Typography>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      setForgotEmail(email);
                      setForgotStep(1);
                      setForgotError(null);
                      setForgotSuccess(null);
                      setShowForgotPasswordModal(true);
                    }}>
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                        Forgot password?
                      </Typography>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <View className="flex-row justify-between items-center mb-4">
                    <Typography variant="subtitle2" weight="bold" color="secondary" className="font-outfit-bold">
                      Enter Verification Code
                    </Typography>
                    <TouchableOpacity onPress={() => setPhoneOtpSent(false)}>
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                        Change Number
                      </Typography>
                    </TouchableOpacity>
                  </View>
                  <Typography variant="caption" color="muted" className="font-outfit mb-4">
                    Sent to +91 {phoneNumber}
                  </Typography>
                  <TextInput 
                    placeholder="• • • • • •" 
                    value={phoneOtp} 
                    onChangeText={setPhoneOtp} 
                    keyboardType="number-pad"
                    maxLength={6}
                    className="text-center text-2xl tracking-[8px] font-bold h-14 bg-gray-50 rounded-xl border border-gray-200"
                  />
                  <TouchableOpacity 
                    onPress={handleSendPhoneOtp}
                    disabled={isPhoneSending}
                    className="mt-4 py-2 items-center"
                  >
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                      {isPhoneSending ? 'Resending Code...' : "Didn't receive the code? Resend OTP"}
                    </Typography>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <>
                <TextInput 
                  label="Email or Mobile Number"
                  placeholder="Enter registered email or 10-digit phone" 
                  keyboardType="email-address" 
                  value={email} 
                  onChangeText={(text) => {
                    setEmail(text);
                    validateField('email', text);
                  }}
                  onBlur={() => validateField('email', email)}
                  autoCapitalize="none"
                  error={errors.email}
                />
                
                <TextInput 
                  label="Password"
                  placeholder="Enter your password" 
                  secureTextEntry
                  isPassword
                  value={password} 
                  onChangeText={(text) => {
                    setPassword(text);
                    validateField('password', text);
                  }}
                  onBlur={() => validateField('password', password)}
                  error={errors.password}
                />

                <View className="flex-row justify-between items-center mt-1 mb-2">
                  <TouchableOpacity onPress={() => {
                    setAuthMode('phone');
                    if (email.trim() && /^[0-9+]{10,14}$/.test(email.trim())) {
                      setPhoneNumber(formatPhoneForApi(email.trim()));
                    }
                  }}>
                    <Typography variant="caption" color="secondary" weight="medium" className="font-outfit">
                      Login via OTP instead
                    </Typography>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => {
                    setForgotEmail(email);
                    setForgotStep(1);
                    setForgotError(null);
                    setForgotSuccess(null);
                    setShowForgotPasswordModal(true);
                  }}>
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                      Forgot password?
                    </Typography>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          <View className="mb-8">
            {authMode === 'phone' ? (
              !phoneOtpSent ? (
                <Button 
                  title="Send OTP" 
                  disabled={phoneNumber.trim().length < 10 || isPhoneSending}
                  isLoading={isPhoneSending}
                  onPress={handleSendPhoneOtp}
                />
              ) : (
                <Button 
                  title="Verify & Login" 
                  disabled={phoneOtp.trim().length < 4 || isPhoneVerifying}
                  isLoading={isPhoneVerifying}
                  onPress={handleVerifyPhoneOtp}
                />
              )
            ) : (
              <Button 
                title="Login" 
                isLoading={isLoading}
                onPress={handleEmailLogin}
              />
            )}
          </View>

          <View className="flex-row justify-center items-center mb-10">
            <Typography variant="body2" color="muted" className="font-outfit">
              Don't have an account?{' '}
            </Typography>
            <TouchableOpacity onPress={() => {
              router.push({ pathname: '/(auth)/register', params: { role } });
            }}>
              <Typography variant="body2" color="secondary" weight="bold" className="font-outfit-bold">
                Register
              </Typography>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForgotPasswordModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/50 justify-end"
        >
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 28) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />
            
            <View className="flex-row justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <Typography variant="h3" color="secondary" weight="bold" className="text-xl font-outfit-bold">
                Reset Password
              </Typography>
              <TouchableOpacity 
                onPress={() => setShowForgotPasswordModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {forgotError && (
              <View className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-start">
                <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8, marginTop: 2 }} />
                <Typography variant="caption" className="flex-1 text-red-600 font-outfit">
                  {forgotError}
                </Typography>
              </View>
            )}

            {forgotSuccess && (
              <View className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex-row items-start">
                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8, marginTop: 2 }} />
                <Typography variant="caption" className="flex-1 text-emerald-700 font-outfit">
                  {forgotSuccess}
                </Typography>
              </View>
            )}

            {forgotStep === 1 ? (
              <View>
                <Typography variant="body2" color="muted" className="mb-4 font-outfit">
                  Enter your registered email address. We will send you a verification code to set a new password.
                </Typography>
                <TextInput 
                  label="Registered Email"
                  placeholder="coach@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  className="mb-4"
                />
                <Button 
                  title="Send Verification Code" 
                  onPress={handleSendForgotPasswordOtp}
                  isLoading={isSendingForgotOtp}
                  disabled={!forgotEmail.trim() || isSendingForgotOtp}
                />
              </View>
            ) : (
              <View>
                <Typography variant="caption" color="muted" className="mb-4 font-outfit">
                  Code sent to {forgotEmail}. Enter the OTP and your new password (at least 6 characters).
                </Typography>
                <TextInput 
                  label="Verification Code (OTP)"
                  placeholder="• • • • • •"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={forgotOtp}
                  onChangeText={setForgotOtp}
                  className="mb-3"
                />
                <TextInput 
                  label="New Password"
                  placeholder="At least 6 characters"
                  secureTextEntry
                  isPassword
                  value={newPassword}
                  onChangeText={setNewPassword}
                  className="mb-3"
                />
                <TextInput 
                  label="Confirm New Password"
                  placeholder="Re-enter new password"
                  secureTextEntry
                  isPassword
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  className="mb-4"
                />
                <Button 
                  title="Reset Password" 
                  onPress={handleResetPassword}
                  isLoading={isResettingPassword}
                  disabled={forgotOtp.trim().length < 4 || newPassword.length < 6 || isResettingPassword}
                />
                <TouchableOpacity 
                  onPress={handleSendForgotPasswordOtp}
                  disabled={isSendingForgotOtp}
                  className="mt-3 py-2 items-center"
                >
                  <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                    {isSendingForgotOtp ? "Resending Code..." : "Didn't receive code? Resend OTP"}
                  </Typography>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
