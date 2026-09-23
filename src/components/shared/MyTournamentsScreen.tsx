import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export default function MyTournamentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);

  // Fetch my tournament registrations
  const { data: registrationsResponse, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['myTournamentRegistrations'],
    queryFn: async () => {
      const res = await api.get('/novare/registrations/my');
      return res.data?.data || res.data;
    }
  });

  // Fetch selected registration detail by ID
  const { data: detailResponse, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['tournamentRegistrationDetail', selectedRegistrationId],
    queryFn: async () => {
      if (!selectedRegistrationId) return null;
      const res = await api.get(`/novare/registrations/${selectedRegistrationId}`);
      return res.data?.data || res.data;
    },
    enabled: !!selectedRegistrationId
  });

  const registrations = Array.isArray(registrationsResponse) 
    ? registrationsResponse 
    : (registrationsResponse?.registrations || registrationsResponse?.data || []);

  const detailObj = detailResponse;

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 flex-row justify-between items-center bg-[#0F2C59] border-b border-gray-100 shadow-sm z-10">
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
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold">
          My Tournaments
        </Typography>
        <TouchableOpacity onPress={() => refetch()} className="p-2 -mr-2">
          <Ionicons name="refresh" size={20} color="#FF5100" />
        </TouchableOpacity>
      </View>

      {isLoading || isRefetching ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FF5100" />
          <Typography variant="body2" color="muted" className="mt-2 font-outfit">
            Loading your tournament registrations...
          </Typography>
        </View>
      ) : registrations.length === 0 ? (
        <View className="flex-1 px-8 pt-20 items-center justify-center">
          <View className="w-20 h-20 rounded-full bg-white shadow-sm items-center justify-center mb-4 border border-gray-100">
            <Ionicons name="trophy-outline" size={38} color="#9CA3AF" />
          </View>
          <Typography variant="h3" color="secondary" weight="bold" className="mb-2 font-outfit-bold text-center">
            No Tournament Registrations
          </Typography>
          <Typography variant="body2" color="muted" align="center" className="mb-6 font-outfit">
            You haven't registered for any sports tournaments yet. Explore upcoming tournaments and register!
          </Typography>
          <Button 
            title="Explore Tournaments" 
            onPress={() => {
              try {
                router.back();
              } catch (e) {
                router.replace('/');
              }
            }}
            fullWidth={false}
            className="px-6"
          />
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 40, 60) }}
        >
          {registrations.map((reg: any, idx: number) => {
            const regId = reg._id || reg.id || idx.toString();
            const tournamentObj = reg.tournamentId || reg.tournament || {};
            const tournamentName = tournamentObj.name || tournamentObj.title || reg.tournamentName || 'Tournament';
            const categoryName = reg.categoryName || reg.category?.name || reg.category || 'Open Division';
            const status = (reg.status || 'registered').toUpperCase();
            const dateStr = reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : '';

            return (
              <TouchableOpacity
                key={regId}
                onPress={() => setSelectedRegistrationId(regId)}
                activeOpacity={0.8}
                className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-gray-100"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-10 h-10 rounded-xl bg-[#FFF5F0] items-center justify-center mr-3">
                      <Ionicons name="trophy" size={20} color="#FF5100" />
                    </View>
                    <View className="flex-1">
                      <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold" numberOfLines={1}>
                        {tournamentName}
                      </Typography>
                      <Typography variant="caption" color="muted" className="font-outfit">
                        {categoryName}
                      </Typography>
                    </View>
                  </View>

                  <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-emerald-700 text-[10px]">
                      {status}
                    </Typography>
                  </View>
                </View>

                {reg.childName && (
                  <View className="bg-gray-50 px-3 py-1.5 rounded-xl self-start mb-2 flex-row items-center">
                    <Ionicons name="person-outline" size={12} color="#6B7280" className="mr-1" />
                    <Typography variant="caption" color="secondary" weight="medium" className="font-outfit text-xs">
                      Participant: {reg.childName}
                    </Typography>
                  </View>
                )}

                <View className="flex-row items-center justify-between pt-2 border-t border-gray-100 mt-1">
                  <Typography variant="caption" color="muted" className="font-outfit">
                    {dateStr ? `Registered on ${dateStr}` : 'Active Registration'}
                  </Typography>
                  <View className="flex-row items-center">
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold mr-1">
                      View Details
                    </Typography>
                    <Ionicons name="chevron-forward" size={14} color="#FF5100" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* REGISTRATION DETAILS MODAL */}
      <Modal
        visible={!!selectedRegistrationId}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRegistrationId(null)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setSelectedRegistrationId(null)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
                Registration Details
              </Typography>
              <TouchableOpacity onPress={() => setSelectedRegistrationId(null)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {isLoadingDetail ? (
              <ActivityIndicator size="small" color="#FF5100" style={{ paddingVertical: 20 }} />
            ) : detailObj ? (
              <View className="space-y-4">
                <View className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                    {detailObj.tournament?.name || detailObj.tournamentName || 'Tournament'}
                  </Typography>
                  <Typography variant="body2" color="muted" className="font-outfit mt-1">
                    Category: <Typography weight="bold">{detailObj.categoryName || detailObj.category || 'Standard'}</Typography>
                  </Typography>
                  <Typography variant="caption" color="secondary" className="font-outfit mt-1">
                    Registration ID: #{detailObj._id || detailObj.id}
                  </Typography>
                </View>

                <View className="flex-row justify-between py-2 border-b border-gray-100">
                  <Typography variant="body2" color="muted" className="font-outfit">Status</Typography>
                  <Typography variant="body2" color="secondary" weight="bold" className="font-outfit-bold uppercase text-emerald-600">
                    {detailObj.status || 'CONFIRMED'}
                  </Typography>
                </View>

                {detailObj.paymentStatus && (
                  <View className="flex-row justify-between py-2 border-b border-gray-100">
                    <Typography variant="body2" color="muted" className="font-outfit">Payment Status</Typography>
                    <Typography variant="body2" color="secondary" weight="bold" className="font-outfit-bold uppercase">
                      {detailObj.paymentStatus}
                    </Typography>
                  </View>
                )}

                <Button
                  title="Close"
                  variant="white"
                  onPress={() => setSelectedRegistrationId(null)}
                  className="mt-4"
                />
              </View>
            ) : (
              <Typography variant="body2" color="muted" align="center" className="py-4 font-outfit">
                Registration details loaded.
              </Typography>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
