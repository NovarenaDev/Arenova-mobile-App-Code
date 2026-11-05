import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { api } from '@/services/api';

const coachBenefits = [
  { title: 'Earn Money Coaching', desc: 'Get High-Quality Leads & Clients' },
  { title: 'Flexible Schedule', desc: 'Set Your Own Hours' },
  { title: 'Zero Commission', desc: 'Earn 100% In The First Month' },
  { title: 'Track Earnings', desc: 'Dashboard To View Your Income' },
  { title: 'Be Part Of A Community', desc: 'Join Sports Events & Programs' }
];

const validatePassword = (pass: string): string | null => {
  if (pass.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(pass)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(pass)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(pass)) {
    return 'Password must contain at least one number';
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pass)) {
    return 'Password must contain at least one special character';
  }
  return null;
};

const formatPhoneForApi = (rawPhone: string): string => {
  const digits = rawPhone.trim().replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
};

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { role, phone: paramPhone } = useLocalSearchParams<{ role: string; phone?: string }>();
  
  const setToken = useAuthStore(state => state.setToken);
  const setUser = useAuthStore(state => state.setUser);
  
  const [coachMethod, setCoachMethod] = useState<'phone' | 'email'>('phone');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(paramPhone || '');
  const [location, setLocation] = useState('');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [registrationPhase, setRegistrationPhase] = useState<'input' | 'verify'>('input');
  const [screenError, setScreenError] = useState<string | null>(null);
  const [screenSuccess, setScreenSuccess] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);

  const [phoneOtp, setPhoneOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);

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

    const status = err?.response?.status;
    if (status === 409 ||
        message.toLowerCase().includes('already registered') || 
        message.toLowerCase().includes('already in use') || 
        message.toLowerCase().includes('already exists') || 
        message.toLowerCase().includes('email_exists') || 
        message.toLowerCase().includes('email-already-in-use') ||
        message.toLowerCase().includes('phone number already exists') ||
        message.toLowerCase().includes('duplicate key')) {
      return role === 'coach'
        ? 'A coach account with this phone number or email already exists. Please log in instead.'
        : 'An account with this phone number or email already exists. Please log in instead.';
    }
    if (message.toLowerCase().includes('auth/invalid-email') || message.toLowerCase().includes('invalid-email') || message.toLowerCase().includes('email must be a valid email')) {
      return 'Please enter a valid email address.';
    }
    if (message.includes('auth/weak-password') || message.includes('weak-password') || message.toLowerCase().includes('password is too weak')) {
      return 'The password is too weak. Please use a stronger password.';
    }
    if (message.includes('auth/network-request-failed')) {
      return 'Network error. Please check your internet connection.';
    }
    if (status === 429 || message.toLowerCase().includes('too many') || message.toLowerCase().includes('rate limit')) {
      return 'Too many requests sent in a short time. Please wait a few minutes before trying again.';
    }
    let clean = message.replace(/^Firebase:\s*/i, '');
    clean = clean.replace(/^Error:\s*/i, '');
    clean = clean.replace(/\(auth\/[^)]+\)\.?/g, '');
    return clean.trim();
  };

  // Fetch sports dynamically from backend
  const { data: sportsResponse } = useQuery({
    queryKey: ['activeSports'],
    queryFn: async () => {
      const res = await api.get('/sports');
      return res.data;
    }
  });

  const backendSports = sportsResponse?.data || [];
  const fallbackSports = ['Football', 'Basketball', 'Tennis', 'Cricket', 'Swimming', 'Gym', 'Athletics', 'Yoga', 'Martial Arts', 'Badminton', 'Fitness', 'Squash', 'Table Tennis'];
  const sportsList = backendSports.length > 0 ? backendSports.map((s: any) => s.name || s.title || s) : fallbackSports;

  const toggleSport = (sport: string) => {
    setSelectedSports(prev => 
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    );
  };

  const handleNavigateToHome = () => {
    setShowWelcomeModal(false);
    if (role === 'coach') {
      router.replace('/(coach)/(coach-tabs)/coach-dashboard');
    } else if (role === 'parent') {
      router.replace('/(parent)/(parent-tabs)/parent-dashboard');
    } else {
      router.replace('/(individual)/(individual-tabs)/individual-dashboard');
    }
  };

  const handleInitialSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Full name is required';

    if (role === 'coach') {
      if (selectedSports.length === 0) {
        newErrors.sports = 'Please select at least one sport';
      }

      if (coachMethod === 'phone') {
        const cleanPhone = formatPhoneForApi(phone);
        if (!cleanPhone) {
          newErrors.phone = 'Phone number is required';
        } else if (cleanPhone.length < 10) {
          newErrors.phone = 'Please enter a valid 10-digit phone number';
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setScreenError(null);
        setScreenSuccess(null);
        setIsSendingOtp(true);

        try {
          const response = await api.post('/auth/coach/send-otp', {
            name: name.trim(),
            phone: String(cleanPhone),
            sports: selectedSports,
            purpose: 'register'
          });

          setIsSendingOtp(false);
          if ((response.status === 200 || response.status === 201) && response.data?.success !== false) {
            setRegistrationPhase('verify');
            setPhoneOtp('');
            setScreenSuccess(`SMS OTP sent successfully to +91 ${cleanPhone}.`);
          } else {
            setScreenError(response.data?.message || 'Failed to send OTP. Please try again.');
          }
        } catch (err: any) {
          setIsSendingOtp(false);
          const status = err?.response?.status;
          const data = err?.response?.data;
          const backendMessage = data?.message || data?.error;
          if (status === 409) {
            setScreenError(backendMessage || 'A coach account with this phone number already exists. Please log in instead.');
          } else {
            setScreenError(sanitizeErrorMessage(err));
          }
        }
      } else {
        // Coach Email Registration
        if (!email.trim()) {
          newErrors.email = 'Email is required';
        } else if (!validateEmail(email)) {
          newErrors.email = 'Please enter a valid email address';
        }

        if (!password) {
          newErrors.password = 'Password is required';
        } else if (password.length < 6) {
          newErrors.password = 'Password must be at least 6 characters';
        } else if (password.length > 72) {
          newErrors.password = 'Password must not exceed 72 characters';
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setScreenError(null);
        setScreenSuccess(null);
        setIsSendingOtp(true);

        try {
          const response = await api.post('/auth/coach/register', {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            sports: selectedSports
          });

          setIsSendingOtp(false);
          if ((response.status === 200 || response.status === 201) && response.data?.success !== false) {
            setRegistrationPhase('verify');
            setPhoneOtp('');
            setScreenSuccess(`Email verification OTP sent to ${email.trim().toLowerCase()}.`);
          } else {
            setScreenError(response.data?.message || 'Failed to send registration code. Please try again.');
          }
        } catch (err: any) {
          setIsSendingOtp(false);
          const status = err?.response?.status;
          const data = err?.response?.data;
          const backendMessage = data?.message || data?.error;
          if (status === 409) {
            setScreenError(backendMessage || 'A coach account with this email already exists. Please log in instead.');
          } else {
            setScreenError(sanitizeErrorMessage(err));
          }
        }
      }
    } else {
      // Parent / Athlete registration
      const cleanPhone = formatPhoneForApi(phone);
      if (!cleanPhone) {
        newErrors.phone = 'Phone number is required';
      } else if (cleanPhone.length < 10) {
        newErrors.phone = 'Please enter a valid 10-digit phone number';
      }

      if (!email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!validateEmail(email)) {
        newErrors.email = 'Please enter a valid email address';
      }
      
      if (!location.trim()) {
        newErrors.location = 'Location / City is required';
      }
      
      const passError = validatePassword(password);
      if (passError) {
        newErrors.password = passError;
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;

      setScreenError(null);
      setScreenSuccess(null);
      setIsSendingOtp(true);

      try {
        const payload = {
          phone: String(cleanPhone),
          purpose: 'register'
        };

        const response = await api.post('/auth/send-otp', payload);

        if ((response.status === 200 || response.status === 201) && response.data?.success !== false) {
          setIsSendingOtp(false);
          setRegistrationPhase('verify');
          setPhoneOtp('');
          setScreenSuccess(`SMS OTP sent successfully to +91 ${cleanPhone}.`);
        } else {
          setIsSendingOtp(false);
          setScreenError(response.data?.message || 'Failed to send verification code. Please try again.');
        }
      } catch (err: any) {
        setIsSendingOtp(false);
        const status = err?.response?.status;
        const data = err?.response?.data;
        const backendMessage = data?.message || data?.error;
        if (status === 409) {
          setScreenError(backendMessage || 'An account with this phone number already exists. Please log in instead.');
        } else {
          setScreenError(sanitizeErrorMessage(err));
        }
      }
    }
  };

  const handleVerifyOtp = async () => {
    const cleanOtp = phoneOtp.trim();
    if (!cleanOtp || cleanOtp.length < 4) {
      setScreenError('Please enter the 6-digit verification code.');
      return;
    }

    setScreenError(null);
    setScreenSuccess(null);
    setIsVerifyingOtp(true);

    if (role === 'coach') {
      if (coachMethod === 'phone') {
        const cleanPhone = formatPhoneForApi(phone);
        try {
          const phoneRes = await api.post('/auth/coach/verify-otp', {
            phone: String(cleanPhone),
            otp: String(cleanOtp),
            purpose: 'register'
          });
          const data = phoneRes.data;

          const realToken = data?.token || data?.jwt || data?.access_token || (data?.data && data?.data?.token);
          if (realToken) {
            setToken(realToken);
          }

          const coachObj = data?.data || data?.coach || data?.user;
          const coachUserId = coachObj?._id || coachObj?.id || data?._id || '1';

          setUser({
            id: coachUserId,
            name: coachObj?.name || name.trim(),
            phone: String(cleanPhone),
            email: coachObj?.email || '',
            location: '',
            sports: selectedSports,
            role: 'coach',
            status: 'pending',
            isRegistered: true,
          });

          setIsVerifyingOtp(false);

          router.replace({ 
            pathname: '/(coach)/onboarding', 
            params: { 
              role: 'coach',
              phone: String(cleanPhone)
            } 
          });
        } catch (err: any) {
          setIsVerifyingOtp(false);
          const status = err?.response?.status;
          const data = err?.response?.data;
          const backendMessage = data?.message || data?.error;
          if (status === 409) {
            setScreenError(backendMessage || 'A coach account with this phone number already exists. Please log in instead.');
          } else {
            setScreenError(sanitizeErrorMessage(data?.message || err?.message || 'Invalid or expired OTP. Please check your verification code and try again.'));
          }
        }
      } else {
        // Coach Email Verification
        const cleanEmail = email.trim().toLowerCase();
        try {
          const emailRes = await api.post('/auth/coach/verify-email-otp', {
            email: cleanEmail,
            otp: String(cleanOtp)
          });
          const data = emailRes.data;

          const realToken = data?.token || data?.jwt || data?.access_token || (data?.data && data?.data?.token);
          if (realToken) {
            setToken(realToken);
          }

          const coachObj = data?.data || data?.coach || data?.user;
          const coachUserId = coachObj?._id || coachObj?.id || data?._id || '1';

          setUser({
            id: coachUserId,
            name: coachObj?.name || name.trim(),
            email: cleanEmail,
            phone: coachObj?.phone || '',
            location: '',
            sports: selectedSports,
            role: 'coach',
            status: 'pending',
            isRegistered: true,
          });

          setIsVerifyingOtp(false);

          router.replace({ 
            pathname: '/(coach)/onboarding', 
            params: { 
              role: 'coach',
              email: cleanEmail
            } 
          });
        } catch (err: any) {
          setIsVerifyingOtp(false);
          const status = err?.response?.status;
          const data = err?.response?.data;
          const backendMessage = data?.message || data?.error;
          if (status === 409) {
            setScreenError(backendMessage || 'A coach account with this email already exists. Please log in instead.');
          } else {
            setScreenError(sanitizeErrorMessage(data?.message || err?.message || 'Invalid or expired OTP. Please check your verification code and try again.'));
          }
        }
      }
    } else {
      try {
        const cleanPhone = formatPhoneForApi(phone);
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '.';
        const roleParam = role === 'individual' ? 'player' : 'parent';

        const verifyPayload: any = {
          phone: String(cleanPhone),
          otp: String(cleanOtp),
          purpose: 'register',
          firstName,
          lastName,
          role: roleParam,
          email: email.trim().toLowerCase(),
          password,
          location: location.trim(),
          address: location.trim()
        };
        if (referralCode) {
          verifyPayload.referralCode = referralCode.trim();
        }

        const res = await api.post('/auth/verify-otp', verifyPayload);
        const data = res.data;

        let realToken = data?.token || data?.jwt || data?.access_token || (data?.data && data?.data?.token);

        if (!realToken) {
          try {
            await api.post('/auth/register', verifyPayload);
          } catch (regErr) {
            console.warn('Register fallback notice:', regErr);
          }

          try {
            const loginRes = await api.post('/auth/login', {
              email: email.trim().toLowerCase(),
              password
            });
            realToken = loginRes.data?.token || loginRes.data?.jwt || loginRes.data?.access_token || (loginRes.data?.data && loginRes.data?.data?.token);
          } catch (loginErr) {
            console.warn('Customer auto-login notice:', loginErr);
          }
        }

        if (realToken) {
          setToken(realToken);
        }
        const userObj = data?.user || data?.data?.user || data?.data;
        setUser({
          id: userObj?._id || userObj?.id || '1',
          name: name.trim(),
          phone: String(cleanPhone),
          email: email.trim().toLowerCase(),
          location: location.trim(),
          role: role === 'individual' ? 'individual' : 'parent',
          status: 'active',
          isRegistered: true,
        });

        setIsVerifyingOtp(false);
        setShowWelcomeModal(true);
      } catch (err: any) {
        setIsVerifyingOtp(false);
        const status = err?.response?.status;
        const data = err?.response?.data;
        const backendMessage = data?.message || data?.error;
        if (status === 409) {
          setScreenError(backendMessage || 'An account with this phone number already exists. Please log in instead.');
        } else {
          setScreenError(sanitizeErrorMessage(data?.message || err?.message || 'Invalid or expired verification code. Please try again.'));
        }
      }
    }
  };

  const handleResendOtp = async () => {
    setIsResendingOtp(true);
    setScreenError(null);
    try {
      if (role === 'coach') {
        if (coachMethod === 'phone') {
          const cleanPhone = formatPhoneForApi(phone);
          const response = await api.post('/auth/coach/send-otp', {
            phone: String(cleanPhone),
            purpose: 'register'
          });
          setIsResendingOtp(false);
          if ((response.status === 200 || response.status === 201) && response.data?.success !== false) {
            setScreenSuccess(`A new SMS verification code has been sent to +91 ${cleanPhone}.`);
          } else {
            setScreenError(response.data?.message || 'Failed to resend SMS OTP.');
          }
        } else {
          const cleanEmail = email.trim().toLowerCase();
          const response = await api.post('/auth/coach/resend-email-otp', {
            email: cleanEmail
          });
          setIsResendingOtp(false);
          if ((response.status === 200 || response.status === 201) && response.data?.success !== false) {
            setScreenSuccess(`A new verification code has been sent to ${cleanEmail}.`);
          } else {
            setScreenError(response.data?.message || 'Failed to resend email OTP.');
          }
        }
      } else {
        const cleanPhone = formatPhoneForApi(phone);
        const response = await api.post('/auth/send-otp', {
          phone: String(cleanPhone),
          purpose: 'register'
        });
        setIsResendingOtp(false);
        if ((response.status === 200 || response.status === 201) && response.data?.success !== false) {
          setScreenSuccess(`A new SMS verification code has been sent to +91 ${cleanPhone}.`);
        } else {
          setScreenError(response.data?.message || 'Failed to resend SMS OTP.');
        }
      }
    } catch (err: any) {
      setIsResendingOtp(false);
      setScreenError(sanitizeErrorMessage(err?.response?.data?.message || err?.message || 'Failed to resend code.'));
    }
  };

  const validateEmail = (text: string) => {
    const reg = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w\w+)+$/;
    return reg.test(text.trim());
  };

  const validateField = (field: string, val: string) => {
    let err = '';
    if (field === 'name') {
      if (!val.trim()) err = 'Full name is required';
    } else if (field === 'email') {
      if (!val.trim()) {
        err = 'Email is required';
      } else if (!validateEmail(val)) {
        err = 'Please enter a valid email address';
      }
    } else if (field === 'phone') {
      if (!val.trim()) {
        err = 'Phone number is required';
      } else if (val.trim().length < 10) {
        err = 'Please enter a valid 10-digit phone number';
      }
    } else if (field === 'location') {
      if (!val.trim()) err = 'Location / City is required';
    } else if (field === 'password') {
      if (role === 'coach') {
        if (!val) {
          err = 'Password is required';
        } else if (val.length < 6) {
          err = 'Password must be at least 6 characters';
        } else if (val.length > 72) {
          err = 'Password must not exceed 72 characters';
        }
      } else {
        const passError = validatePassword(val);
        if (passError) err = passError;
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

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">

        <View className="px-6 py-4 z-10">
          <TouchableOpacity onPress={() => {
            if (registrationPhase !== 'input') {
              setRegistrationPhase('input'); 
            } else {
              try {
                router.back();
              } catch (e) {
                router.replace('/(auth)/role-selection');
              }
            }
          }} className="p-2 -ml-2 w-12">
            <Ionicons name="arrow-back" size={28} color="#0F2C59" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          className="flex-1 px-6 pt-4" 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 80, 100) }}
        >
          
          {screenError && (
            <View className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm animate-fade-in">
              <View className="flex-row items-start">
                <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5 mt-0.5" />
                <View className="flex-1">
                  <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-red-800">
                    Registration Notice
                  </Typography>
                  <Typography variant="caption" className="font-outfit text-red-600 mt-0.5">
                    {screenError}
                  </Typography>
                </View>
                <TouchableOpacity onPress={() => setScreenError(null)} className="p-1 -mr-1 -mt-1">
                  <Ionicons name="close" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>

              {(screenError.toLowerCase().includes('already exists') ||
                screenError.toLowerCase().includes('already registered') ||
                screenError.toLowerCase().includes('log in instead')) && (
                <TouchableOpacity
                  onPress={() => router.push({ 
                    pathname: '/(auth)/login', 
                    params: { 
                      role, 
                      phone: phone.trim() || undefined 
                    } 
                  })}
                  activeOpacity={0.85}
                  className="mt-3 py-2.5 px-4 bg-[#FF5100] rounded-xl flex-row items-center justify-center shadow-sm"
                >
                  <Typography variant="caption" weight="bold" className="text-white font-outfit-bold mr-1.5">
                    {role === 'coach' ? 'Go to Coach Login' : (role === 'parent' ? 'Go to Parent Login' : 'Go to Athlete Login')}
                  </Typography>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {screenSuccess && (
            <View className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex-row items-start shadow-sm animate-fade-in">
              <Ionicons name="checkmark-circle" size={20} color="#10B981" className="mr-2.5 mt-0.5" />
              <View className="flex-1">
                <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-emerald-800">
                  Success
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
          
          {role === 'coach' && registrationPhase === 'input' ? (
            <View className="mb-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              {coachBenefits.map((benefit, i) => (
                <View key={benefit.title}>
                  <View className="flex-row items-start py-1">
                    <View className="mr-3 mt-0.5">
                      <Ionicons name="checkmark-circle" size={18} color="#FF5100" />
                    </View>
                    <View className="flex-1">
                      <Typography variant="body2" color="secondary" weight="bold" className="text-[#0F2C59] font-outfit-bold">
                        {benefit.title}
                      </Typography>
                      <Typography variant="caption" color="muted" className="text-gray-500 mt-0.5 font-outfit">
                        {benefit.desc}
                      </Typography>
                    </View>
                  </View>
                  {i < coachBenefits.length - 1 && (
                    <View className="h-[1px] bg-gray-100 my-2" />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View className="mb-8 items-center">
              <Typography variant="h1" color="secondary" className="mb-2 font-bold text-center font-outfit-bold">
                {role === 'parent' ? 'Parent Registration' : (role === 'individual' ? 'Athlete Registration' : 'Create Account')}
              </Typography>
              <Typography variant="body1" color="muted" className="text-center font-outfit">
                {registrationPhase === 'input' && (
                  role === 'parent' 
                    ? 'Create an account to manage child profiles and book training sessions.'
                    : (role === 'individual'
                      ? 'Create an account to track your progress and book expert coaching.'
                      : 'Get started by filling out your details below.')
                )}
                {registrationPhase === 'verify' && "Verify your Mobile Number"}
              </Typography>
            </View>
          )}

          {role === 'coach' && registrationPhase === 'input' && (
            <>
              <View className="flex-row justify-between items-center mb-4">
                <Typography variant="h2" color="secondary" weight="bold" className="text-[#0F2C59] text-lg font-outfit-bold">
                  Coach Registration
                </Typography>
                {!showReferralInput && (
                  <TouchableOpacity onPress={() => setShowReferralInput(true)}>
                    <Typography variant="caption" color="secondary" weight="semibold" className="font-outfit-semibold">
                      Have A Referral Code? <Typography variant="caption" className="text-[#FF5100] font-outfit-bold" weight="bold">Enter</Typography>
                    </Typography>
                  </TouchableOpacity>
                )}
              </View>

              {/* Coach Registration Method Toggle */}
              <View className="flex-row bg-gray-200 rounded-full p-1 mb-6">
                <TouchableOpacity 
                  onPress={() => {
                    setCoachMethod('phone');
                    setErrors({});
                    setScreenError(null);
                    setScreenSuccess(null);
                  }} 
                  className="flex-1 py-3 rounded-full items-center"
                  style={coachMethod === 'phone' ? {
                    backgroundColor: 'white',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 1,
                    elevation: 1
                  } : {}}
                >
                  <Typography variant="subtitle2" color={coachMethod === 'phone' ? 'secondary' : 'muted'} weight="bold" className="font-outfit-bold">
                    Phone
                  </Typography>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    setCoachMethod('email');
                    setErrors({});
                    setScreenError(null);
                    setScreenSuccess(null);
                  }} 
                  className="flex-1 py-3 rounded-full items-center"
                  style={coachMethod === 'email' ? {
                    backgroundColor: 'white',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 1,
                    elevation: 1
                  } : {}}
                >
                  <Typography variant="subtitle2" color={coachMethod === 'email' ? 'secondary' : 'muted'} weight="bold" className="font-outfit-bold">
                    Email
                  </Typography>
                </TouchableOpacity>
              </View>
            </>
          )}

          {registrationPhase === 'input' && (
            <View className="space-y-4 mb-8">
              {role === 'coach' && showReferralInput && (
                <TextInput 
                  label="Referral Code (Optional)"
                  placeholder="Enter referral code" 
                  value={referralCode} 
                  onChangeText={setReferralCode}
                />
              )}

              <TextInput 
                label="Full Name"
                placeholder="Enter full name" 
                value={name} 
                onChangeText={(text) => {
                  setName(text);
                  validateField('name', text);
                }}
                onBlur={() => validateField('name', name)}
                error={errors.name}
              />

              {role === 'coach' ? (
                coachMethod === 'phone' ? (
                  <TextInput 
                    label="Phone Number"
                    placeholder="Enter 10-digit mobile number" 
                    keyboardType="phone-pad" 
                    value={phone} 
                    onChangeText={(text) => {
                      setPhone(text);
                      validateField('phone', text);
                    }}
                    onBlur={() => validateField('phone', phone)}
                    maxLength={10}
                    error={errors.phone}
                  />
                ) : (
                  <>
                    <TextInput 
                      label="Email Address"
                      placeholder="Enter your email" 
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
                      placeholder="Create password (min 6 characters)" 
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
                  </>
                )
              ) : (
                <>
                  <TextInput 
                    label="Phone Number"
                    placeholder="Enter mobile number" 
                    keyboardType="phone-pad" 
                    value={phone} 
                    onChangeText={(text) => {
                      setPhone(text);
                      validateField('phone', text);
                    }}
                    onBlur={() => validateField('phone', phone)}
                    maxLength={10}
                    error={errors.phone}
                  />
                  
                  <TextInput 
                    label="Email"
                    placeholder="Enter your email" 
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
                    label="Location / City"
                    placeholder="e.g. Hyderabad, TS" 
                    value={location} 
                    onChangeText={(text) => {
                      setLocation(text);
                      validateField('location', text);
                    }}
                    onBlur={() => validateField('location', location)}
                    error={errors.location}
                  />
                  
                  <TextInput 
                    label="Password"
                    placeholder="Create a password" 
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
                </>
              )}

              {role === 'coach' && (
                <View className="mb-4">
                  <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold">Select Sports</Typography>
                  <View className="flex-row flex-wrap gap-2 mt-1">
                    {sportsList.map((sport: string) => {
                      const isSelected = selectedSports.includes(sport);
                      return (
                        <TouchableOpacity 
                          key={sport} 
                          onPress={() => toggleSport(sport)}
                          activeOpacity={0.8}
                          className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-primary border-primary' : 'bg-white border-gray-300'}`}
                        >
                          <Typography variant="caption" color={isSelected ? 'white' : 'muted'} weight="bold" className="font-outfit-bold">
                            {sport}
                          </Typography>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {errors.sports && (
                    <Typography variant="caption" color="error" className="mt-2 ml-1 font-outfit">
                      {errors.sports}
                    </Typography>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Verification View */}
          {registrationPhase === 'verify' && (
            <View className="mb-8">
              <View className="items-center mb-6">
                <View className="w-16 h-16 rounded-full bg-orange-50 items-center justify-center mb-3 border border-orange-100">
                  <Ionicons 
                    name={role === 'coach' && coachMethod === 'email' ? "mail-outline" : "phone-portrait-outline"} 
                    size={32} 
                    color="#FF5100" 
                  />
                </View>
                <Typography variant="h2" color="secondary" weight="bold" className="mb-2 text-center font-outfit-bold text-xl">
                  {role === 'coach' && coachMethod === 'email' ? 'Verify Email Address' : 'Verify Mobile Number'}
                </Typography>
                <Typography variant="body2" color="muted" className="text-center font-outfit text-sm px-4">
                  {role === 'coach' && coachMethod === 'email'
                    ? `Please enter the 6-digit verification code sent to ${email}.`
                    : `Please enter the 6-digit SMS verification code sent to +91 ${phone}.`}
                </Typography>
                <TouchableOpacity onPress={() => setRegistrationPhase('input')} className="mt-3 py-1.5 px-4 bg-white border border-gray-200 rounded-full shadow-sm">
                  <Typography variant="caption" color="secondary" weight="semibold" className="font-outfit-semibold text-xs text-gray-700">
                    {role === 'coach' && coachMethod === 'email' ? 'Edit Details / Email' : 'Edit Details / Phone'}
                  </Typography>
                </TouchableOpacity>
              </View>

              {/* OTP Card */}
              <View className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center mr-2.5">
                      <Ionicons name="shield-checkmark" size={16} color="#FF5100" />
                    </View>
                    <View className="flex-1">
                      <Typography variant="subtitle2" weight="bold" color="secondary" className="font-outfit-bold">
                        {role === 'coach' && coachMethod === 'email' ? 'Email Verification Code' : 'SMS Verification Code'}
                      </Typography>
                      <Typography variant="caption" color="muted" className="font-outfit">
                        {role === 'coach' && coachMethod === 'email' ? `Sent to ${email}` : `Sent to +91 ${phone}`}
                      </Typography>
                    </View>
                  </View>
                </View>

                <TextInput 
                  placeholder="• • • • • •" 
                  value={phoneOtp} 
                  onChangeText={setPhoneOtp} 
                  keyboardType="number-pad"
                  maxLength={6}
                  className="text-center text-2xl tracking-[8px] font-bold h-14 bg-gray-50 rounded-xl border border-gray-200"
                />

                <TouchableOpacity 
                  onPress={handleResendOtp}
                  disabled={isResendingOtp}
                  className="mt-3 py-1 items-center"
                >
                  <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                    {isResendingOtp 
                      ? "Resending Code..." 
                      : (role === 'coach' && coachMethod === 'email' 
                        ? "Didn't receive email? Resend Email OTP" 
                        : "Didn't receive SMS? Resend Mobile OTP")}
                  </Typography>
                </TouchableOpacity>
              </View>

              <Button 
                title="Verify & Complete Registration" 
                onPress={handleVerifyOtp} 
                isLoading={isVerifyingOtp} 
                disabled={phoneOtp.trim().length < 4 || isVerifyingOtp}
              />
            </View>
          )}

          <View className="mb-12">
            {registrationPhase === 'input' && (
              <Button 
                title="Continue" 
                isLoading={isSendingOtp} 
                onPress={handleInitialSubmit}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modern Welcome Success Modal Card */}
      <Modal
        visible={showWelcomeModal}
        transparent
        animationType="fade"
        onRequestClose={handleNavigateToHome}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 44, 89, 0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View 
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderRadius: 28, 
              padding: 24, 
              width: '100%', 
              maxWidth: 380, 
              alignItems: 'center',
              shadowColor: '#000000', 
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.3, 
              shadowRadius: 24, 
              elevation: 12,
              borderWidth: 1,
              borderColor: 'rgba(255, 81, 0, 0.15)'
            }}
          >
            {/* Top Success Badge */}
            <View 
              style={{ 
                width: 72, 
                height: 72, 
                borderRadius: 36, 
                backgroundColor: '#ECFDF5', 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginBottom: 16,
                borderWidth: 2,
                borderColor: '#A7F3D0'
              }}
            >
              <Ionicons name="checkmark-circle" size={44} color="#10B981" />
            </View>

            {/* Title & Role */}
            <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-2xl text-center mb-1">
              Welcome to Arenova!
            </Typography>

            <View className="bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200 mb-4">
              <Typography variant="caption" color="primary" weight="bold" className="text-emerald-700 font-outfit-bold text-xs uppercase tracking-wider">
                {role === 'parent' ? '✓ Registered as Parent' : (role === 'individual' ? '✓ Registered as Athlete' : '✓ Registered Successfully')}
              </Typography>
            </View>

            <Typography variant="body2" color="muted" className="font-outfit text-center text-sm leading-5 mb-5 text-gray-600 px-2">
              {role === 'parent' 
                ? 'Your parent account has been successfully created! You can now manage child profiles and book sports training.' 
                : 'Your profile is active! You can now explore top coaches and book your training sessions.'}
            </Typography>

            {/* User Details Summary Card */}
            <View className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6 space-y-2.5">
              <View className="flex-row items-center justify-between">
                <Typography variant="caption" color="muted" className="font-outfit">Full Name</Typography>
                <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">{name}</Typography>
              </View>

              <View className="h-[1px] bg-gray-200/60 my-0.5" />

              <View className="flex-row items-center justify-between">
                <Typography variant="caption" color="muted" className="font-outfit">Phone Number</Typography>
                <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">{phone}</Typography>
              </View>

              <View className="h-[1px] bg-gray-200/60 my-0.5" />

              <View className="flex-row items-center justify-between">
                <Typography variant="caption" color="muted" className="font-outfit">Location / City</Typography>
                <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">{location || 'Not Specified'}</Typography>
              </View>
            </View>

            {/* Home Navigation Button */}
            <TouchableOpacity
              style={{ 
                width: '100%', 
                paddingVertical: 16, 
                borderRadius: 18, 
                backgroundColor: '#FF5100', 
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#FF5100',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 6
              }}
              activeOpacity={0.85}
              onPress={handleNavigateToHome}
            >
              <Typography color="white" weight="bold" className="font-outfit-bold text-base mr-2">
                Go to Home Screen
              </Typography>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
