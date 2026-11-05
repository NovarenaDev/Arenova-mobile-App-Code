import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export default function ReviewPlayerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { 
    bookingId, 
    coachId, 
    coachName, 
    studentName, 
    dateDisplay, 
    sport: initialSport, 
    type = 'coach' 
  } = useLocalSearchParams<{
    bookingId?: string;
    coachId?: string;
    coachName?: string;
    studentName?: string;
    dateDisplay?: string;
    sport?: string;
    type?: string;
  }>();

  const isCoachReview = type !== 'player';
  const targetDisplayName = isCoachReview ? (coachName || 'Coach') : (studentName || 'Student');
  const targetInitials = (targetDisplayName || 'CO').substring(0, 2).toUpperCase();

  const [rating, setRating] = useState(0);
  const [sport, setSport] = useState(initialSport && initialSport.toLowerCase() !== 'sports' ? initialSport : 'Tennis');
  const availableSports = Array.from(new Set([sport, 'Tennis', 'Badminton', 'Football', 'Cricket', 'Basketball', 'Swimming', 'Table Tennis'])).filter(Boolean);
  const [description, setDescription] = useState('');
  const [selectedFeedbacks, setSelectedFeedbacks] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const feedbackOptions = isCoachReview
    ? ['Punctual', 'Technique Focus', 'Encouraging', 'Professional', 'Great Drills', 'Friendly']
    : ['Attentive', 'Hard Working', 'Great Focus', 'Punctual', 'Disciplined', 'Quick Learner'];

  const toggleFeedback = (fb: string) => {
    if (selectedFeedbacks.includes(fb)) {
      setSelectedFeedbacks(selectedFeedbacks.filter(item => item !== fb));
    } else {
      setSelectedFeedbacks([...selectedFeedbacks, fb]);
    }
  };

  const submitReviewMutation = useMutation({
    mutationFn: async (payload: { 
      bookingId?: string; 
      coachId?: string; 
      sport?: string;
      rating: number; 
      text: string; 
      tags: string[] 
    }) => {
      const reviewBody = {
        bookingId: payload.bookingId,
        booking: payload.bookingId,
        coachId: payload.coachId,
        coach: payload.coachId,
        sport: payload.sport,
        rating: payload.rating,
        stars: payload.rating,
        text: payload.text,
        comment: payload.text,
        review: payload.text,
        feedback: payload.text,
        tags: payload.tags
      };

      try {
        const res = await api.post('/reviews', reviewBody);
        return res.data;
      } catch (err: any) {
        if (err?.response?.status === 404 && payload.bookingId) {
          try {
            const res2 = await api.post(`/bookings/${payload.bookingId}/review`, reviewBody);
            return res2.data;
          } catch {
            if (payload.coachId) {
              const res3 = await api.post(`/coaches/${payload.coachId}/reviews`, reviewBody);
              return res3.data;
            }
          }
        }
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerBookings'] });
      queryClient.invalidateQueries({ queryKey: ['parentBookings'] });
      queryClient.invalidateQueries({ queryKey: ['coachSessions'] });
      queryClient.invalidateQueries({ queryKey: ['segmentedSessions'] });
      if (bookingId) {
        queryClient.invalidateQueries({ queryKey: ['bookingDetail', bookingId] });
      }
      if (coachId) {
        queryClient.invalidateQueries({ queryKey: ['coachProfile', coachId] });
      }
      router.replace({
        pathname: '/review-success',
        params: {
          name: targetDisplayName,
          type: isCoachReview ? 'coach' : 'player'
        }
      });
    },
    onError: (err: any) => {
      setSubmitError(err?.response?.data?.message || err?.message || 'Failed to submit review');
    }
  });

  const handleSendFeedback = () => {
    if (rating === 0) {
      setSubmitError('Please select a star rating (1 to 5).');
      return;
    }
    setSubmitError(null);
    submitReviewMutation.mutate({
      bookingId: bookingId || '',
      coachId: coachId || '',
      sport,
      rating,
      text: description.trim(),
      tags: selectedFeedbacks.map(fb => fb.toLowerCase())
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        {/* Header */}
        <View className="px-4 py-4 flex-row items-center bg-white border-b border-gray-100 shadow-sm z-10">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-4">
            <Ionicons name="arrow-back" size={24} color="#0F2C59" />
          </TouchableOpacity>
          <Typography variant="h2" color="secondary" weight="bold">
            {isCoachReview ? 'Rate & Review Coach' : 'Review Player'}
          </Typography>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="flex-1 px-4 pt-6" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 80, 100) }}>
          
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-[#F5CEAA] items-center justify-center mb-3">
              <Typography variant="h2" color="primary" weight="bold">
                {targetInitials}
              </Typography>
            </View>
            <Typography variant="h3" color="secondary" weight="bold">{targetDisplayName}</Typography>
            <Typography variant="body2" color="muted">{dateDisplay || 'Training Session'}</Typography>
          </View>

          {/* Rating */}
          <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm items-center">
            <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-4">
              {isCoachReview ? `How was your session with ${targetDisplayName}?` : 'How did the player perform?'}
            </Typography>
            <View className="flex-row gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => { setRating(star); setSubmitError(null); }} className="p-1">
                  <Ionicons 
                    name={star <= rating ? 'star' : 'star-outline'} 
                    size={36} 
                    color="#FFD700" 
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Select Sport */}
          <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 ml-1">
            Sport Area
          </Typography>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            <View className="flex-row gap-2 px-1">
              {availableSports.map((s) => {
                const isSelected = sport.toLowerCase() === s.toLowerCase();
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSport(s)}
                    className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                  >
                    <Typography variant="body2" color={isSelected ? 'white' : 'secondary'} weight={isSelected ? 'bold' : 'medium'}>
                      {s}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Quick Feedback */}
          <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 ml-1">
            Quick Feedback Tags
          </Typography>
          <View className="flex-row flex-wrap gap-2 mb-6 ml-1">
            {feedbackOptions.map((item) => {
              const isSelected = selectedFeedbacks.includes(item);
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => toggleFeedback(item)}
                  className={`px-4 py-2 rounded-full border ${isSelected ? 'bg-secondary border-secondary' : 'bg-white border-gray-200'}`}
                >
                  <Typography variant="body2" color={isSelected ? 'white' : 'muted'} weight={isSelected ? 'bold' : 'medium'}>
                    {item}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description */}
          <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 ml-1">
            {isCoachReview ? 'Review & Comments (Optional)' : 'Performance Notes (Optional)'}
          </Typography>
          <TextInput 
            placeholder={isCoachReview ? "Share your experience with this coach's training..." : "Write performance notes..."} 
            value={description}
            onChangeText={setDescription}
            multiline 
            style={{ minHeight: 120, textAlignVertical: 'top' }} 
            className="bg-white border-0 shadow-sm mb-6"
          />

          {submitError && (
            <Typography variant="caption" color="error" className="mb-4 text-center font-outfit">
              {submitError}
            </Typography>
          )}

          <Button 
            title="Submit Review" 
            onPress={handleSendFeedback} 
            disabled={rating === 0 || submitReviewMutation.isPending}
            isLoading={submitReviewMutation.isPending}
            className="mb-8"
          />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
