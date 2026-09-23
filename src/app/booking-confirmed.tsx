import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store';

export default function BookingConfirmedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { 
    coachName, 
    studentName, 
    sport, 
    date, 
    time, 
    amount, 
    txnId 
  } = useLocalSearchParams<{
    coachName?: string;
    studentName?: string;
    sport?: string;
    date?: string;
    time?: string;
    amount?: string;
    txnId?: string;
  }>();

  const displayCoachName = coachName || 'Coach';
  const displayStudentName = studentName || (user?.role === 'parent' ? 'Child' : user?.name || 'Player');
  const displaySport = sport || 'Sports';
  const displayDate = date || 'Confirmed Date';
  const displayTime = time || 'Scheduled Slot';
  const displayAmount = amount || '550';
  const displayTxnId = txnId || ("TXN" + Math.random().toString(36).substring(2, 10).toUpperCase());

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-12" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 40, 60) }}>
        
        {/* Success Header */}
        <View className="items-center mb-10">
          <View className="w-24 h-24 rounded-full items-center justify-center mb-6 relative" style={{ backgroundColor: '#4B9C73' }}>
            <Ionicons name="checkmark" size={48} color="white" />
            <View className="absolute -top-1 -right-1 w-2 h-2 rounded-full opacity-30" style={{ backgroundColor: '#4B9C73' }} />
            <View className="absolute top-2 -left-3 w-1.5 h-1.5 rounded-full opacity-30" style={{ backgroundColor: '#4B9C73' }} />
            <View className="absolute -bottom-2 right-2 w-2 h-2 rounded-full opacity-30" style={{ backgroundColor: '#4B9C73' }} />
          </View>
          <Typography variant="h1" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
            Booking Confirmed!
          </Typography>
          <Typography variant="body2" color="muted" className="font-outfit">
            Your Session Has Been Successfully Booked.
          </Typography>
        </View>

        {/* Booking Details Card */}
        <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
          <View className="flex-row items-center border-b border-gray-100 pb-4 mb-4">
            <View className="w-12 h-12 rounded-full mr-4 items-center justify-center" style={{ backgroundColor: '#F5E6D3' }}>
              <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold">
                {displayCoachName.substring(0, 2).toUpperCase()}
              </Typography>
            </View>
            <View>
              <Typography variant="caption" color="text" className="mb-0.5 opacity-80 font-outfit">
                Coach
              </Typography>
              <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                {displayCoachName}
              </Typography>
            </View>
          </View>

          <View className="flex-row items-center border-b border-gray-100 pb-4 mb-4">
            <View className="w-12 h-12 rounded-full mr-4 items-center justify-center bg-blue-50">
              <Ionicons name="person" size={20} color="#3B82F6" />
            </View>
            <View>
              <Typography variant="caption" color="text" className="mb-0.5 opacity-80 font-outfit">
                Attendee
              </Typography>
              <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                {displayStudentName}
              </Typography>
            </View>
          </View>

          <View className="flex-row justify-between mb-4">
            <View className="flex-1 border-r border-gray-100 pr-2">
              <Typography variant="caption" color="text" className="mb-1 opacity-80 font-outfit">
                Sport
              </Typography>
              <Typography variant="body2" color="text" weight="bold" className="font-outfit-bold">
                {displaySport}
              </Typography>
            </View>
            <View className="flex-1 pl-4 flex-row items-start">
              <Ionicons name="calendar-outline" size={16} color="#9CA3AF" className="mr-2 mt-0.5" />
              <View>
                <Typography variant="caption" color="text" className="mb-1 opacity-80 font-outfit">
                  Date
                </Typography>
                <Typography variant="body2" color="text" weight="bold" className="font-outfit-bold">
                  {displayDate}
                </Typography>
              </View>
            </View>
          </View>

          <View className="flex-row justify-between">
            <View className="flex-1 border-r border-gray-100 pr-2 flex-row items-start">
              <Ionicons name="time-outline" size={16} color="#9CA3AF" className="mr-2 mt-0.5" />
              <View>
                <Typography variant="caption" color="text" className="mb-1 opacity-80 font-outfit">
                  Time
                </Typography>
                <Typography variant="body2" color="text" weight="bold" className="font-outfit-bold">
                  {displayTime}
                </Typography>
              </View>
            </View>
            <View className="flex-1 pl-4 flex-row items-start">
              <Ionicons name="location-outline" size={16} color="#9CA3AF" className="mr-2 mt-0.5" />
              <View>
                <Typography variant="caption" color="text" className="mb-1 opacity-80 font-outfit">
                  Location
                </Typography>
                <Typography variant="body2" color="text" weight="bold" className="font-outfit-bold">
                  Sports Arena
                </Typography>
              </View>
            </View>
          </View>
        </View>

        {/* Payment Success Card */}
        <View className="bg-white rounded-2xl p-5 mb-8 shadow-sm border border-gray-100">
          <View className="flex-row items-center mb-6">
            <Ionicons name="checkmark-circle-outline" size={20} color="#4B9C73" className="mr-2" />
            <Typography variant="subtitle1" color="text" weight="bold" className="font-outfit-bold">
              Payment Successful
            </Typography>
          </View>

          <View className="flex-row justify-between mb-4">
            <View>
              <Typography variant="caption" color="text" className="mb-1 opacity-80 font-outfit">
                Paid Amount
              </Typography>
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
                ₹{displayAmount}
              </Typography>
            </View>
            <View className="items-end">
              <Typography variant="caption" color="text" className="mb-1 opacity-80 font-outfit">
                Payment Method
              </Typography>
              <Typography variant="body2" color="text" weight="bold" className="font-outfit-bold">
                Online (UPI/Card)
              </Typography>
            </View>
          </View>

          <View className="items-end">
            <Typography variant="caption" color="text" className="mb-0.5 opacity-80 font-outfit">
              Transaction ID
            </Typography>
            <Typography variant="caption" color="text" weight="bold" className="font-outfit-bold">
              {displayTxnId}
            </Typography>
          </View>
        </View>

        <View className="space-y-4 pb-10">
          {user?.role === 'parent' && (
            <View className="mb-4">
              <Button 
                title="Book Another Session" 
                onPress={() => router.push('/(parent)/family-tree')}
              />
            </View>
          )}
          <TouchableOpacity 
            className="w-full h-14 bg-[#F5E6D3] rounded-full items-center justify-center border border-[#EBA86A]"
            onPress={() => router.push(user?.role === 'parent' ? '/(parent)/(parent-tabs)/parent-dashboard' : '/(individual)/(individual-tabs)/individual-dashboard')}
          >
            <Typography variant="subtitle1" color="secondary" weight="bold">
              Back To Home
            </Typography>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
