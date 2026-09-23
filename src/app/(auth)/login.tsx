import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useAuthStore } from '@/store';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/services/api';
import { auth } from '@/services/firebase';
import { signInWithEmailAndPassword, getIdToken } from 'firebase/auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role: string }>();
  const [authMode, setAuthMode] = useState<'email' | 'phone'>('email');
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [screenError, setScreenError] = useState<string | null>(null);

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
    if (message.includes('auth/too-many-requests')) {
      return 'Too many login attempts. Please try again later.';
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

  const directLoginMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password
      });
      return response.data;
    },
    onSuccess: (data) => {
      const realToken = data.token || data.jwt || data.access_token || (data.data && data.data.token);
      setToken(realToken);
      const userObj = data.user || data.data?.user || data.data;
      const finalRole = resolveUserRole(userObj?.role);
      setUser({
        id: userObj?._id || userObj?.id || '1',
        name: userObj?.name || `${userObj?.firstName || ''} ${userObj?.lastName || ''}`.trim() || userObj?.email || email,
        phone: userObj?.phone || userObj?.phoneNumber || '',
        email: userObj?.email || email || '',
        role: finalRole,
        status: 'active',
        isRegistered: true,
      });
      setIsLoading(false);

      if (finalRole === 'coach') {
        router.replace('/(coach)/(coach-tabs)/coach-dashboard');
      } else if (finalRole === 'parent') {
        router.replace('/(parent)/(parent-tabs)/parent-dashboard');
      } else {
        router.replace('/(individual)/(individual-tabs)/individual-dashboard');
      }
    },
    onError: (error: any) => {
      setIsLoading(false);
      setScreenError(sanitizeErrorMessage(error));
    }
  });

  const verifyFirebaseMutation = useMutation({
    mutationFn: async (idToken: string) => {
      const endpoint = role === 'coach' ? '/auth/coach/verify-firebase' : '/auth/verify-firebase';
      const response = await api.post(endpoint, {
        firebaseIdToken: idToken
      });
      return response.data;
    },
    onSuccess: async (data) => {
      const realToken = data.token || data.jwt || data.access_token || (data.data && data.data.token);
      setToken(realToken);
      const userObj = data.user || data.data?.user || data.data;
      let resolvedStatus = 'active';

      if (role === 'coach') {
        try {
          const profileRes = await api.get('/coaches/my/profile');
          const profileObj = profileRes.data?.data || profileRes.data;
          const kycStatus = profileObj?.kyc || profileObj?.profile?.kyc || profileObj?.status || userObj?.kyc || userObj?.status;
          resolvedStatus = (kycStatus === 'pending' || kycStatus === 'rejected') ? kycStatus : 'active';
        } catch (e) {
          const userKyc = userObj?.kyc || userObj?.status;
          resolvedStatus = (userKyc === 'pending' || userKyc === 'rejected') ? userKyc : 'active';
        }
      } else {
        resolvedStatus = userObj?.status || 'active';
      }

      const finalRole = resolveUserRole(userObj?.role);

      setUser({
        id: userObj?._id || userObj?.id || '1',
        name: userObj?.name || `${userObj?.firstName || ''} ${userObj?.lastName || ''}`.trim() || userObj?.email || email,
        phone: userObj?.phone || userObj?.phoneNumber || '',
        email: userObj?.email || email || '',
        role: finalRole,
        status: resolvedStatus,
        isRegistered: true,
      });
      setIsLoading(false);

      if (finalRole === 'coach') {
        if (resolvedStatus === 'active' || resolvedStatus === 'approved') {
          router.replace('/(coach)/(coach-tabs)/coach-dashboard');
        } else {
          router.replace('/(coach)/onboarding');
        }
      } else if (finalRole === 'parent') {
        router.replace('/(parent)/(parent-tabs)/parent-dashboard');
      } else {
        router.replace('/(individual)/(individual-tabs)/individual-dashboard');
      }
    },
    onError: (error: any) => {
      setIsLoading(false);
      setScreenError(sanitizeErrorMessage(error));
    }
  });

  const validateEmail = (text: string) => {
    const reg = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w\w+)+$/;
    return reg.test(text.trim());
  };

  const validateField = (field: string, val: string) => {
    let err = '';
    if (field === 'email') {
      if (!val.trim()) {
        err = 'Email address is required';
      } else if (!validateEmail(val)) {
        err = 'Please enter a valid email address';
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
    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
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
    setIsLoading(true);
    if (role === 'coach') {
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await getIdToken(userCredential.user, true);
        verifyFirebaseMutation.mutate(idToken);
      } catch (err: any) {
        setIsLoading(false);
        setScreenError(sanitizeErrorMessage(err.message));
      }
    } else {
      directLoginMutation.mutate();
    }
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
          
          <View className="mb-10 items-center">
            <Typography variant="h1" color="secondary" className="mb-2 font-bold text-center font-outfit-bold">
              {role === 'parent' ? 'Parent Portal Login' : (role === 'individual' ? 'Athlete Login' : 'Login to Arenova')}
            </Typography>
            <Typography variant="body1" color="muted" className="text-center font-outfit">
              {role === 'parent' 
                ? 'Access child profiles and manage session bookings.' 
                : (role === 'individual' 
                  ? 'Track your training progress and book coach sessions.' 
                  : 'Enter your email and password to login.')}
            </Typography>
          </View>

          {screenError && (
            <View className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex-row items-start shadow-sm animate-fade-in">
              <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5 mt-0.5" />
              <View className="flex-1">
                <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-red-800">
                  Authentication Error
                </Typography>
                <Typography variant="caption" className="font-outfit text-red-600 mt-0.5">
                  {screenError}
                </Typography>
              </View>
              <TouchableOpacity onPress={() => setScreenError(null)} className="p-1 -mr-1 -mt-1">
                <Ionicons name="close" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Toggle Button */}
          <View className="flex-row bg-gray-200 rounded-full p-1 mb-8">
            <TouchableOpacity 
              onPress={() => setAuthMode('email')} 
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
              <Typography variant="subtitle2" color={authMode === 'email' ? 'secondary' : 'muted'} weight="bold" className="font-outfit-bold">Email</Typography>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setAuthMode('phone')} 
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
              <Typography variant="subtitle2" color={authMode === 'phone' ? 'secondary' : 'muted'} weight="bold" className="font-outfit-bold">Phone</Typography>
            </TouchableOpacity>
          </View>

          <View className="space-y-4 mb-8">
            {authMode === 'phone' ? (
              <TextInput 
                label="Mobile Number"
                placeholder="Enter Mobile Number" 
                keyboardType="phone-pad" 
                value={phoneNumber}
                onChangeText={setPhoneNumber}
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
              </>
            )}
          </View>

          <View className="mb-8">
            {authMode === 'phone' ? (
              <Button 
                title="Send OTP" 
                disabled={phoneNumber.length < 10}
                onPress={() => {
                  setScreenError('Phone login is currently under maintenance. Please use Email & Password to log in.');
                }}
              />
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
    </SafeAreaView>
  );
}
