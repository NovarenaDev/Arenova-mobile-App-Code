import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/services/api';

export default function ReviewPlayerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { bookingId, coachName, dateDisplay, sport: initialSport } = useLocalSearchParams<{
    bookingId?: string;
    coachName?: string;
    dateDisplay?: string;
    sport?: string;
  }>();

  const [rating, setRating] = useState(0);
  const [sport, setSport] = useState(initialSport || 'Badminton');
  const [description, setDescription] = useState('');
  const [selectedFeedbacks, setSelectedFeedbacks] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sportsOptions = ['Badminton', 'Tennis', 'Football', 'Swimming', 'Yoga'];
  const feedbackOptions = ['Friendly', 'Professional', 'Wonderful', 'Great'];

  const toggleFeedback = (fb: string) => {
    if (selectedFeedbacks.includes(fb)) {
      setSelectedFeedbacks(selectedFeedbacks.filter(item => item !== fb));
    } else {
      setSelectedFeedbacks([...selectedFeedbacks, fb]);
    }
  };

  const submitReviewMutation = useMutation({
    mutationFn: async (payload: { bookingId: string; rating: number; text: string; tags: string[] }) => {
      const res = await api.post('/reviews', payload);
      return res.data;
    },
    onSuccess: () => {
      router.replace('/review-success');
    },
    onError: (err: any) => {
      setSubmitError(err?.response?.data?.message || err.message || 'Failed to submit review');
    }
  });

  const handleSendFeedback = () => {
    if (!bookingId) {
      router.replace('/review-success');
      return;
    }
    submitReviewMutation.mutate({
      bookingId,
      rating,
      text: description,
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
            Review Player
          </Typography>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="flex-1 px-4 pt-6" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 80, 100) }}>
          
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-[#F5CEAA] items-center justify-center mb-3">
              <Typography variant="h2" color="primary" weight="bold">
                {coachName?.substring(0, 2).toUpperCase() || 'CO'}
              </Typography>
            </View>
            <Typography variant="h3" color="secondary" weight="bold">{coachName || 'Coach Review'}</Typography>
            <Typography variant="body2" color="muted">{dateDisplay || 'Training Session'}</Typography>
          </View>

          {/* Rating */}
          <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm items-center">
            <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-4">
              How was the session?
            </Typography>
            <View className="flex-row gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} className="p-1">
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
          <View className="mb-6 px-1">
            <View className="px-4 py-2 rounded-full border bg-primary border-primary self-start">
              <Typography variant="body2" color="white" weight="bold">
                {sport}
              </Typography>
            </View>
          </View>

          {/* Quick Feedback */}
          <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 ml-1">
            Quick Feedback
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
            Additional Comments
          </Typography>
          <TextInput 
            placeholder="Write your feedback here..." 
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
            title="Send Feedback" 
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
