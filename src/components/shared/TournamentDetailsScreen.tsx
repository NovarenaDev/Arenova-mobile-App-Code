import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';
import { getTournamentBanner } from '@/utils/tournamentImages';

export default function TournamentDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, children: storedChildren } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [isRegisterModalVisible, setIsRegisterModalVisible] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Fetch tournament details by ID
  const { data: tournamentResponse, isLoading, error } = useQuery({
    queryKey: ['novareTournament', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/novare/tournaments/${id}`);
      return res.data?.data || res.data;
    },
    enabled: !!id,
  });

  const tournament = tournamentResponse;

  // Fetch parent's children if role === 'parent'
  const { data: childrenResponse } = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const res = await api.get('/users/me/children');
      return res.data;
    },
    enabled: user?.role === 'parent',
  });

  const serverChildren = childrenResponse?.data || childrenResponse?.children || [];
  const childrenList = Array.isArray(serverChildren) && serverChildren.length > 0 ? serverChildren : storedChildren || [];

  // Mutation to verify payment for registration
  const verifyPaymentMutation = useMutation({
    mutationFn: async ({ registrationId, transactionId }: { registrationId: string; transactionId: string }) => {
      const res = await api.post(`/novare/registrations/${registrationId}/verify-payment`, {
        transactionId,
        paymentStatus: 'completed',
        status: 'verified'
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTournamentRegistrations'] });
    }
  });

  // Mutation to register for tournament
  const registerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/novare/tournaments/${id}/register`, payload);
      return res.data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['myTournamentRegistrations'] });
      const registrationObj = data?.data || data?.registration || data;
      const regId = registrationObj?._id || registrationObj?.id;

      if (regId) {
        try {
          await verifyPaymentMutation.mutateAsync({
            registrationId: regId,
            transactionId: `TXN_${Date.now()}`
          });
        } catch (e) {
          // auto-verifies if server does not require extra call
        }
      }

      setIsRegisterModalVisible(false);
      Alert.alert(
        'Registration Successful!',
        'You have successfully registered for this tournament category.',
        [
          { text: 'View My Registrations', onPress: () => router.push('/my-tournaments') },
          { text: 'OK', style: 'cancel' }
        ]
      );
    },
    onError: (err: any) => {
      const errMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to submit registration. Please try again.';
      setRegisterError(errMsg);
    }
  });

  const handleOpenRegisterModal = (cat?: any) => {
    setSelectedCategory(cat || (tournament?.categories?.[0] || null));
    setRegisterError(null);
    if (childrenList.length > 0 && !selectedChildId) {
      setSelectedChildId(childrenList[0]._id || childrenList[0].id || '');
    }
    setIsRegisterModalVisible(true);
  };

  const handleConfirmRegistration = () => {
    setRegisterError(null);
    const categoryIdVal = selectedCategory?._id || selectedCategory?.id || selectedCategory?.name || selectedCategory;
    const categoryNameVal = typeof selectedCategory === 'string' ? selectedCategory : (selectedCategory?.name || selectedCategory?.title || 'Open Division');

    const payload: any = {
      categoryId: categoryIdVal,
      category: categoryNameVal,
      categoryName: categoryNameVal,
    };

    if (user?.role === 'parent') {
      if (!selectedChildId && childrenList.length > 0) {
        setRegisterError('Please select a child profile for registration.');
        return;
      }
      if (selectedChildId) {
        payload.childId = selectedChildId;
        payload.participantId = selectedChildId;
        const childObj = childrenList.find((c: any) => (c._id || c.id) === selectedChildId);
        if (childObj?.name) {
          payload.childName = childObj.name;
        }
      }
    }

    registerMutation.mutate(payload);
  };

  const bannerUrl = getTournamentBanner(tournament);
  const categories = tournament?.categories || tournament?.divisions || [];

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F9] justify-center items-center">
        <ActivityIndicator size="large" color="#FF5100" />
        <Typography variant="body2" color="muted" className="mt-2 font-outfit">
          Loading tournament details...
        </Typography>
      </SafeAreaView>
    );
  }

  if (error || !tournament) {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F9] justify-center items-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" className="mb-2" />
        <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-2">
          Tournament Not Found
        </Typography>
        <Typography variant="body2" color="muted" align="center" className="font-outfit mb-6">
          Unable to load tournament information or it may no longer be available.
        </Typography>
        <Button title="Go Back" onPress={() => { try { router.back(); } catch (e) { router.replace('/'); } }} fullWidth={false} className="px-6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View className="px-4 py-3 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity 
          onPress={() => {
            try {
              router.back();
            } catch (e) {
              router.replace('/');
            }
          }} 
          className="p-2 -ml-2"
        >
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold flex-1 text-center mx-2" numberOfLines={1}>
          {tournament.name || tournament.title || 'Tournament Details'}
        </Typography>
        <TouchableOpacity className="p-2 -mr-2">
          <Ionicons name="share-social-outline" size={22} color="#0F2C59" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 90, 110) }}
      >
        {/* Dynamic Banner Image */}
        <View className="h-56 bg-secondary relative overflow-hidden">
          <Image source={{ uri: bannerUrl }} className="w-full h-full" resizeMode="cover" />
          <View className="absolute top-4 right-4 bg-primary px-3 py-1.5 rounded-full shadow-md">
            <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold uppercase text-[11px]">
              {tournament.sport || tournament.sportName || 'Sports'}
            </Typography>
          </View>
        </View>

        <View className="px-5 pt-5">
          {/* Main Info */}
          <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold mb-3">
            {tournament.name || tournament.title || 'Tournament Name'}
          </Typography>

          {/* Key Badges / Details Row */}
          <View className="flex-row flex-wrap items-center gap-3 mb-5">
            <View className="flex-row items-center bg-white px-3.5 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
              <Ionicons name="calendar" size={16} color="#FF5100" className="mr-2" />
              <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                {tournament.startDate ? `${new Date(tournament.startDate).toLocaleDateString()} - ${tournament.endDate ? new Date(tournament.endDate).toLocaleDateString() : ''}` : (tournament.date || 'TBA')}
              </Typography>
            </View>

            <View className="flex-row items-center bg-white px-3.5 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
              <Ionicons name="location" size={16} color="#4A90E2" className="mr-2" />
              <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                {tournament.location || tournament.venue || 'Sports Arena'}
              </Typography>
            </View>

            <View className="flex-row items-center bg-white px-3.5 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
              <Ionicons name="pricetag" size={16} color="#10B981" className="mr-2" />
              <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                {tournament.entryFee !== undefined ? `₹${tournament.entryFee}` : (tournament.fee || 'Free Entry')}
              </Typography>
            </View>
          </View>

          {/* Description */}
          <View className="bg-white rounded-3xl p-5 mb-5 border border-gray-100 shadow-sm">
            <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
              About Tournament
            </Typography>
            <Typography variant="body2" color="muted" className="font-outfit leading-6">
              {tournament.description || tournament.details || 'Join this exciting tournament! Challenge top athletes, showcase your skills, and compete for trophies and prizes.'}
            </Typography>
          </View>

          {/* Available Categories / Divisions */}
          <View className="bg-white rounded-3xl p-5 mb-6 border border-gray-100 shadow-sm">
            <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-4 font-outfit-bold">
              Categories & Divisions
            </Typography>

            {categories.length === 0 ? (
              <TouchableOpacity
                onPress={() => handleOpenRegisterModal()}
                className="p-4 rounded-2xl bg-orange-50/60 border border-orange-100 flex-row items-center justify-between"
              >
                <View className="flex-1 mr-2">
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                    Open General Registration
                  </Typography>
                  <Typography variant="caption" color="muted" className="font-outfit mt-0.5">
                    Standard division open for all participants.
                  </Typography>
                </View>
                <View className="bg-primary px-4 py-2 rounded-full shadow-sm">
                  <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                    Register
                  </Typography>
                </View>
              </TouchableOpacity>
            ) : (
              categories.map((cat: any, idx: number) => {
                const catName = typeof cat === 'string' ? cat : (cat.name || cat.title || `Category ${idx + 1}`);
                const catFee = typeof cat === 'object' && cat.fee !== undefined ? `₹${cat.fee}` : null;

                return (
                  <TouchableOpacity
                    key={cat._id || cat.id || idx}
                    onPress={() => handleOpenRegisterModal(cat)}
                    activeOpacity={0.8}
                    className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex-row items-center justify-between mb-3"
                  >
                    <View className="flex-1 mr-2">
                      <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                        {catName}
                      </Typography>
                      {cat.description && (
                        <Typography variant="caption" color="muted" className="font-outfit mt-0.5">
                          {cat.description}
                        </Typography>
                      )}
                    </View>
                    {catFee && (
                      <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold mr-3">
                        {catFee}
                      </Typography>
                    )}
                    <View className="bg-primary px-3.5 py-2 rounded-full shadow-sm">
                      <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                        Register
                      </Typography>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Fixed Action Bar - Raised with Safe Area Bottom Padding */}
      <View 
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 pt-4 flex-row items-center justify-between shadow-2xl z-20"
        style={{ paddingBottom: Math.max(insets.bottom + 12, 18) }}
      >
        <View>
          <Typography variant="caption" color="muted" className="font-outfit text-xs">Entry Fee</Typography>
          <Typography variant="h2" color="primary" weight="bold" className="font-outfit-bold text-xl">
            {tournament.entryFee !== undefined ? `₹${tournament.entryFee}` : 'Free'}
          </Typography>
        </View>

        <Button
          title="Register Now"
          onPress={() => handleOpenRegisterModal()}
          fullWidth={false}
          className="px-8 shadow-sm"
        />
      </View>

      {/* REGISTRATION MODAL SHEET */}
      <Modal
        visible={isRegisterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRegisterModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/60 justify-end"
        >
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setIsRegisterModalVisible(false)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-4 shadow-2xl border-t border-gray-200 max-h-[88%]"
            style={{ paddingBottom: Math.max(insets.bottom + 16, 28) }}
          >
            {/* Drag Handle Indicator */}
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-100">
              <View>
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold">
                  Tournament Registration
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit">
                  Complete details to confirm entry
                </Typography>
              </View>
              <TouchableOpacity 
                onPress={() => setIsRegisterModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-grow-0">
              {registerError && (
                <View className="mb-4 bg-red-50 p-3.5 rounded-2xl border border-red-200 flex-row items-center">
                  <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5" />
                  <Typography variant="caption" className="font-outfit text-red-600 flex-1 leading-4">
                    {registerError}
                  </Typography>
                </View>
              )}

              {/* Tournament Summary Card */}
              <View className="bg-orange-50/70 p-4 rounded-2xl border border-orange-100 mb-5">
                <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold uppercase text-[10px] tracking-wider">
                  Tournament Entry
                </Typography>
                <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mt-0.5">
                  {tournament.name || tournament.title}
                </Typography>
                {selectedCategory && (
                  <View className="mt-2 pt-2 border-t border-orange-100/60 flex-row items-center justify-between">
                    <Typography variant="caption" color="muted" className="font-outfit">Category / Division:</Typography>
                    <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                      {typeof selectedCategory === 'string' ? selectedCategory : (selectedCategory.name || 'Standard')}
                    </Typography>
                  </View>
                )}
              </View>

              {/* Category Selector (If multiple categories exist) */}
              {categories.length > 1 && (
                <View className="mb-5">
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
                    Select Category
                  </Typography>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {categories.map((cat: any, idx: number) => {
                      const isSel = selectedCategory === cat;
                      const cName = typeof cat === 'string' ? cat : (cat.name || `Cat ${idx + 1}`);
                      return (
                        <TouchableOpacity
                          key={cat._id || cat.id || idx}
                          onPress={() => setSelectedCategory(cat)}
                          className={`px-4 py-2.5 rounded-2xl border mr-2.5 flex-row items-center ${
                            isSel ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <Typography variant="caption" color={isSel ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold">
                            {cName}
                          </Typography>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Participant Selection (For Parent Users) */}
              {user?.role === 'parent' ? (
                <View className="mb-5">
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
                    Select Participant (Child)
                  </Typography>
                  {childrenList.length === 0 ? (
                    <TouchableOpacity 
                      onPress={() => {
                        setIsRegisterModalVisible(false);
                        router.push('/(parent)/family/add-child');
                      }}
                      className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex-row items-center justify-between"
                    >
                      <Typography variant="body2" color="secondary" className="font-outfit">
                        No child profiles found. Tap to add child profile.
                      </Typography>
                      <Ionicons name="add-circle" size={22} color="#FF5100" />
                    </TouchableOpacity>
                  ) : (
                    childrenList.map((child: any) => {
                      const cId = child._id || child.id;
                      const isSelected = selectedChildId === cId;
                      return (
                        <TouchableOpacity
                          key={cId}
                          onPress={() => setSelectedChildId(cId)}
                          className={`p-3.5 rounded-2xl border mb-2.5 flex-row items-center justify-between ${
                            isSelected ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <View className="flex-row items-center">
                            <Ionicons name="person-circle" size={26} color={isSelected ? '#FF5100' : '#9CA3AF'} className="mr-3" />
                            <View>
                              <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                                {child.name}
                              </Typography>
                              <Typography variant="caption" color="muted" className="font-outfit text-xs">
                                {child.age ? `${child.age} yrs` : 'Child Profile'} {child.sport ? `• ${child.sport}` : ''}
                              </Typography>
                            </View>
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={22} color="#FF5100" />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              ) : (
                <View className="mb-5 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                  <Typography variant="caption" color="muted" className="font-outfit">Registering As</Typography>
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mt-0.5">
                    {user?.name || 'Player'}
                  </Typography>
                  <Typography variant="caption" color="secondary" className="font-outfit opacity-80 mt-0.5">
                    {user?.email}
                  </Typography>
                </View>
              )}

              <Button
                title="Confirm & Submit Registration"
                onPress={handleConfirmRegistration}
                isLoading={registerMutation.isPending}
                className="mt-2 mb-4 shadow-sm"
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
