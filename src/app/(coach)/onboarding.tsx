import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useAuthStore } from '@/store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import * as ImagePicker from 'expo-image-picker';

interface LocalFile {
  id: string;
  uri: string;
  name: string;
  type: string;
  documentType: 'aadhaar' | 'certificate' | 'pan' | 'passport' | 'other';
}

export default function CoachOnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { location: paramLocation, phone: paramPhone, email: paramEmail } = useLocalSearchParams<{ 
    location?: string;
    phone?: string;
    email?: string;
  }>();

  const setUser = useAuthStore(state => state.setUser);
  const user = useAuthStore(state => state.user);

  // Screen modes: 'form' | 'under_review' | 'rejected'
  const [screenMode, setScreenMode] = useState<'form' | 'under_review' | 'rejected'>('form');
  const [rejectionNote, setRejectionNote] = useState<string>('');
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Form Fields
  const [email, setEmail] = useState(paramEmail || user?.email || '');
  const [phone, setPhone] = useState(paramPhone || user?.phone || '');
  const [experience, setExperience] = useState('');
  const [bio, setBio] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState(paramLocation || user?.location || '');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [requestedIndividualPrice, setRequestedIndividualPrice] = useState('');
  const [requestedGroupPricePerPerson, setRequestedGroupPricePerPerson] = useState('');
  const [achievements, setAchievements] = useState<string[]>(['']);
  const [selectedFiles, setSelectedFiles] = useState<LocalFile[]>([]);

  // Agreement Terms Dialog State
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [isFetchingTerms, setIsFetchingTerms] = useState(false);
  const [agreementData, setAgreementData] = useState<{ title: string; text: string }>({
    title: 'Coach Agreement',
    text: ''
  });

  // Query 1: Fetch Coach App Status
  const { data: coachStatusData, refetch: refetchStatus } = useQuery({
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

  // Query 2: Fetch Coach Profile (to prefill existing data)
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

  // Query 3: Fetch Agreement Terms
  const { data: termsQueryData } = useQuery({
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

  // Determine initial screen from status
  useEffect(() => {
    const statusObj = coachStatusData;
    if (statusObj) {
      const kyc = (statusObj.kyc || statusObj.status || '').toString().toLowerCase().trim();
      const screen = (statusObj.screen || '').toString().toLowerCase().trim();
      const note = statusObj.kycNote || statusObj.reason || '';

      if (kyc === 'approved' || screen === 'dashboard') {
        if (user) setUser({ ...user, status: 'active' });
        router.replace('/(coach)/(coach-tabs)/coach-dashboard');
      } else if (kyc === 'under_review' || screen === 'under_review') {
        setScreenMode('under_review');
        if (user) setUser({ ...user, status: 'under_review' });
      } else if (kyc === 'rejected' || screen === 'rejected') {
        setRejectionNote(note);
        setScreenMode('rejected');
      } else {
        setScreenMode('form');
      }
    }
  }, [coachStatusData]);

  // Prefill details from profileData
  useEffect(() => {
    if (profileData) {
      if (profileData.email && !email) setEmail(profileData.email);
      if (profileData.phone && !phone) setPhone(profileData.phone);
      if (profileData.name && user && !user.name) setUser({ ...user, name: profileData.name });

      const prof = profileData.profile || profileData;
      if (prof.experience && !experience) setExperience(String(prof.experience));
      if (prof.bio && !bio) setBio(prof.bio);
      if (prof.description && !bio) setBio(prof.description);

      if (prof.requestedIndividualPrice && !requestedIndividualPrice) {
        setRequestedIndividualPrice(String(prof.requestedIndividualPrice));
      }
      if (prof.requestedGroupPricePerPerson && !requestedGroupPricePerPerson) {
        setRequestedGroupPricePerPerson(String(prof.requestedGroupPricePerPerson));
      }

      if (Array.isArray(prof.achievements) && prof.achievements.length > 0) {
        setAchievements(prof.achievements);
      }

      const rawAddr = prof.address || profileData.address || profileData.location;
      if (rawAddr) {
        if (typeof rawAddr === 'object') {
          if (rawAddr.line1 && !addressLine1) setAddressLine1(rawAddr.line1);
          if (rawAddr.city && !city) setCity(rawAddr.city);
          if (rawAddr.state && !stateName) setStateName(rawAddr.state);
          if (rawAddr.pincode && !pincode) setPincode(rawAddr.pincode);
        } else if (typeof rawAddr === 'string') {
          try {
            const parsed = JSON.parse(rawAddr);
            if (parsed.line1 && !addressLine1) setAddressLine1(parsed.line1);
            if (parsed.city && !city) setCity(parsed.city);
            if (parsed.state && !stateName) setStateName(parsed.state);
            if (parsed.pincode && !pincode) setPincode(parsed.pincode);
          } catch {
            if (!city) setCity(rawAddr);
          }
        }
      }
    }
  }, [profileData]);

  // Sync agreement terms
  useEffect(() => {
    if (termsQueryData) {
      setAgreementData({
        title: termsQueryData.title || 'Coach Agreement',
        text: termsQueryData.text || termsQueryData.content || ''
      });
    }
  }, [termsQueryData]);

  // File Picking
  const handlePickDocument = async (docType: 'aadhaar' | 'certificate' | 'pan' | 'passport' | 'other' = 'aadhaar') => {
    if (selectedFiles.length >= 5) {
      Alert.alert('Upload Limit', 'You can upload a maximum of 5 documents (up to 10 MB each).');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera roll access is required to upload KYC documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const uri = asset.uri;
      const fileName = asset.fileName || uri.split('/').pop() || `kyc_${Date.now()}.jpg`;
      const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');

      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Selected file exceeds the maximum 10 MB limit.');
        return;
      }

      const newDoc: LocalFile = {
        id: Math.random().toString(),
        uri,
        name: fileName,
        type: mimeType,
        documentType: docType
      };

      setSelectedFiles(prev => [...prev, newDoc]);
    }
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleChangeDocType = (id: string, type: 'aadhaar' | 'certificate' | 'pan' | 'passport' | 'other') => {
    setSelectedFiles(prev => prev.map(f => f.id === id ? { ...f, documentType: type } : f));
  };

  // Word count helper
  const wordCount = bio.trim() ? bio.trim().split(/\s+/).length : 0;
  const handleBioChange = (text: string) => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (words <= 150 || text.length < bio.length) {
      setBio(text);
    }
  };

  // Mutation to submit profile and KYC
  const submitProfileMutation = useMutation({
    mutationFn: async () => {
      const cleanEmail = email.trim().toLowerCase();
      const filteredAchievements = achievements.filter(a => a.trim() !== '');
      const fullAddress = {
        line1: addressLine1.trim() || city.trim(),
        city: city.trim(),
        state: stateName.trim() || city.trim(),
        pincode: pincode.trim() || '000000'
      };

      const formData = new FormData();
      formData.append('email', cleanEmail);
      formData.append('experience', String(Number(experience) || 0));
      formData.append('bio', bio.trim());
      formData.append('address', JSON.stringify(fullAddress));
      formData.append('achievements', JSON.stringify(filteredAchievements));
      formData.append('requestedIndividualPrice', String(Number(requestedIndividualPrice) || 0));
      formData.append('requestedGroupPricePerPerson', String(Number(requestedGroupPricePerPerson) || 0));
      formData.append('agreedToTerms', 'true');

      // Append selected files using 'documents' key
      selectedFiles.forEach((file) => {
        formData.append('documents', {
          uri: file.uri,
          name: file.name,
          type: file.type
        } as any);
      });

      // Match documentTypes to file order
      const docTypesOrder = selectedFiles.map(f => f.documentType).join(',');
      formData.append('documentTypes', docTypesOrder);

      const res = await api.put('/coach-app/onboarding', formData);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['coachAppStatus'] });
      queryClient.invalidateQueries({ queryKey: ['coachOnboardingProfile'] });
      if (user) {
        setUser({ ...user, status: 'under_review', email: email.trim().toLowerCase() });
      }
      setScreenMode('under_review');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to submit profile for review. Please try again.';
      Alert.alert('Submission Failed', msg);
    }
  });

  // Validation before opening Agreement Dialog
  const handleSubmitClick = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      Alert.alert('Email Required', 'Email address is mandatory for coach profile verification.');
      return;
    }
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w\w+)+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!experience.trim() || isNaN(Number(experience)) || Number(experience) < 0) {
      Alert.alert('Experience Required', 'Please enter your coaching experience in years.');
      return;
    }
    if (!bio.trim()) {
      Alert.alert('Bio Required', 'Please enter a brief coach bio (max 150 words).');
      return;
    }
    if (wordCount > 150) {
      Alert.alert('Bio Too Long', 'Bio must be at most 150 words.');
      return;
    }
    if (!city.trim()) {
      Alert.alert('City Required', 'Please specify your coaching city/location.');
      return;
    }
    if (!requestedIndividualPrice.trim() || Number(requestedIndividualPrice) <= 0) {
      Alert.alert('Pricing Required', 'Please enter a valid individual session fee.');
      return;
    }
    if (!requestedGroupPricePerPerson.trim() || Number(requestedGroupPricePerPerson) <= 0) {
      Alert.alert('Pricing Required', 'Please enter a valid group session fee per person.');
      return;
    }
    if (selectedFiles.length === 0) {
      Alert.alert('KYC Document Required', 'Please upload at least one KYC document (Aadhaar, Certificate, etc.).');
      return;
    }

    // Refresh agreement terms
    try {
      setIsFetchingTerms(true);
      const res = await api.get('/coach-app/agreement-terms');
      const termsObj = res.data?.data || res.data;
      if (termsObj) {
        setAgreementData({
          title: termsObj.title || 'Coach Agreement',
          text: termsObj.text || termsObj.content || ''
        });
      }
    } catch (e) {
      // Use fallback/cached terms
    } finally {
      setIsFetchingTerms(false);
    }

    setShowAgreementModal(true);
  };

  // SCREEN: UNDER REVIEW
  if (screenMode === 'under_review') {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
        <View className="flex-1 justify-center items-center px-6">
          <View className="w-full bg-white rounded-[32px] p-6 shadow-md items-center border border-gray-100">
            <View className="w-20 h-20 rounded-full bg-orange-50 items-center justify-center mb-5 border border-orange-200">
              <Ionicons name="hourglass-outline" size={40} color="#FF5100" />
            </View>

            <Typography variant="h2" color="secondary" weight="bold" className="text-center mb-2 text-2xl font-outfit-bold">
              Application Under Review
            </Typography>

            <Typography variant="body1" color="muted" align="center" className="text-gray-500 mb-6 leading-6 font-outfit">
              Thanks for submitting your coach application! Your profile and KYC documents are currently being reviewed by our admin team.
            </Typography>

            <View className="flex-row items-center bg-orange-50 border border-orange-200 px-4 py-2.5 rounded-full mb-6">
              <View className="w-2.5 h-2.5 rounded-full bg-orange-600 mr-2" />
              <Typography variant="body2" className="text-orange-700 font-bold font-outfit-bold">
                Status: Under KYC Review
              </Typography>
            </View>

            <Button 
              title="Check Approval Status" 
              variant="primary" 
              isLoading={isCheckingStatus}
              onPress={async () => {
                setIsCheckingStatus(true);
                try {
                  const res = await refetchStatus();
                  const data = res.data;
                  const kyc = (data?.kyc || data?.status || '').toString().toLowerCase();
                  const screen = (data?.screen || '').toString().toLowerCase();
                  if (kyc === 'approved' || screen === 'dashboard') {
                    if (user) setUser({ ...user, status: 'active' });
                    Alert.alert('Congratulations!', 'Your coach profile has been approved!');
                    router.replace('/(coach)/(coach-tabs)/coach-dashboard');
                  } else if (kyc === 'rejected' || screen === 'rejected') {
                    setRejectionNote(data?.kycNote || data?.reason || '');
                    setScreenMode('rejected');
                  } else {
                    Alert.alert('Status Update', 'Your application is still under review. We will notify you once approved.');
                  }
                } catch {
                  Alert.alert('Status Check', 'Your application is currently being reviewed by the admin team.');
                } finally {
                  setIsCheckingStatus(false);
                }
              }}
              className="mb-3 w-full"
            />

            <Button 
              title="Contact Support" 
              variant="outline" 
              onPress={() => Alert.alert(
                'Contact Support',
                'Have questions regarding verification?\n\n📞 +91 98765 43210\n✉️ support@arenovasports.com'
              )} 
              className="mb-3 w-full"
            />

            <TouchableOpacity 
              onPress={() => {
                useAuthStore.getState().logout();
                router.replace('/(auth)');
              }}
              className="py-2.5"
            >
              <Typography variant="body2" color="muted" weight="bold" className="font-outfit-bold">
                Log Out
              </Typography>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // SCREEN: REJECTED
  if (screenMode === 'rejected') {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
        <View className="flex-1 justify-center items-center px-6">
          <View className="w-full bg-white rounded-[32px] p-6 shadow-md items-center border border-gray-100">
            <View className="w-20 h-20 rounded-full bg-red-50 items-center justify-center mb-5 border border-red-200">
              <Ionicons name="alert-circle" size={44} color="#EF4444" />
            </View>

            <Typography variant="h2" color="secondary" weight="bold" className="text-center mb-2 text-2xl font-outfit-bold">
              Application Needs Revision
            </Typography>

            <Typography variant="body2" color="muted" align="center" className="text-gray-500 mb-5 leading-5 font-outfit">
              Our review team identified issues with your submission. Please check the feedback below, correct your information or documents, and resubmit for approval.
            </Typography>

            {/* Rejection Note Box */}
            <View className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
              <View className="flex-row items-center mb-1">
                <Ionicons name="information-circle" size={18} color="#EF4444" className="mr-2" />
                <Typography variant="subtitle2" weight="bold" className="text-red-800 font-outfit-bold">
                  Reviewer Reason:
                </Typography>
              </View>
              <Typography variant="body2" className="text-red-700 font-outfit leading-5 ml-6">
                {rejectionNote || 'Please upload clearer documents or correct your profile information.'}
              </Typography>
            </View>

            <Button 
              title="Update & Resubmit Profile" 
              variant="primary"
              onPress={() => setScreenMode('form')}
              className="mb-3 w-full"
            />

            <Button 
              title="Contact Support" 
              variant="outline" 
              onPress={() => Alert.alert(
                'Contact Support',
                'Have questions regarding your verification? Contact our support team:\n\n📞 +91 98765 43210\n✉️ support@arenovasports.com'
              )} 
              className="mb-3 w-full"
            />

            <TouchableOpacity 
              onPress={() => {
                useAuthStore.getState().logout();
                router.replace('/(auth)');
              }}
              className="py-2.5"
            >
              <Typography variant="body2" color="muted" weight="bold" className="font-outfit-bold">
                Log Out
              </Typography>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // SCREEN: PROFILE & KYC COMPLETION FORM
  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        {/* Header */}
        <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-200 shadow-sm z-10">
          <TouchableOpacity 
            onPress={() => {
              useAuthStore.getState().logout();
              router.replace('/(auth)/role-selection');
            }} 
            className="p-2 -ml-2"
          >
            <Ionicons name="arrow-back" size={24} color="#0F2C59" />
          </TouchableOpacity>
          <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
            Coach Profile & KYC
          </Typography>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled" 
          contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 80, 100) }}
        >
          <View className="px-6 pt-6 pb-12">
            <Typography variant="h2" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
              Complete Coach Profile
            </Typography>
            <Typography variant="body2" color="muted" className="mb-6 font-outfit">
              Fill in your professional coaching details and upload KYC documents for admin review.
            </Typography>

            <View className="space-y-4">
              {/* Mandatory Email */}
              <View>
                <Typography variant="caption" color="secondary" weight="bold" className="mb-1 ml-1 font-outfit-bold">
                  Email Address * (Mandatory for Profile Review)
                </Typography>
                <TextInput 
                  placeholder="coach@example.com" 
                  value={email} 
                  onChangeText={setEmail} 
                  keyboardType="email-address" 
                  autoCapitalize="none" 
                  className="mb-0"
                />
              </View>

              {/* Phone (Read Only) */}
              {phone ? (
                <View>
                  <Typography variant="caption" color="secondary" weight="bold" className="mb-1 ml-1 font-outfit-bold">
                    Registered Mobile Number
                  </Typography>
                  <TextInput 
                    placeholder="Phone Number" 
                    value={phone} 
                    editable={false} 
                    className="mb-0 bg-gray-100 text-gray-500" 
                  />
                </View>
              ) : null}

              {/* Experience in Years */}
              <View>
                <Typography variant="caption" color="secondary" weight="bold" className="mb-1 ml-1 font-outfit-bold">
                  Coaching Experience (Years) *
                </Typography>
                <TextInput 
                  placeholder="e.g. 5" 
                  value={experience} 
                  onChangeText={setExperience} 
                  keyboardType="numeric" 
                  className="mb-0" 
                />
              </View>

              {/* Address Details */}
              <View className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mt-1">
                <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-3 font-outfit-bold">
                  Address Details *
                </Typography>

                <TextInput 
                  label="Address Line 1"
                  placeholder="House, Flat or Street" 
                  value={addressLine1} 
                  onChangeText={setAddressLine1} 
                  className="mb-3"
                />

                <View className="flex-row gap-3 mb-3">
                  <View className="flex-1">
                    <TextInput 
                      label="City *"
                      placeholder="e.g. Hyderabad" 
                      value={city} 
                      onChangeText={setCity} 
                      className="mb-0"
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput 
                      label="State"
                      placeholder="e.g. Telangana" 
                      value={stateName} 
                      onChangeText={setStateName} 
                      className="mb-0"
                    />
                  </View>
                </View>

                <TextInput 
                  label="Pincode"
                  placeholder="e.g. 500001" 
                  value={pincode} 
                  onChangeText={setPincode} 
                  keyboardType="numeric" 
                  maxLength={6}
                  className="mb-0"
                />
              </View>

              {/* Requested Pricing */}
              <View className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mt-1">
                <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
                  Requested Session Pricing *
                </Typography>
                <Typography variant="caption" color="muted" className="mb-3 font-outfit">
                  Admin will review and approve your requested session fees.
                </Typography>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <TextInput 
                      label="Individual Fee (₹) *"
                      placeholder="e.g. 500" 
                      value={requestedIndividualPrice} 
                      onChangeText={setRequestedIndividualPrice} 
                      keyboardType="numeric"
                      className="mb-0"
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput 
                      label="Group Fee / Person (₹) *"
                      placeholder="e.g. 200" 
                      value={requestedGroupPricePerPerson} 
                      onChangeText={setRequestedGroupPricePerPerson} 
                      keyboardType="numeric"
                      className="mb-0"
                    />
                  </View>
                </View>
              </View>

              {/* Bio (Max 150 words) */}
              <View className="mt-2">
                <View className="flex-row justify-between items-center px-1 mb-1">
                  <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                    Bio / About Me *
                  </Typography>
                  <Typography variant="caption" color={wordCount > 150 ? 'error' : 'muted'} className="text-[11px] font-outfit">
                    {wordCount}/150 words
                  </Typography>
                </View>
                <TextInput 
                  placeholder="Tell clients about your background, training methods and certifications..." 
                  value={bio} 
                  onChangeText={handleBioChange} 
                  multiline 
                  style={{ minHeight: 100 }} 
                  className="mb-0"
                />
              </View>

              {/* Achievements */}
              <View className="mt-2">
                <Typography variant="caption" color="secondary" weight="bold" className="mb-1 ml-1 font-outfit-bold">
                  Achievements (Optional)
                </Typography>
                {achievements.map((ach, index) => (
                  <View key={index} className="flex-row items-center mb-2">
                    <Typography variant="body1" color="secondary" weight="bold" className="mr-2 font-outfit-bold">
                      {index + 1}.
                    </Typography>
                    <View className="flex-1">
                      <TextInput 
                        placeholder="e.g. Certified Coach / State Level Champion" 
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
                  <Typography variant="body2" color="primary" weight="bold" className="ml-1 font-outfit-bold">
                    Add Another Achievement
                  </Typography>
                </TouchableOpacity>
              </View>

              {/* KYC Documents (Local files, up to 5) */}
              <View className="mt-2 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <View className="flex-row justify-between items-center mb-1">
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                    KYC Documents * ({selectedFiles.length}/5 files)
                  </Typography>
                  <Typography variant="caption" color="muted" className="text-[11px] font-outfit">
                    Max 10 MB per file
                  </Typography>
                </View>
                <Typography variant="caption" color="muted" className="mb-3 font-outfit">
                  Upload identity proofs (Aadhaar, License) and sports coaching certificates. Files remain local until you accept the agreement.
                </Typography>

                {/* Selected Files List */}
                {selectedFiles.map((file, idx) => (
                  <View key={file.id} className="p-3 bg-gray-50 rounded-xl mb-3 border border-gray-200">
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center flex-1 mr-2">
                        <Ionicons name="document-attach" size={18} color="#FF5100" className="mr-2" />
                        <Typography variant="caption" weight="bold" color="secondary" className="font-outfit-bold truncate flex-1">
                          {file.name}
                        </Typography>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveFile(file.id)} className="p-1">
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Document Type Chips */}
                    <View className="flex-row items-center flex-wrap gap-1.5">
                      <Typography variant="caption" color="muted" className="text-[10px] mr-1">
                        Type:
                      </Typography>
                      {(['aadhaar', 'certificate', 'pan', 'passport', 'other'] as const).map(dt => (
                        <TouchableOpacity
                          key={dt}
                          onPress={() => handleChangeDocType(file.id, dt)}
                          className={`px-2 py-0.5 rounded-full border ${file.documentType === dt ? 'bg-[#FF5100] border-[#FF5100]' : 'bg-white border-gray-200'}`}
                        >
                          <Typography 
                            variant="caption" 
                            className={`text-[10px] font-bold capitalize ${file.documentType === dt ? 'text-white' : 'text-gray-600'}`}
                          >
                            {dt}
                          </Typography>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}

                {/* Add Document Buttons */}
                {selectedFiles.length < 5 && (
                  <View className="flex-row gap-2 mt-1">
                    <TouchableOpacity 
                      onPress={() => handlePickDocument(selectedFiles.length === 0 ? 'aadhaar' : 'certificate')}
                      className="flex-1 py-3 px-3 border border-dashed border-primary rounded-xl items-center justify-center bg-orange-50/50 flex-row"
                    >
                      <Ionicons name="add-circle-outline" size={18} color="#FF5100" />
                      <Typography variant="caption" color="primary" weight="bold" className="ml-1.5 font-outfit-bold">
                        Add Document / Certificate
                      </Typography>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Submit Button */}
              <View className="mt-4">
                <Button 
                  title="Submit Details for KYC Approval" 
                  onPress={handleSubmitClick} 
                  isLoading={submitProfileMutation.isPending || isFetchingTerms} 
                  disabled={submitProfileMutation.isPending || isFetchingTerms}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* AGREEMENT TERMS DIALOG MODAL */}
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
              <Typography variant="h3" color="secondary" weight="bold" className="text-xl font-outfit-bold">
                {agreementData.title || 'Coach Agreement'}
              </Typography>
              <TouchableOpacity 
                onPress={() => setShowAgreementModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="py-4">
              {agreementData.text ? (
                <Typography variant="body2" color="secondary" className="leading-6 font-outfit">
                  {agreementData.text}
                </Typography>
              ) : (
                <>
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1 font-outfit-bold">
                    1. Professional Coaching & Ethics
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-4 leading-5 font-outfit">
                    Coaches must strictly maintain professional conduct during individual and group sessions. Any form of verbal abuse, negligence, or unauthorized presence will lead to immediate suspension.
                  </Typography>

                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1 font-outfit-bold">
                    2. KYC Verification & Identity Authenticity
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-4 leading-5 font-outfit">
                    By submitting your identity proof (Aadhaar/Driver License) and certificates, you certify under penalty of perjury that all uploaded documents are true, original, and belong to you.
                  </Typography>

                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1 font-outfit-bold">
                    3. OTP Session Verification & Payouts
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-4 leading-5 font-outfit">
                    Before starting any session, the coach must verify the 4-digit Attendance OTP generated for the player/parent. Platform payouts will be processed upon verified session completions.
                  </Typography>

                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1 font-outfit-bold">
                    4. Youth & Child Protection Guidelines
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-4 leading-5 font-outfit">
                    When coaching underage athletes, sessions must take place in open, approved sports facilities or under parent/guardian visibility. Child safety protocols must be upheld at all times.
                  </Typography>

                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-1 font-outfit-bold">
                    5. Cancellation & Timeliness
                  </Typography>
                  <Typography variant="body2" color="muted" className="mb-4 leading-5 font-outfit">
                    Coaches must report to scheduled venues on time. Frequent cancellations or unexcused absences may impact search ranking and coach badge status.
                  </Typography>
                </>
              )}
            </ScrollView>

            <View className="pt-3 border-t border-gray-100 flex-row gap-3">
              <View className="flex-1">
                <Button 
                  title="Cancel" 
                  variant="outline"
                  onPress={() => setShowAgreementModal(false)}
                />
              </View>
              <View className="flex-1">
                <Button 
                  title="Accept & Submit" 
                  variant="primary"
                  isLoading={submitProfileMutation.isPending}
                  onPress={() => {
                    setShowAgreementModal(false);
                    submitProfileMutation.mutate();
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
