import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, Share, Clipboard, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useRouter, useNavigation } from 'expo-router';
import { useAuthStore } from '@/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as any, () => {
      if (navigation.isFocused()) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
    return unsubscribe;
  }, [navigation]);
  const { user, logout, setUser } = useAuthStore();

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [experience, setExperience] = useState(user?.experience || '');
  const [location, setLocation] = useState(user?.location || '');
  const [description, setDescription] = useState(user?.description || '');
  const [sports, setSports] = useState(user?.sports?.join(', ') || '');
  const [idProof, setIdProof] = useState(user?.idProof || '');

  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar || null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReferralModalVisible, setIsReferralModalVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);

  const handlePickImage = async () => {
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
      const fileName = selectedUri.split('/').pop() || 'ID_Document.jpg';
      setIdProof(fileName);
    }
  };

  const queryClient = useQueryClient();
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['coachProfile'],
    queryFn: async () => {
      if (user?.role !== 'coach') return null;
      const res = await api.get('/coaches/my/profile');
      return res.data?.data || res.data;
    },
    enabled: user?.role === 'coach',
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || profile.phoneNumber || '');
      setExperience(profile.profile?.experience ? profile.profile.experience.toString() : '');
      setLocation(profile.profile?.address?.city || '');
      setDescription(profile.profile?.description || profile.profile?.bio || '');
      setSports(profile.profile?.sports?.join(', ') || '');
      if (profile.avatar || profile.profile?.avatar) {
        setAvatarUri(profile.avatar || profile.profile?.avatar);
      }
    }
  }, [profile]);

  const displayProfile = {
    name: user?.role === 'coach' ? (profile?.name || user?.name || 'Coach Name') : (user?.name || (user?.role === 'parent' ? 'Parent Profile' : 'Player Profile')),
    email: user?.role === 'coach' ? (profile?.email || user?.email || 'N/A') : (user?.email || 'N/A'),
    phone: user?.role === 'coach' ? (profile?.phone || profile?.phoneNumber || user?.phone || '') : (user?.phone || ''),
    location: user?.role === 'coach' ? (profile?.profile?.address?.city || user?.location || 'N/A') : (user?.location || 'N/A'),
    experience: user?.role === 'coach' ? (profile?.profile?.experience ? `${profile.profile.experience} Years` : (user?.experience || 'N/A')) : (user?.experience || 'N/A'),
    sports: user?.role === 'coach' ? (profile?.profile?.sports || []) : (user?.sports || []),
    description: user?.role === 'coach' ? (profile?.profile?.description || profile?.profile?.bio || user?.description || 'N/A') : (user?.description || 'N/A'),
  };

  const descriptionWordCount = description.trim() === '' ? 0 : description.trim().split(/\s+/).length;

  const handleDescriptionChange = (text: string) => {
    const words = text.trim() === '' ? [] : text.trim().split(/\s+/);
    if (words.length <= 150 || text.length < description.length) {
      setDescription(text);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      const endpoint = user?.role === 'coach' ? '/coaches/my/profile' : '/users/me';
      const res = await api.put(endpoint, updatedData);
      return res.data;
    },
    onSuccess: (data, variables) => {
      setIsSaving(false);
      const queryKey = user?.role === 'coach' ? ['coachProfile'] : ['myProfile'];
      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return data?.data || data;
        const updatedUser = data?.data || data;
        
        if (user?.role === 'coach') {
          return {
            ...oldData,
            ...updatedUser,
            profile: {
              ...oldData.profile,
              ...(updatedUser.profile || {}),
              sports: variables.sports !== undefined ? variables.sports : oldData.profile?.sports,
              experience: variables.experience !== undefined ? variables.experience : oldData.profile?.experience,
              bio: variables.bio !== undefined ? variables.bio : oldData.profile?.bio,
              description: variables.description !== undefined ? variables.description : oldData.profile?.description,
              address: variables.address !== undefined ? variables.address : oldData.profile?.address,
              avatar: variables.avatar !== undefined ? variables.avatar : oldData.profile?.avatar,
            }
          };
        } else {
          return {
            ...oldData,
            ...updatedUser
          };
        }
      });

      queryClient.invalidateQueries({ queryKey });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
      if (user) {
        const resolvedName = user?.role === 'coach' ? name : 
                             (data?.data?.firstName || data?.firstName ? `${data.data?.firstName || data.firstName} ${data.data?.lastName || data.lastName}`.trim() : name);
        setUser({
          ...user,
          name: resolvedName,
          email: data?.data?.email || data?.email || user.email,
          phone: data?.data?.phone || data?.phone || user.phone,
          avatar: variables.avatar || user.avatar,
        });
      }
    },
    onError: (err: any) => {
      setIsSaving(false);
      setSubmitError(err?.response?.data?.message || err.message || 'Failed to update profile');
    }
  });

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setSubmitError('Camera roll permissions are required to upload a profile picture!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedUri = result.assets[0].uri;
      setAvatarUri(selectedUri);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSubmitError(null);
    setName(user?.name || '');
    setPhone(user?.phone || '');
    setExperience(user?.experience || '');
    setLocation(user?.location || '');
    setDescription(user?.description || '');
    setSports(user?.sports?.join(', ') || '');
    setIdProof(user?.idProof || '');
    setAvatarUri(user?.avatar || null);

    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || profile.phoneNumber || '');
      setExperience(profile.profile?.experience ? profile.profile.experience.toString() : '');
      setLocation(profile.profile?.address?.city || '');
      setDescription(profile.profile?.description || profile.profile?.bio || '');
      setSports(profile.profile?.sports?.join(', ') || '');
      if (profile.avatar || profile.profile?.avatar) {
        setAvatarUri(profile.avatar || profile.profile?.avatar);
      }
    }
  };

  const handleSaveProfile = async () => {
    setSubmitError(null);
    setIsSaving(true);

    let uploadedAvatarUrl = null;
    if (avatarUri && (avatarUri.startsWith('file://') || avatarUri.startsWith('content://'))) {
      try {
        const formData = new FormData();
        const fileType = avatarUri.split('.').pop() || 'jpg';
        const fileName = avatarUri.split('/').pop() || `avatar.${fileType}`;
        
        formData.append('avatar', {
          uri: avatarUri,
          name: fileName,
          type: `image/${fileType === 'png' ? 'png' : 'jpeg'}`,
        } as any);

        const uploadRes = await api.post('/users/me/avatar', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        uploadedAvatarUrl = uploadRes.data?.data?.avatar || uploadRes.data?.avatar || uploadRes.data?.data?.url || uploadRes.data?.url;
      } catch (uploadErr: any) {
        setIsSaving(false);
        setSubmitError('Failed to upload profile picture: ' + (uploadErr?.response?.data?.message || uploadErr.message));
        return;
      }
    }

    if (user?.role === 'coach') {
      const payload: any = {
        name,
        bio: description,
        description,
        experience: parseInt(experience) || 0,
        sports: sports.split(',').map(s => s.trim()).filter(Boolean),
        address: {
          city: location
        }
      };

      if (uploadedAvatarUrl) {
        payload.avatar = uploadedAvatarUrl;
      }

      payload.profile = {
        bio: description,
        description,
        experience: parseInt(experience) || 0,
        sports: sports.split(',').map(s => s.trim()).filter(Boolean),
        address: {
          city: location
        }
      };
      if (uploadedAvatarUrl) {
        payload.profile.avatar = uploadedAvatarUrl;
      }

      payload.coach = {
        bio: description,
        description,
        experience: parseInt(experience) || 0,
        sports: sports.split(',').map(s => s.trim()).filter(Boolean),
        address: {
          city: location
        }
      };

      updateProfileMutation.mutate(payload);
    } else {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '.';
      
      const payload: any = {
        firstName,
        lastName,
        email: user?.email || '',
        phone,
        address: location,
        role: user?.role === 'parent' ? 'parent' : 'user'
      };

      if (uploadedAvatarUrl || avatarUri) {
        payload.avatar = uploadedAvatarUrl || avatarUri;
      }

      updateProfileMutation.mutate(payload);
    }
  };

  const standardMenuItems = [
    { id: 'referral', title: 'Refer & Share App', icon: 'share-social-outline', route: null },
    { id: 'settings', title: 'Settings & Preferences', icon: 'settings-outline', route: '/settings' },
    { id: 'logout', title: 'Sign Out', icon: 'log-out-outline', route: '/(auth)' },
  ];

  const parentMenuItems = [
    { id: 'family', title: 'My Family Members', icon: 'people-outline', route: '/(parent)/family-tree' },
    { id: 'referral', title: 'Refer & Share App', icon: 'share-social-outline', route: null },
    { id: 'settings', title: 'Settings & Preferences', icon: 'settings-outline', route: '/settings' },
    { id: 'logout', title: 'Sign Out', icon: 'log-out-outline', route: '/(auth)' },
  ];

  const coachMenuItems = [
    { id: 'wallet', title: 'Wallet & Withdrawals', icon: 'wallet-outline', route: '/(coach)/wallet' },
    { id: 'locations', title: 'Coaching Locations', icon: 'location-outline', route: '/locations' },
    { id: 'referral', title: 'Refer & Share App', icon: 'share-social-outline', route: null },
    { id: 'settings', title: 'Settings & Preferences', icon: 'settings-outline', route: '/settings' },
    { id: 'logout', title: 'Sign Out', icon: 'log-out-outline', route: '/(auth)' },
  ];

  const menuItems = user?.role === 'coach' ? coachMenuItems : (user?.role === 'parent' ? parentMenuItems : standardMenuItems);

  const getMenuDetails = (id: string) => {
    switch (id) {
      case 'wallet':
        return {
          title: "Wallet & Withdrawals",
          desc: "Manage balance, coaching earnings, and transfer payouts",
          color: "#10B981", // Emerald
          bgColor: "bg-emerald-50 border-emerald-100/50"
        };
      case 'locations':
        return {
          title: "Coaching Locations",
          desc: "Configure your training arenas and map boundaries",
          color: "#F58220", // Orange
          bgColor: "bg-orange-50 border-orange-100/50"
        };
      case 'family':
        return {
          title: "My Family Members",
          desc: "Register child profiles, update info, and manage family accounts",
          color: "#0D9488", // Teal
          bgColor: "bg-teal-50 border-teal-100/50"
        };
      case 'settings':
        return {
          title: "Settings & Preferences",
          desc: "Manage help center support and legal documents",
          color: "#0F2C59", // Navy
          bgColor: "bg-blue-50 border-blue-100/50"
        };
      case 'referral':
        return {
          title: "Refer & Share App",
          desc: "Invite your friends to Arenova and share your referral code",
          color: "#8B5CF6", // Purple
          bgColor: "bg-purple-50 border-purple-100/50"
        };
      default:
        return {
          title: "Sign Out",
          desc: "Securely log out of your session on this device",
          color: "#EF4444", // Red
          bgColor: "bg-red-50 border-red-100/50"
        };
    }
  };

  const getInitials = (fullName: string | undefined | null) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const renderAvatarContent = () => {
    const activeAvatar = avatarUri || profile?.avatar || user?.avatar || profile?.profile?.avatar;
    if (activeAvatar) {
      return (
        <Image 
          source={{ uri: activeAvatar }} 
          className="w-full h-full"
          resizeMode="cover"
        />
      );
    }

    const resolvedName = displayProfile.name;
    if (!resolvedName || resolvedName.trim() === '' || resolvedName === 'Coach Name' || resolvedName === 'User Profile') {
      return <Ionicons name="person-circle-outline" size={68} color="white" />;
    }

    const initials = getInitials(resolvedName);
    if (!initials) {
      return <Ionicons name="person-circle-outline" size={68} color="white" />;
    }

    return (
      <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold text-2xl">
        {initials}
      </Typography>
    );
  };

  const referralCode = user?.id ? `${(profile?.name || user?.name || 'USER').split(' ')[0].toUpperCase()}${user.id.substring(Math.max(0, user.id.length - 4)).toUpperCase()}` : 'ARENOVA10';

  const handleShareReferral = async () => {
    const shareMessage = `Hey! Join me on Arenova! Register as a player or parent using my referral code: ${referralCode} and get access to top-tier sports coaching. Download the app today!`;
    try {
      await Share.share({
        message: shareMessage,
      });
    } catch (error: any) {
      console.error('Error sharing:', error);
    }
  };

  const handleShareWhatsApp = async () => {
    const shareMessage = `Hey! Join me on Arenova! Register as a player or parent using my referral code: ${referralCode} and get access to top-tier sports coaching. Download the app today!`;
    const url = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Share.share({
          message: shareMessage,
        });
      }
    } catch (err) {
      await Share.share({
        message: shareMessage,
      });
    }
  };

  const handleCopyReferralCode = async () => {
    Clipboard.setString(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard.');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm z-10">
          <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
            My Profile
          </Typography>
          <TouchableOpacity className="p-2 -mr-2" onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={24} color="#0F2C59" />
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" scrollEventThrottle={16} decelerationRate="normal" className="flex-1 px-4 pt-4" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 40, 60) }}>
          {user?.role === 'coach' && isProfileLoading ? (
            <ActivityIndicator size="large" color="#FF5100" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* On-Screen Error Banner */}
              {submitError && (
                <View className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex-row items-start shadow-sm">
                  <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5 mt-0.5" />
                  <View className="flex-1">
                    <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-red-800">
                      Update Failed
                    </Typography>
                    <Typography variant="caption" className="font-outfit text-red-600 mt-0.5">
                      {submitError}
                    </Typography>
                  </View>
                  <TouchableOpacity onPress={() => setSubmitError(null)} className="p-1 -mr-1 -mt-1">
                    <Ionicons name="close" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Header Profile Summary Panel */}
              <View className="bg-secondary rounded-3xl p-6 mb-6 shadow-md relative overflow-hidden">

                <View className="flex-row items-center">
                  <TouchableOpacity 
                    className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/50 items-center justify-center mr-4 relative overflow-hidden shadow-sm"
                    disabled={!isEditing}
                    onPress={handlePickAvatar}
                  >
                    {renderAvatarContent()}
                    {isEditing && (
                      <View className="absolute inset-0 bg-black/40 items-center justify-center">
                        <Ionicons name="camera" size={20} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>

                  <View className="flex-1">
                    <Typography variant="h3" color="white" weight="bold" className="font-outfit-bold">
                      {displayProfile.name}
                    </Typography>

                    <Typography variant="caption" color="light" className="opacity-80 mt-1 font-outfit uppercase tracking-wider">
                      {user?.role === 'coach' 
                        ? 'Certified Coach' 
                        : (user?.role === 'parent' 
                          ? 'Parent' 
                          : 'Player')}
                    </Typography>

                    <View className="flex-row items-center mt-2">
                      <Typography variant="body2" color="white" className="opacity-90 font-outfit">
                        {displayProfile.phone}
                      </Typography>
                      {displayProfile.phone ? (
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" className="ml-1.5" />
                      ) : null}
                    </View>
                  </View>

                  {!isEditing && (
                    <TouchableOpacity 
                      onPress={() => {
                        setIsEditing(true);
                        setSubmitError(null);
                      }} 
                      className="w-10 h-10 bg-primary rounded-full items-center justify-center shadow-sm border border-primary"
                    >
                      <Ionicons name="pencil" size={18} color="white" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Quick Stats Banner */}
                {!isEditing && user?.role === 'coach' && (
                  <View className="flex-row pt-4 mt-4 border-t border-white/10">
                    <View className="flex-1 items-center border-r border-white/10">
                      <View className="flex-row items-center mb-0.5">
                        <Ionicons name="star" size={14} color="#F59E0B" className="mr-1" />
                        <Typography variant="subtitle1" color="white" weight="bold" className="font-outfit-bold">
                          {profile?.profile?.rating !== undefined ? profile.profile.rating.toFixed(1) : '0.0'}
                        </Typography>
                      </View>
                      <Typography variant="caption" color="light" className="opacity-70 font-outfit">Rating ({profile?.profile?.totalRatings || 0})</Typography>
                    </View>
                    <View className="flex-1 items-center">
                      <Typography variant="subtitle1" color="white" weight="bold" className="mb-0.5 font-outfit-bold">
                        {profile?.profile?.sessions || 0}
                      </Typography>
                      <Typography variant="caption" color="light" className="opacity-70 font-outfit">Sessions Completed</Typography>
                    </View>
                  </View>
                )}
              </View>

              {/* Account Details Card */}
              <View className="bg-white rounded-3xl p-5 mb-5 shadow-sm border border-gray-100">
                <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-4 font-outfit-bold">
                  Account Details
                </Typography>

                <View className="space-y-4">
                  {/* Name Input (Visible in edit mode) */}
                  {isEditing && (
                    <TextInput 
                      label="Full Name"
                      value={name} 
                      onChangeText={setName} 
                      placeholder="Your Name" 
                    />
                  )}

                  {/* Phone Input (Visible in edit mode) */}
                  {isEditing && (
                    <TextInput 
                      label="Phone Number"
                      value={phone} 
                      onChangeText={setPhone} 
                      placeholder="Phone Number" 
                      keyboardType="phone-pad" 
                    />
                  )}

                  {/* Email (Visible in edit mode as read-only) */}
                  {isEditing && (
                    <TextInput 
                      label="Email Address"
                      value={displayProfile.email} 
                      editable={false}
                      className="bg-gray-100/50 text-gray-500 opacity-80"
                    />
                  )}

                  {/* Email Row (Visible in view mode) */}
                  {!isEditing && (
                    <View className="flex-row items-center py-3">
                      <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mr-3">
                        <Ionicons name="mail" size={16} color="#3B82F6" />
                      </View>
                      <View className="flex-1">
                        <Typography variant="caption" color="muted" className="font-outfit">Email Address</Typography>
                        <Typography variant="body2" color="secondary" weight="medium" className="mt-0.5 font-outfit">
                          {displayProfile.email}
                        </Typography>
                      </View>
                      <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    </View>
                  )}

                  {/* Location (Visible in edit mode) */}
                  {isEditing && (
                    <TextInput 
                      label="Location/City"
                      value={location} 
                      onChangeText={setLocation} 
                      placeholder="e.g. Hyderabad" 
                    />
                  )}

                  {/* Location Row (Visible in view mode) */}
                  {!isEditing && (
                    <View className="flex-row items-center py-3">
                      <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center mr-3">
                        <Ionicons name="location" size={16} color="#EF4444" />
                      </View>
                      <View className="flex-1">
                        <Typography variant="caption" color="muted" className="font-outfit">Location/City</Typography>
                        <Typography variant="body2" color="secondary" weight="medium" className="mt-0.5 font-outfit">
                          {displayProfile.location}
                        </Typography>
                      </View>
                    </View>
                  )}

                  {/* Experience (Visible in edit mode) */}
                  {user?.role === 'coach' && isEditing && (
                    <TextInput 
                      label="Coaching Experience (Years)"
                      value={experience} 
                      onChangeText={setExperience} 
                      placeholder="e.g. 5" 
                      keyboardType="numeric"
                    />
                  )}

                  {/* Experience Row (Visible in view mode) */}
                  {user?.role === 'coach' && !isEditing && (
                    <View className="flex-row items-center py-3">
                      <View className="w-8 h-8 rounded-full bg-green-50 items-center justify-center mr-3">
                        <Ionicons name="ribbon" size={16} color="#10B981" />
                      </View>
                      <View className="flex-1">
                        <Typography variant="caption" color="muted" className="font-outfit">Coaching Experience</Typography>
                        <Typography variant="body2" color="secondary" weight="medium" className="mt-0.5 font-outfit">
                          {displayProfile.experience}
                        </Typography>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Coaching & Professional Profile Cards */}
              {user?.role === 'coach' && (
                <View className="bg-white rounded-3xl p-5 mb-5 shadow-sm border border-gray-100">
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
                    Professional Profile
                  </Typography>

                  <View>
                    {/* Sports (Rendered as tags, read-only both in view & edit mode) */}
                    <View className="py-2.5">
                      <Typography variant="caption" color="muted" className="font-outfit">Sports Specialization (Read-Only)</Typography>
                      <View className="flex-row flex-wrap mt-2">
                        {displayProfile.sports.length > 0 ? (
                          displayProfile.sports.map((sport: string, index: number) => (
                            <View key={index} className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-full mr-2 mb-2">
                              <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-[10px]">{sport}</Typography>
                            </View>
                          ))
                        ) : (
                          <Typography variant="body2" color="secondary">None Selected</Typography>
                        )}
                      </View>
                    </View>

                    {/* About Me / Bio */}
                    <View className="py-2.5">
                      <View className="flex-row justify-between items-center">
                        <Typography variant="caption" color="muted" className="font-outfit">Biography</Typography>
                        {isEditing && (
                          <Typography variant="caption" color={descriptionWordCount >= 150 ? 'error' : 'muted'} className="text-[10px]">
                            {descriptionWordCount}/150 words
                          </Typography>
                        )}
                      </View>
                      {isEditing ? (
                        <TextInput 
                          value={description} 
                          onChangeText={handleDescriptionChange} 
                          placeholder="Write something about yourself..." 
                          multiline 
                          className="mb-0 mt-2 min-h-[80px]" 
                        />
                      ) : (
                        <Typography variant="body2" color="text" className="mt-1 leading-5 font-outfit text-gray-600">
                          {displayProfile.description}
                        </Typography>
                      )}
                    </View>

                    {/* KYC Proof */}
                    <View className="flex-row items-center py-2.5">
                      <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mr-3">
                        <Ionicons name="id-card" size={16} color="#3B82F6" />
                      </View>
                      <View className="flex-1">
                        <Typography variant="caption" color="muted" className="font-outfit">ID & Certification Proof</Typography>
                        {isEditing ? (
                          <TouchableOpacity 
                            onPress={handlePickImage}
                            className="mt-2 bg-white p-3 rounded-xl flex-row justify-between items-center border border-gray-200 shadow-sm"
                          >
                            <Typography color="secondary" className="font-outfit text-xs">{idProof ? idProof : 'Upload Document'}</Typography>
                            <Ionicons name="cloud-upload-outline" size={18} color="#0F2C59" />
                          </TouchableOpacity>
                        ) : (
                          <Typography variant="body2" color="secondary" weight="medium" className="mt-0.5 font-outfit">
                            {profile?.profile?.kyc ? `Verified Status: ${profile.profile.kyc.toUpperCase()}` : (idProof ? idProof : 'Pending Certification')}
                          </Typography>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Schedule Management Panel */}
              {user?.role === 'coach' && !isEditing && (
                <View className="bg-white rounded-3xl p-5 mb-5 shadow-sm border border-gray-100 flex-row items-center justify-between">
                  <View className="flex-1 mr-4">
                    <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                      Calendar Availability
                    </Typography>
                    <Typography variant="caption" color="muted" className="mt-1 font-outfit">
                      Manage your coaching dates, time slots, and prices.
                    </Typography>
                  </View>
                  <TouchableOpacity 
                    onPress={() => router.push('/(coach)/(coach-tabs)/schedule')}
                    className="bg-primary/10 border border-primary/20 px-4 py-2.5 rounded-full"
                  >
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs">Set Slots</Typography>
                  </TouchableOpacity>
                </View>
              )}

              {/* Save Changes Buttons */}
              {isEditing && (
                <View className="mb-6 flex-row gap-3">
                  <View className="flex-1">
                    <Button 
                      title="Cancel" 
                      variant="white"
                      onPress={handleCancelEdit} 
                      disabled={isSaving || updateProfileMutation.isPending}
                    />
                  </View>
                  <View className="flex-[2] flex-grow">
                    <Button 
                      title="Save Changes" 
                      onPress={handleSaveProfile} 
                      isLoading={isSaving || updateProfileMutation.isPending}
                    />
                  </View>
                </View>
              )}
            </>
          )}

          {/* Menu Action Sheet - Designed in a highly professional card tile list with spacing */}
          <View className="mb-2">
            {menuItems.map((item) => {
              const details = getMenuDetails(item.id);
              return (
                <TouchableOpacity 
                  key={item.id}
                  onPress={() => {
                    if (item.id === 'logout') {
                      setIsLogoutModalVisible(true);
                    } else if (item.id === 'referral') {
                      setIsReferralModalVisible(true);
                    } else if (item.route) {
                      router.push(item.route as any);
                    }
                  }}
                  activeOpacity={0.8}
                  className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex-row items-center mb-4"
                >
                  <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${details.bgColor} border`}>
                    <Ionicons name={item.icon as any} size={22} color={details.color} />
                  </View>
                  <View className="flex-1">
                    <Typography 
                      variant="subtitle1" 
                      color={item.id === 'logout' ? 'text' : 'secondary'} 
                      weight="bold" 
                      className={`font-outfit-bold ${item.id === 'logout' ? 'text-red-500' : ''}`}
                    >
                      {details.title}
                    </Typography>
                    <Typography variant="caption" color="muted" className="mt-0.5 font-outfit text-xs leading-4">
                      {details.desc}
                    </Typography>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              );
            })}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Referral bottom sheet Modal */}
      <Modal
        visible={isReferralModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsReferralModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setIsReferralModalVisible(false)} 
          />
          <View className="bg-white rounded-t-3xl p-6 shadow-xl pb-10">
            <View className="flex-row justify-between items-center mb-6">
              <Typography variant="h2" color="secondary" className="font-outfit-bold">
                Refer & Invite
              </Typography>
              <TouchableOpacity onPress={() => setIsReferralModalVisible(false)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-purple-50 items-center justify-center mb-4">
                <Ionicons name="gift-outline" size={32} color="#8B5CF6" />
              </View>
              <Typography variant="subtitle1" color="secondary" weight="bold" className="text-center font-outfit-bold mb-2">
                Share Arenova & Build Your Network
              </Typography>
              <Typography variant="body2" color="muted" className="text-center font-outfit px-4">
                Invite parents and player students to sign up on Arenova. Share your unique referral code with them!
              </Typography>
            </View>

            {/* Referral Code Box */}
            <View className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 flex-row items-center justify-between mb-6">
              <View>
                <Typography variant="caption" color="muted" className="font-outfit">Your Referral Code</Typography>
                <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold tracking-wider mt-0.5 text-purple-900">
                  {referralCode}
                </Typography>
              </View>
              <TouchableOpacity 
                onPress={handleCopyReferralCode}
                className="bg-white px-4 py-2 rounded-full border border-purple-200 active:bg-purple-50 flex-row items-center"
              >
                <Ionicons name="copy-outline" size={14} color="#8B5CF6" className="mr-1.5" />
                <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-purple-600 text-xs">Copy</Typography>
              </TouchableOpacity>
            </View>

            {/* Sharing Options */}
            <View className="space-y-3">
              <TouchableOpacity 
                onPress={handleShareWhatsApp}
                className="w-full bg-[#25D366] h-14 rounded-full flex-row items-center justify-center active:opacity-90"
              >
                <Ionicons name="logo-whatsapp" size={20} color="white" className="mr-2" />
                <Typography color="white" weight="bold" className="font-outfit-bold">
                  Share via WhatsApp
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleShareReferral}
                className="w-full bg-secondary h-14 rounded-full flex-row items-center justify-center active:opacity-90 border border-secondary"
              >
                <Ionicons name="share-social-outline" size={20} color="white" className="mr-2" />
                <Typography color="white" weight="bold" className="font-outfit-bold">
                  Other Share Options
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modern Themed Confirm Logout Modal */}
      <Modal
        visible={isLogoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLogoutModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 44, 89, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View 
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderRadius: 28, 
              padding: 24, 
              width: '100%', 
              maxWidth: 360, 
              alignItems: 'center',
              shadowColor: '#000000', 
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.25, 
              shadowRadius: 20, 
              elevation: 10,
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.15)'
            }}
          >
            {/* Top Badge Icon */}
            <View 
              style={{ 
                width: 64, 
                height: 64, 
                borderRadius: 32, 
                backgroundColor: '#FEF2F2', 
                alignItems: 'center', 
                justifyContent: 'center', 
                marginBottom: 16,
                borderWidth: 1,
                borderColor: '#FEE2E2'
              }}
            >
              <Ionicons name="log-out" size={30} color="#EF4444" />
            </View>

            {/* Title & Subtitle */}
            <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold text-xl text-center mb-2">
              Sign Out of Arenova?
            </Typography>

            <Typography variant="body2" color="muted" className="font-outfit text-center text-sm leading-5 mb-6 text-gray-500">
              Are you sure you want to sign out? You will need to log back in to manage your sessions and activities.
            </Typography>

            {/* Action Buttons */}
            <View className="flex-row w-full gap-3">
              <TouchableOpacity
                style={{ 
                  flex: 1, 
                  paddingVertical: 14, 
                  borderRadius: 16, 
                  backgroundColor: '#F3F4F6', 
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: '#E5E7EB'
                }}
                activeOpacity={0.8}
                onPress={() => setIsLogoutModalVisible(false)}
              >
                <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold text-sm">
                  Cancel
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ 
                  flex: 1.2, 
                  paddingVertical: 14, 
                  borderRadius: 16, 
                  backgroundColor: '#EF4444', 
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#EF4444',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 4
                }}
                activeOpacity={0.8}
                onPress={() => {
                  setIsLogoutModalVisible(false);
                  logout();
                  router.replace('/(auth)');
                }}
              >
                <Typography variant="subtitle2" style={{ color: '#FFFFFF' }} weight="bold" className="font-outfit-bold text-sm">
                  Sign Out
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
