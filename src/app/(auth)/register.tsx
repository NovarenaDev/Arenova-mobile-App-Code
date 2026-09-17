import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { api } from '@/services/api';
import { auth } from '@/services/firebase';
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  getIdToken, 
  PhoneAuthProvider,
  linkWithCredential
} from 'firebase/auth';

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

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { role } = useLocalSearchParams<{ role: string }>();
  
  const setToken = useAuthStore(state => state.setToken);
  const setUser = useAuthStore(state => state.setUser);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [registrationPhase, setRegistrationPhase] = useState<'input' | 'email-verify' | 'phone-verify'>('input');
  const [screenError, setScreenError] = useState<string | null>(null);
  const [screenSuccess, setScreenSuccess] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);

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

    if (message.toLowerCase().includes('already registered') || 
        message.toLowerCase().includes('already in use') || 
        message.toLowerCase().includes('already exists') || 
        message.toLowerCase().includes('email_exists') || 
        message.toLowerCase().includes('email-already-in-use') ||
        message.toLowerCase().includes('phone number already exists') ||
        message.toLowerCase().includes('duplicate key')) {
      return 'An account with this email address or phone number already exists.';
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
    let clean = message.replace(/^Firebase:\s*/i, '');
    clean = clean.replace(/^Error:\s*/i, '');
    clean = clean.replace(/\(auth\/[^)]+\)\.?/g, '');
    return clean.trim();
  };
  
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(false);
  const recaptchaVerifier = useRef<any>(null);
  const [verificationId, setVerificationId] = useState('');
  const [otp, setOtp] = useState('');

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

  const step1Mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        email,
        phone,
        phoneNumber: phone,
        sports: selectedSports,
        referralCode: referralCode || undefined
      };
      const response = await api.post('/auth/coach/register-step1', payload);
      return response.data;
    },
    onSuccess: () => {
      setScreenError(null);
      startEmailVerification();
    },
    onError: (error: any) => {
      setScreenError(sanitizeErrorMessage(error));
    }
  });

  const startEmailVerification = async () => {
    setRegistrationPhase('email-verify');
    setIsFirebaseLoading(true);
    setScreenError(null);
    setScreenSuccess(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      setIsFirebaseLoading(false);
      setScreenSuccess("Please check your inbox and click the verification link.");
    } catch (err: any) {
      setIsFirebaseLoading(false);
      setScreenError(sanitizeErrorMessage(err.message));
    }
  };

  useEffect(() => {
    let interval: any;
    if (registrationPhase === 'email-verify') {
      interval = setInterval(async () => {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            clearInterval(interval);
            try {
              const idToken = await getIdToken(auth.currentUser, true);
              verifyFirebaseMutation.mutate(idToken);
            } catch (err: any) {
              setScreenError(sanitizeErrorMessage(err.message));
            }
          }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [registrationPhase]);

  const sendPhoneOtp = async () => {
    if (!phone) {
      setScreenError('Phone number is required.');
      return;
    }
    setScreenError(null);
    setScreenSuccess(null);
    try {
      setIsFirebaseLoading(true);
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      const provider = new PhoneAuthProvider(auth);
      const vId = await provider.verifyPhoneNumber(formattedPhone, recaptchaVerifier.current);
      setVerificationId(vId);
      setIsFirebaseLoading(false);
      setScreenSuccess('Check your messages for the OTP verification code.');
      setRegistrationPhase('phone-verify');
    } catch (err: any) {
      setIsFirebaseLoading(false);
      setScreenError(sanitizeErrorMessage(err.message));
    }
  };

  const verifyPhoneAndLink = async () => {
    if (!otp) return;
    try {
      setIsFirebaseLoading(true);
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      if (auth.currentUser) {
        await linkWithCredential(auth.currentUser, credential);
        const idToken = await getIdToken(auth.currentUser, true);
        verifyFirebaseMutation.mutate(idToken);
      } else {
        throw new Error("No user is currently signed in to link credentials.");
      }
    } catch (err: any) {
      setIsFirebaseLoading(false);
      setScreenError(sanitizeErrorMessage(err.message));
    }
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

  const directRegisterMutation = useMutation({
    mutationFn: async () => {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '.';
      
      const payload = {
        firstName,
        lastName,
        email,
        phone,
        password,
        location: location.trim(),
        address: location.trim(),
        role: role === 'individual' ? 'player' : 'parent'
      };
      const response = await api.post('/auth/register', payload);
      return response.data;
    },
    onSuccess: async (data) => {
      try {
        const loginResponse = await api.post('/auth/login', {
          email,
          password
        });
        const loginData = loginResponse.data;
        const realToken = loginData.token || loginData.jwt || loginData.access_token || (loginData.data && loginData.data.token);
        setToken(realToken);
        const userObj = loginData.user || loginData.data?.user;
        setUser({
          id: userObj?._id || loginData.data?.user?._id || '1',
          name: name || '',
          phone: phone || '',
          email: email || '',
          location: location || '',
          role: (role as any) || 'parent',
          status: 'active',
          isRegistered: true,
        });
        setShowWelcomeModal(true);
      } catch (loginError) {
        setUser({
          id: '1',
          name: name || '',
          phone: phone || '',
          email: email || '',
          location: location || '',
          role: (role as any) || 'parent',
          status: 'active',
          isRegistered: true,
        });
        setShowWelcomeModal(true);
      }
    },
    onError: (error: any) => {
      setScreenError(sanitizeErrorMessage(error));
    }
  });

  const verifyFirebaseMutation = useMutation({
    mutationFn: async (idToken: string) => {
      const response = await api.post('/auth/coach/verify-firebase', {
        firebaseIdToken: idToken,
        name,
        phone,
        phoneNumber: phone,
        email,
        sports: selectedSports
      });
      return response.data;
    },
    onSuccess: async (data) => {
      const realToken = data.token || data.jwt || data.access_token || (data.data && data.data.token);
      setToken(realToken);
      const userObj = data.user || data.data?.user;
      const userPhone = userObj?.phone || userObj?.phoneNumber || phone || '';
      setUser({
        id: userObj?._id || data.data?.user?._id || '1',
        name: name || '',
        phone: userPhone,
        email: email || '',
        role: (role as any) || 'coach',
        status: 'pending',
        isRegistered: true,
      });
      router.push({ pathname: '/(coach)/onboarding', params: { role } });
    },
    onError: (error: any) => {
      setScreenError(sanitizeErrorMessage(error?.response?.data?.message || 'Final verification failed'));
    }
  });

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
      const passError = validatePassword(val);
      if (passError) err = passError;
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

  const handleInitialSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Full name is required';
    
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (phone.trim().length < 10) {
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
    
    if (role === 'coach' && selectedSports.length === 0) {
      newErrors.sports = 'Please select at least one sport';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setScreenError(null);
    setScreenSuccess(null);

    if (role === 'coach') {
      step1Mutation.mutate();
    } else {
      directRegisterMutation.mutate();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">

        <View className="px-6 py-4 z-10">
          <TouchableOpacity onPress={() => {
            if (registrationPhase !== 'input') {
              setRegistrationPhase('input'); 
            } else if (router.canGoBack()) {
              router.back();
            } else {
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
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 80, 100) }}
        >
          
          {screenError && (
            <View className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex-row items-start shadow-sm animate-fade-in">
              <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5 mt-0.5" />
              <View className="flex-1">
                <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-red-800">
                  Registration Error
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
                {registrationPhase === 'email-verify' && "Verify your Email Address"}
                {registrationPhase === 'phone-verify' && "Verify your Phone Number"}
              </Typography>
            </View>
          )}

          {role === 'coach' && registrationPhase === 'input' && (
            <View className="flex-row justify-between items-center mb-6">
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

          {registrationPhase === 'email-verify' && (
             <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 items-center">
               <Ionicons name="mail-unread-outline" size={48} color="#FF5722" className="mb-4" />
               <Typography variant="h2" color="secondary" weight="bold" className="mb-2 text-center font-outfit-bold">
                 Check Your Email
               </Typography>
               <Typography variant="body2" color="muted" className="text-center mb-6 font-outfit">
                 We've sent a verification link to {email}. Please click the link to verify your account.
               </Typography>
               <ActivityIndicator size="large" color="#FF5722" />
               <Typography variant="caption" color="primary" weight="bold" className="mt-4 font-outfit-bold">
                 {verifyFirebaseMutation.isPending ? "Finalizing registration..." : "Waiting for verification..."}
               </Typography>
             </View>
          )}

          {registrationPhase === 'phone-verify' && (
            <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
              <View className="items-center mb-6">
                <Ionicons name="phone-portrait-outline" size={48} color="#FF5722" className="mb-2" />
                <Typography variant="h2" color="secondary" weight="bold" className="mb-2 text-center font-outfit-bold">
                  Verify Phone
                </Typography>
                <Typography variant="body2" color="muted" className="text-center font-outfit">
                  We need to verify {phone} to secure your coach profile.
                </Typography>
              </View>

              {!verificationId ? (
                <Button 
                  title="Send SMS Code" 
                  onPress={sendPhoneOtp} 
                  isLoading={isFirebaseLoading}
                />
              ) : (
                <View>
                  <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-2 font-outfit-bold">Enter OTP</Typography>
                  <TextInput 
                    placeholder="_ _ _ _ _ _" 
                    value={otp} 
                    onChangeText={setOtp} 
                    keyboardType="number-pad" 
                  />
                  <View className="mt-4">
                    <Button 
                      title="Verify & Complete Registration" 
                      onPress={verifyPhoneAndLink} 
                      isLoading={isFirebaseLoading || verifyFirebaseMutation.isPending} 
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          <View className="mb-12">
            {registrationPhase === 'input' && (
              <Button 
                title="Continue" 
                isLoading={step1Mutation.isPending || directRegisterMutation.isPending}
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
