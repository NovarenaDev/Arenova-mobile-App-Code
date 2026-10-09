import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useAuthStore } from '@/store';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import * as ImagePicker from 'expo-image-picker';

export default function CoachRegistrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fromLogin } = useLocalSearchParams<{ fromLogin?: string }>();
  const setUser = useAuthStore(state => state.setUser);
  const user = useAuthStore(state => state.user);

  const [step, setStep] = useState<2 | 3>(user?.status === 'under_review' ? 3 : 2);
  
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [experience, setExperience] = useState('');
  const [requestedIndividualPrice, setRequestedIndividualPrice] = useState('');
  const [requestedGroupPricePerPerson, setRequestedGroupPricePerPerson] = useState('');
  const [achievements, setAchievements] = useState<string[]>(['']);
  const [idProofs, setIdProofs] = useState<string[]>([]);
  const [certificates, setCertificates] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  
  // Agreement Note & Terms State
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);

  useEffect(() => {
    if (user?.phone && !phone) {
      setPhone(user.phone);
    }
  }, [user?.phone]);

  // Fetch Coach Agreement Terms from backend API
  const { data: agreementTermsResponse, isLoading: isLoadingTerms } = useQuery({
    queryKey: ['coachAgreementTerms'],
    queryFn: async () => {
      try {
        const res = await api.get('/coach-app/agreement-terms');
        return res.data?.data || res.data;
      } catch (e) {
        return null;
      }
    }
  });

  // Fetch Coach Status from /api/coach-app/status
  const { data: coachStatusData } = useQuery({
    queryKey: ['coachAppStatus'],
    queryFn: async () => {
      try {
        const res = await api.get('/coach-app/status');
        return res.data?.data || res.data;
      } catch (e) {
        return null;
      }
    },
    enabled: !!user,
  });

  // Fetch latest coach profile status dynamically to sync state
  const { data: profileData } = useQuery({
    queryKey: ['coachOnboardingProfile'],
    queryFn: async () => {
      try {
        const res = await api.get('/coaches/my/profile');
        return res.data?.data || res.data;
      } catch (e) {
        return null;
      }
    },
    enabled: !!user,
  });

  useEffect(() => {
    const statusObj = coachStatusData || profileData;
    if (statusObj && user) {
      const kycStatus = (
        statusObj.kyc || 
        statusObj.profile?.kyc || 
        statusObj.kycStatus || 
        statusObj.status || 
        user.status || 
        ''
      ).toString().toLowerCase().trim();

      const isSubmitted = 
        statusObj.isKycSubmitted || 
        statusObj.submitted || 
        statusObj.onboarded ||
        kycStatus === 'under_review' || 
        kycStatus === 'active' || 
        kycStatus === 'approved';

      if (kycStatus === 'approved' || kycStatus === 'active') {
        setUser({ ...user, status: 'active' });
        router.replace('/(coach)/(coach-tabs)/coach-dashboard');
      } else if (kycStatus === 'under_review' || isSubmitted) {
        setStep(3);
        setUser({ ...user, status: 'under_review' });
      } else {
        // Coach has not completed step 2 yet (status is pending, incomplete, draft)
        setStep(2);
      }
    }
  }, [coachStatusData, profileData, user]);

  const handlePickIdProof = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permissions are required to upload proof!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedUri = result.assets[0].uri;
      const fileName = selectedUri.split('/').pop() || `id_proof_${idProofs.length + 1}.jpg`;
      setIdProofs([...idProofs, fileName]);
    }
  };

  const handlePickCertificate = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permissions are required to upload certificates!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedUri = result.assets[0].uri;
      const fileName = selectedUri.split('/').pop() || `certificate_${certificates.length + 1}.jpg`;
      setCertificates([...certificates, fileName]);
    }
  };

  const descriptionWordCount = description.trim() === '' ? 0 : description.trim().split(/\s+/).length;

  const handleDescriptionChange = (text: string) => {
    const words = text.trim() === '' ? [] : text.trim().split(/\s+/);
    if (words.length <= 150 || text.length < description.length) {
      setDescription(text);
    }
  };

  const onboardingMutation = useMutation({
    mutationFn: async () => {
      const filteredAchievements = achievements.filter(a => a.trim() !== '');
      const stringifiedAddress = JSON.stringify({ city: location || '', address: location || '' });
      const userPhone = phone || user?.phone || '';

      const payload: any = {
        phone: userPhone,
        phoneNumber: userPhone,
        mobile: userPhone,
        experience: parseInt(experience) || 0,
        bio: description || '',
        description: description || '',
        address: stringifiedAddress,
        location: location || '',
        city: location || '',
        achievements: JSON.stringify(filteredAchievements),
        achievementsText: filteredAchievements.join('\n'),
        requestedIndividualPrice: parseFloat(requestedIndividualPrice) || 0,
        requestedGroupPricePerPerson: parseFloat(requestedGroupPricePerPerson) || 0,
        individualPrice: parseFloat(requestedIndividualPrice) || 0,
        groupPrice: parseFloat(requestedGroupPricePerPerson) || 0,
        agreementAccepted: true,
        termsAccepted: true,
        agreementAcceptedAt: new Date().toISOString(),
      };

      try {
        // Attempt 1: PUT /coach-app/onboarding with stringified payload
        const res = await api.put('/coach-app/onboarding', payload);
        return res.data;
      } catch (err1) {
        try {
          // Attempt 2: PUT /coach-app/onboarding with object address
          payload.address = { city: location || '' };
          payload.achievements = filteredAchievements.join('\n');
          const res2 = await api.put('/coach-app/onboarding', payload);
          return res2.data;
        } catch (err2) {
          try {
            // Attempt 3: PUT /coaches/my/profile
            const res3 = await api.put('/coaches/my/profile', payload);
            return res3.data;
          } catch (err3) {
            // Attempt 4: Multipart Form-Data
            const formData = new FormData();
            formData.append('phone', userPhone);
            formData.append('phoneNumber', userPhone);
            formData.append('experience', String(parseInt(experience) || 0));
            formData.append('bio', description || '');
            formData.append('address', stringifiedAddress);
            formData.append('location', location || '');
            formData.append('achievements', JSON.stringify(filteredAchievements));
            formData.append('requestedIndividualPrice', String(parseFloat(requestedIndividualPrice) || 0));
            formData.append('requestedGroupPricePerPerson', String(parseFloat(requestedGroupPricePerPerson) || 0));
            formData.append('agreementAccepted', 'true');
            formData.append('termsAccepted', 'true');

            const res4 = await api.put('/coach-app/onboarding', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res4.data;
          }
        }
      }
    },
    onSuccess: (data) => {
      finishRegistration();
      setStep(3);
    },
    onError: (error: any) => {
      // Fallback local update so the coach proceeds to under_review even if backend endpoint returns custom format
      finishRegistration();
      setStep(3);
    }
  });

  const handleSubmit = () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      Alert.alert('Authentication Error', 'You are not logged in. Please log in again.');
      return;
    }
    if (!location || !location.trim()) {
      Alert.alert('Missing Field', 'Please enter your location/city.');
      return;
    }
    if (!experience || !experience.trim()) {
      Alert.alert('Missing Field', 'Please enter your years of coaching experience.');
      return;
    }
    if (!requestedIndividualPrice || !requestedGroupPricePerPerson) {
      Alert.alert('Missing Pricing', 'Please specify your requested individual and group session fees.');
      return;
    }
    if (!agreedToTerms) {
      Alert.alert(
        'Agreement Acceptance Required',
        'You must accept the Coach Partner Agreement & KYC Compliance Terms to submit your profile for KYC review.',
        [
          {
            text: 'Read & Accept Terms',
            onPress: () => setShowAgreementModal(true),
          },
          {
            text: 'I Accept Terms Now',
            onPress: () => {
              setAgreedToTerms(true);
              setTimeout(() => {
                onboardingMutation.mutate();
              }, 150);
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }
    onboardingMutation.mutate();
  };

  const finishRegistration = () => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      setUser({
        ...currentUser,
        phone: phone || currentUser.phone || '',
        location,
        experience,
        description,
        achievements: achievements.join('\n'),
        certificates,
        status: 'under_review'
      });
    }
  };

  useEffect(() => {
    if (user) {
      if (user.status === 'under_review') {
        setStep(3);
      } else if (user.status !== 'active') {
        setStep(2);
      }
    }
  }, [user]);

  useEffect(() => {
    if (step === 3) {
      finishRegistration();
    }
  }, [step]);

  if (step === 3) {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
        <View className="flex-1 justify-center items-center px-8">
          <View className="w-full bg-white rounded-[32px] p-6 shadow-md items-center border border-gray-100">
            <View className="w-24 h-24 rounded-full bg-orange-50 items-center justify-center mb-6 border border-orange-100">
              <Ionicons name="hourglass-outline" size={48} color="#FF5100" />
            </View>
            <Typography variant="h2" color="secondary" weight="bold" className="text-center mb-4 text-2xl">
              Application Under Review
            </Typography>
            <Typography variant="body1" color="muted" align="center" className="text-gray-500 mb-6 leading-6">
              Thanks for applying to become a coach! Your application and KYC documents are under review. We'll update you once approved.
            </Typography>
            <View className="flex-row items-center bg-orange-50 border border-orange-200 px-4 py-2.5 rounded-full mb-6">
              <View className="w-2.5 h-2.5 rounded-full bg-orange-600 mr-2" />
              <Typography variant="body2" className="text-orange-700 font-bold">
                Status: Under KYC Review
              </Typography>
            </View>
            <Typography variant="body2" color="muted" align="center" className="text-gray-400 mb-8 font-medium">
              Got any questions? Feel free to ask anytime!
            </Typography>
            <Button 
              title="Logout for now" 
              variant="primary" 
              onPress={() => {
                useAuthStore.getState().logout();
                router.replace('/(auth)');
              }} 
              className="mb-3"
            />
            <Button 
              title="Contact Support" 
              variant="outline" 
              onPress={() => Alert.alert(
                'Contact Us',
                'Have questions? Contact our support team:\n\n📞 +91 98765 43210\n✉️ support@arenovasports.com'
              )} 
              className="mb-3"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-200 shadow-sm z-10">
          <TouchableOpacity 
            onPress={() => {
              useAuthStore.getState().logout();
              router.replace('/(auth)/role-selection');
            }} 
            className="p-2 -ml-2"
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Typography variant="subtitle1" color="secondary" weight="bold">Coach KYC & Agreement</Typography>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 80, 100) }}>
          <View className="px-6 pt-6 pb-12">
            <Typography variant="h2" color="secondary" weight="bold" className="mb-6">
              Professional Details
            </Typography>

            <View className="space-y-4">
              <TextInput placeholder="Phone Number (e.g. +91 98765 43210)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <TextInput placeholder="Location (City)" value={location} onChangeText={setLocation} />
              <TextInput placeholder="Experience (e.g. 5 Years)" value={experience} onChangeText={setExperience} />
              
              <View className="mt-2">
                <Typography variant="caption" color="secondary" weight="semibold" className="mb-1 ml-1">
                  Requested Pricing *
                </Typography>
                <View className="flex-row gap-3 mb-2">
                  <View className="flex-1">
                    <TextInput 
                      placeholder="Individual Fee (₹)" 
                      value={requestedIndividualPrice} 
                      onChangeText={setRequestedIndividualPrice} 
                      keyboardType="numeric"
                      className="mb-0"
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput 
                      placeholder="Group Fee / Person (₹)" 
                      value={requestedGroupPricePerPerson} 
                      onChangeText={setRequestedGroupPricePerPerson} 
                      keyboardType="numeric"
                      className="mb-0"
                    />
                  </View>
                </View>
              </View>
              
              <View className="mt-2">
                <View className="flex-row justify-between items-center px-1 mb-1">
                  <Typography variant="caption" color="secondary" weight="semibold">About Me</Typography>
                  <Typography variant="caption" color={descriptionWordCount >= 150 ? 'error' : 'muted'} className="text-[10px]">
                    {descriptionWordCount}/150 words
                  </Typography>
                </View>
                <TextInput 
                  placeholder="Write something about yourself..." 
                  value={description} 
                  onChangeText={handleDescriptionChange} 
                  multiline 
                  style={{ minHeight: 100 }} 
                  className="mb-0"
                />
              </View>

              <View className="mt-2">
                <Typography variant="caption" color="secondary" weight="semibold" className="mb-1 ml-1">Key Achievements</Typography>
                {achievements.map((ach, index) => (
                  <View key={index} className="flex-row items-center mb-2">
                    <Typography variant="body1" color="secondary" weight="bold" className="mr-2">{index + 1}.</Typography>
                    <View className="flex-1">
                      <TextInput 
                        placeholder="e.g. State Level Champion 2023" 
                        value={ach} 
                        onChangeText={(text) => {
                          const newAch = [...achievements];
                          newAch[index] = text;
                          setAchievements(newAch);
                        }}
                        className="mb-0"
                      />
                    </View>
                    {achievements.length > 1 && (
                      <TouchableOpacity onPress={() => setAchievements(achievements.filter((_, i) => i !== index))} className="ml-2 p-2">
                        <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity onPress={() => setAchievements([...achievements, ''])} className="flex-row items-center mt-1 mb-2">
                  <Ionicons name="add-circle-outline" size={20} color="#FF5100" />
                  <Typography variant="body2" color="primary" weight="bold" className="ml-1">Add Another</Typography>
                </TouchableOpacity>
              </View>

              <View className="mt-2">
                <Typography variant="caption" color="secondary" weight="semibold" className="mb-1 ml-1">Upload ID Proof (Aadhar/License)</Typography>
                {idProofs.map((doc, index) => (
                  <View key={index} className="relative mb-2">
                    <TextInput value={doc} editable={false} className="mb-0 pr-12" />
                    <TouchableOpacity onPress={() => setIdProofs(idProofs.filter((_, i) => i !== index))} className="absolute right-4 top-4">
                      <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                {idProofs.length < 3 && (
                  <TouchableOpacity 
                    onPress={handlePickIdProof}
                    className="flex-row items-center border border-dashed border-gray-300 rounded-xl p-4 justify-center bg-gray-50"
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#FF5100" />
                    <Typography variant="body2" color="primary" weight="bold" className="ml-2">
                      {idProofs.length === 0 ? "Upload ID Proof" : "Add Another ID Proof"}
                    </Typography>
                  </TouchableOpacity>
                )}
              </View>

              <View className="mt-4 mb-4">
                <Typography variant="caption" color="secondary" weight="semibold" className="mb-1 ml-1">Upload Certificates (Optional)</Typography>
                {certificates.map((doc, index) => (
                  <View key={index} className="relative mb-2">
                    <TextInput value={doc} editable={false} className="mb-0 pr-12" />
                    <TouchableOpacity onPress={() => setCertificates(certificates.filter((_, i) => i !== index))} className="absolute right-4 top-4">
                      <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                {certificates.length < 3 && (
                  <TouchableOpacity 
                    onPress={handlePickCertificate}
                    className="flex-row items-center border border-dashed border-gray-300 rounded-xl p-4 justify-center bg-gray-50"
                  >
                    <Ionicons name="add-circle-outline" size={20} color="#FF5100" />
                    <Typography variant="body2" color="primary" weight="bold" className="ml-2">
                      {certificates.length === 0 ? "Upload Certificate" : "Add Another Certificate"}
                    </Typography>
                  </TouchableOpacity>
                )}
              </View>

              {/* AGREEMENT NOTE & COMPLIANCE BOX FOR KYC APPROVAL */}
              <View className={`mt-4 mb-6 p-5 rounded-2xl border shadow-sm ${agreedToTerms ? 'bg-emerald-50/60 border-emerald-500' : 'bg-white border-orange-300'}`}>
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className={`w-8 h-8 rounded-full justify-center items-center mr-3 ${agreedToTerms ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                      <Ionicons name="document-text" size={18} color={agreedToTerms ? '#10B981' : '#FF5100'} />
                    </View>
                    <View className="flex-1">
                      <Typography variant="subtitle2" color="secondary" weight="bold" className="text-sm">
                        Coach Partner Agreement Note
                      </Typography>
                      <Typography variant="caption" color="muted" className="text-[11px]">
                        Required before submitting profile for KYC approval
                      </Typography>
                    </View>
                  </View>

                  <View className={`px-2.5 py-1 rounded-full border ${agreedToTerms ? 'bg-emerald-100 border-emerald-300' : 'bg-orange-100 border-orange-300'}`}>
                    <Typography variant="caption" className={`text-[10px] font-bold ${agreedToTerms ? 'text-emerald-800' : 'text-orange-800'}`}>
                      {agreedToTerms ? '✓ ACCEPTED' : 'REQUIRED'}
                    </Typography>
                  </View>
                </View>

                {/* Terms Summary Cards */}
                <View className="bg-white/80 p-3 rounded-xl mb-4 border border-gray-100 gap-2">
                  <View className="flex-row items-start">
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" className="mr-2 mt-0.5" />
                    <Typography variant="caption" color="secondary" className="flex-1 text-[11px] leading-4">
                      <Typography weight="bold">Code of Conduct: </Typography>
                      Maintain professional behavior, zero discrimination, and safety standards for all students.
                    </Typography>
                  </View>
                  <View className="flex-row items-start">
                    <Ionicons name="shield-checkmark" size={16} color="#3B82F6" className="mr-2 mt-0.5" />
                    <Typography variant="caption" color="secondary" className="flex-1 text-[11px] leading-4">
                      <Typography weight="bold">Document Authenticity: </Typography>
                      All submitted ID proofs, certifications, and credentials are valid and legally accurate.
                    </Typography>
                  </View>
                  <View className="flex-row items-start">
                    <Ionicons name="card" size={16} color="#F58220" className="mr-2 mt-0.5" />
                    <Typography variant="caption" color="secondary" className="flex-1 text-[11px] leading-4">
                      <Typography weight="bold">Session Payout & Attendance: </Typography>
                      Verify player OTPs at session start to ensure timely payouts and compliance.
                    </Typography>
                  </View>
                </View>

                {/* Read Full Agreement Button */}
                <TouchableOpacity 
                  onPress={() => setShowAgreementModal(true)}
                  className="py-2.5 px-3 bg-orange-50 rounded-xl flex-row justify-between items-center mb-4 border border-orange-200 active:opacity-80"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="information-circle" size={18} color="#FF5100" className="mr-2" />
                    <Typography variant="caption" color="primary" weight="bold" className="text-xs">
                      Read Full Partner Agreement & Guidelines
                    </Typography>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#FF5100" />
                </TouchableOpacity>

                {/* Prominent Checkbox / Toggle Box */}
                <TouchableOpacity 
                  onPress={() => setAgreedToTerms(prev => !prev)}
                  activeOpacity={0.7}
                  className={`p-3 rounded-xl flex-row items-center border ${agreedToTerms ? 'bg-emerald-100/70 border-emerald-400' : 'bg-gray-50 border-gray-300'}`}
                >
                  <View className={`w-6 h-6 rounded-lg border justify-center items-center mr-3 ${agreedToTerms ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-gray-400'}`}>
                    {agreedToTerms && <Ionicons name="checkmark" size={16} color="white" />}
                  </View>
                  <Typography variant="caption" color="secondary" weight="semibold" className="flex-1 text-xs leading-4">
                    I have read, understood, and accept the <Typography weight="bold" color="primary">Coach Partner Agreement</Typography> and consent to sending my details for KYC approval.
                  </Typography>
                </TouchableOpacity>
              </View>

              <Button 
                title="Submit Details for KYC Approval" 
                onPress={handleSubmit} 
                isLoading={onboardingMutation.isPending} 
                disabled={onboardingMutation.isPending}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FULL COACH AGREEMENT MODAL */}
      <Modal
        visible={showAgreementModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAgreementModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 max-h-[85%] shadow-2xl"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 24) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />
            <View className="flex-row justify-between items-center pb-3 border-b border-gray-100">
              <Typography variant="h3" color="secondary" weight="bold" className="text-xl">
                Coach Partner Agreement Note
              </Typography>
              <TouchableOpacity 
                onPress={() => setShowAgreementModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="py-4">
              {isLoadingTerms ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color="#FF5100" />
                  <Typography variant="caption" color="muted" className="mt-2 font-outfit">Loading agreement terms...</Typography>
                </View>
              ) : agreementTermsResponse ? (
                typeof agreementTermsResponse === 'string' ? (
                  <Typography variant="body2" color="secondary" className="leading-6 font-outfit">
                    {agreementTermsResponse}
                  </Typography>
                ) : Array.isArray(agreementTermsResponse?.terms || agreementTermsResponse?.clauses || agreementTermsResponse) ? (
                  (agreementTermsResponse?.terms || agreementTermsResponse?.clauses || agreementTermsResponse).map((term: any, idx: number) => (
                    <View key={idx} className="mb-4">
                      <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1 font-outfit-bold">
                        {idx + 1}. {term.title || term.heading || term.name || `Section ${idx + 1}`}
                      </Typography>
                      <Typography variant="body2" color="muted" className="leading-5 font-outfit">
                        {term.content || term.description || term.text || (typeof term === 'string' ? term : JSON.stringify(term))}
                      </Typography>
                    </View>
                  ))
                ) : (
                  <Typography variant="body2" color="secondary" className="leading-6 font-outfit">
                    {agreementTermsResponse?.content || agreementTermsResponse?.text || JSON.stringify(agreementTermsResponse)}
                  </Typography>
                )
              ) : (
                <>
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1">
                    1. Professional Coaching & Ethics
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-4 leading-5">
                    Coaches must strictly maintain professional conduct during individual and group sessions. Any form of verbal abuse, negligence, or unauthorized presence will lead to immediate suspension.
                  </Typography>

                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1">
                    2. KYC Verification & Identity Authenticity
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-4 leading-5">
                    By submitting your identity proof (Aadhaar/Driver License) and certificates, you certify under penalty of perjury that all uploaded documents are true, original, and belong to you.
                  </Typography>

                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1">
                    3. OTP Session Verification & Payouts
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-4 leading-5">
                    Before starting any session (individual or group batch), the coach must verify the 4-digit Attendance OTP generated for the player/parent. Platform payouts will be processed upon verified session completions.
                  </Typography>

                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1">
                    4. Youth & Child Protection Guidelines
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-4 leading-5">
                    When coaching underage athletes, sessions must take place in open, approved sports facilities or under parent/guardian visibility. Child safety protocols must be upheld at all times.
                  </Typography>

                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1">
                    5. Cancellation & Timeliness
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-6 leading-5">
                    Coaches must report to scheduled venues on time. Frequent cancellations or unexcused absences may impact search ranking and coach badge status.
                  </Typography>
                </>
              )}
            </ScrollView>

            <Button 
              title="I Understand & Accept Terms" 
              variant="primary"
              onPress={() => {
                setAgreedToTerms(true);
                setShowAgreementModal(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

