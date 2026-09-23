import React from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

interface CoachProfile {
  _id: string;
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  sports?: string[];
  sport?: string;
  rating?: number | string;
  reviews?: number | string;
  reviewsCount?: number;
  experience?: number | string;
  exp?: string;
  bio?: string;
  city?: string;
  specialties?: string[];
}

export default function PublicCoachProfileScreen() {
  const insets = useSafeAreaInsets();
  console.log('[DEBUG coach-profile] 1. entering component');
  const router = useRouter();
  console.log('[DEBUG coach-profile] 2. after useRouter');
  const { id, coachId } = useLocalSearchParams<{ id?: string; coachId?: string }>();
  const targetCoachId = id || coachId;
  console.log('[DEBUG coach-profile] 3. targetCoachId:', targetCoachId);

  // Fetch coach details
  const { data: coachResponse, isLoading } = useQuery({
    queryKey: ['coachProfile', targetCoachId],
    queryFn: async () => {
      console.log('[DEBUG coach-profile] queryFn executing for', targetCoachId);
      if (!targetCoachId) return null;
      const res = await api.get(`/coaches/${targetCoachId}`);
      return res.data;
    },
    enabled: !!targetCoachId
  });
  console.log('[DEBUG coach-profile] 4. after useQuery, isLoading:', isLoading);

  const coach: CoachProfile | null = coachResponse?.data || null;

  if (isLoading) {
    console.log('[DEBUG coach-profile] 5. returning loading view');
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#EEF3F9' }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FF5100" />
        </View>
      </SafeAreaView>
    );
  }

  if (!coach) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#EEF3F9' }} edges={['top']}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
            <Ionicons name="arrow-back" size={24} color="#0F2C59" />
          </TouchableOpacity>
          <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold ml-4">
            Profile Not Found
          </Typography>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Typography variant="subtitle1" color="secondary" className="mb-4 text-center font-outfit-semibold">
            We couldn't retrieve this coach's profile details.
          </Typography>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const coachName = coach.name || `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || 'Coach';
  const coachInitials = coachName.split(' ').map(n => n[0]).join('');
  const coachSport = coach.sport || coach.sports?.[0] || 'Sports Expert';
  const rating = coach.rating || '4.8';
  const reviews = coach.reviewsCount || coach.reviews || '120';
  const specialties = coach.specialties || [];
  const bio = coach.bio || "Professional coach with verified experience in training students of all ages. Let's improve your game!";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#EEF3F9' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', zIndex: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
          Coach Profile
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, paddingHorizontal: 16, paddingTop: 24 }} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Main Info Card */}
        <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 24, marginBottom: 20, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#F5CEAA', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Typography variant="h1" color="primary" weight="bold" className="font-outfit-bold text-[28px]">{coachInitials}</Typography>
          </View>
          <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-1">{coachName}</Typography>
          <Typography variant="body1" color="primary" weight="bold" className="mb-3 font-outfit-bold">{coachSport}</Typography>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, borderWidth: 1, borderColor: '#f3f4f6' }}>
            <Ionicons name="star" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
            <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">{rating} • {reviews} Reviews</Typography>
          </View>
        </View>

        {/* Experience Details */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center' }}>
            <Ionicons name="ribbon-outline" size={24} color="#FF5100" style={{ marginBottom: 4 }} />
            <Typography variant="caption" color="muted" className="font-outfit mb-0.5">Experience</Typography>
            <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">{coach.experience || '3+'} Years</Typography>
          </View>
          <View style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f3f4f6', alignItems: 'center' }}>
            <Ionicons name="location-outline" size={24} color="#FF5100" style={{ marginBottom: 4 }} />
            <Typography variant="caption" color="muted" className="font-outfit mb-0.5">City</Typography>
            <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">{coach.city || 'Hyderabad'}</Typography>
          </View>
        </View>

        {/* About/Bio Section */}
        <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#f3f4f6' }}>
          <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-2 font-outfit-bold">About</Typography>
          <Typography variant="body2" color="text" className="leading-5 font-outfit text-gray-600">
            {bio}
          </Typography>
        </View>

        {/* Specialties/Skills */}
        {specialties.length > 0 && (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#f3f4f6' }}>
            <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-3 font-outfit-bold">Specialties & Skills</Typography>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {specialties.map((spec, i) => (
                <View key={i} style={{ backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#ffedd5', borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">{spec}</Typography>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Book Button */}
      <View style={{ position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#ffffff', padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingBottom: Math.max(insets.bottom + 16, 32), zIndex: 20 }}>
        <Button 
          title="Book Session" 
          onPress={() => router.push({
            pathname: '/select-date',
            params: { coachId: targetCoachId }
          })}
        />
      </View>
    </SafeAreaView>
  );
}
