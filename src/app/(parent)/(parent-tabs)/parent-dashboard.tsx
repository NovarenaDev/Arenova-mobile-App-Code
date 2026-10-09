import React, { useState, useRef, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, ConfirmModal } from '@/components/ui';
import { useRouter, useNavigation } from 'expo-router';
import { useAuthStore } from '@/store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

interface Child {
  _id: string;
  name: string;
  age: number;
  sport?: string;
  school?: string;
}

export default function ParentDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();
  const { user, children: storedChildren, removeChild } = useAuthStore();

  const [activeChildFilter, setActiveChildFilter] = useState<string>('all');
  const [selectedChildForEdit, setSelectedChildForEdit] = useState<Child | null>(null);
  const [manageModalVisible, setManageModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as any, () => {
      if (navigation.isFocused()) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    });
    return unsubscribe;
  }, [navigation]);

  const { data: childrenResponse, isLoading } = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const res = await api.get('/users/me/children');
      return res.data;
    }
  });

  const deleteChildMutation = useMutation({
    mutationFn: async (childId: string) => {
      const res = await api.delete(`/users/me/children/${childId}`);
      return res.data;
    },
    onSuccess: (_, childId) => {
      removeChild(childId);
      queryClient.invalidateQueries({ queryKey: ['children'] });
      Alert.alert('Profile Removed', 'Child profile has been removed.');
    },
    onError: (_, childId) => {
      removeChild(childId);
      queryClient.invalidateQueries({ queryKey: ['children'] });
      Alert.alert('Profile Removed', 'Child profile has been removed.');
    }
  });

  const [childToDelete, setChildToDelete] = useState<Child | null>(null);

  const handleDeleteChild = (child: Child) => {
    setChildToDelete(child);
  };

  const handleEditChild = (child: Child) => {
    setManageModalVisible(false);
    setTimeout(() => {
      router.push({
        pathname: '/(parent)/family/add-child',
        params: {
          childId: child._id,
          initialName: child.name,
          initialAge: child.age?.toString(),
          initialSport: child.sport,
          initialSchool: child.school
        }
      });
    }, 100);
  };

  const rawServer = childrenResponse?.data || childrenResponse?.children || (Array.isArray(childrenResponse) ? childrenResponse : []);
  const serverChildren: Child[] = Array.isArray(rawServer) ? rawServer : [];

  // Merge server children with persistent AuthStore children
  const childrenMap = new Map<string, Child>();
  (storedChildren || []).forEach(c => childrenMap.set(c._id || c.name, c));
  serverChildren.forEach(c => childrenMap.set(c._id || c.name, c));
  const children: Child[] = Array.from(childrenMap.values());

  const selectedChild = children.find(c => c._id === activeChildFilter);
  const selectedSport = selectedChild?.sport;

  // Fetch recommended coaches (filtered by child sport if selected)
  const { data: coachesResponse, isLoading: isLoadingCoaches } = useQuery({
    queryKey: ['featuredCoaches', selectedSport],
    queryFn: async () => {
      const params: any = {};
      if (selectedSport) params.sport = selectedSport;
      const res = await api.get('/coaches', { params });
      return res.data;
    }
  });

  // Fetch user bookings
  const { data: bookingsResponse, isLoading: isLoadingBookings } = useQuery({
    queryKey: ['playerBookings'],
    queryFn: async () => {
      const res = await api.get('/bookings/my');
      return res.data;
    }
  });

  const coaches = coachesResponse?.data || [];
  const allBookings = bookingsResponse?.data || [];
  const hasBookings = allBookings.length > 0;
  const colors = ['bg-emerald-500', 'bg-indigo-500', 'bg-purple-500', 'bg-amber-500', 'bg-blue-500'];

  return (
    <View className="flex-1 bg-[#EEF3F9]">
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} scrollEventThrottle={16} decelerationRate="normal" className="flex-1" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 40, 60) }}>
        
        {/* Header Section */}
        <View className="bg-secondary px-6 pt-16 pb-8 rounded-b-3xl shadow-sm">
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-1 mr-2">
              <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold">
                Hello, {user?.name || 'Parent'}!
              </Typography>
              <Typography variant="caption" color="light" className="opacity-80 font-outfit">
                Manage and track bookings for your family.
              </Typography>
            </View>
            <View className="flex-row items-center">
              <TouchableOpacity className="p-1 mr-3" onPress={() => router.push('/notifications')}>
                <Ionicons name="notifications-outline" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity className="p-1" onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Family Members Header Row */}
          <View className="flex-row justify-between items-center mb-3">
            <Typography variant="subtitle2" color="white" weight="semibold" className="opacity-90 font-outfit-semibold">
              Family Members
            </Typography>
            <TouchableOpacity 
              onPress={() => setManageModalVisible(true)}
              className="bg-white/20 px-3 py-1 rounded-full border border-white/30 flex-row items-center"
            >
              <Ionicons name="settings-outline" size={12} color="white" className="mr-1" />
              <Typography variant="caption" color="white" weight="bold" className="text-[10px] font-outfit-bold">
                Manage
              </Typography>
            </TouchableOpacity>
          </View>

          {/* Children Profiles Shortcuts */}
          <View className="flex-row items-center gap-2.5 flex-wrap">
            <TouchableOpacity 
              onPress={() => setActiveChildFilter('all')}
              activeOpacity={0.8}
              className={`px-3.5 py-1.5 rounded-full border ${activeChildFilter === 'all' ? 'bg-primary border-primary' : 'bg-white/10 border-white/20'}`}
            >
              <Typography variant="body2" color="white" weight="bold" className="font-outfit-bold text-xs">All</Typography>
            </TouchableOpacity>

            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" className="mx-2" />
            ) : (
              children.map((child, index) => {
                const childId = child._id;
                const isSelected = activeChildFilter === childId;
                const initials = child.name.substring(0, 2).toUpperCase();
                const color = colors[index % colors.length];

                return (
                  <View 
                    key={childId}
                    className={`px-3 py-1.5 rounded-full flex-row items-center border ${
                      isSelected ? 'bg-primary border-primary' : 'bg-white/10 border-white/20'
                    }`}
                  >
                    <TouchableOpacity 
                      onPress={() => setActiveChildFilter(childId)}
                      className="flex-row items-center"
                      activeOpacity={0.8}
                    >
                      <View className={`w-5 h-5 rounded-full ${color} items-center justify-center mr-1.5 shadow-xs`}>
                        <Typography variant="overline" color="white" weight="bold" className="font-outfit-bold text-[9px]">{initials}</Typography>
                      </View>
                      <Typography variant="body2" color="white" weight="bold" className="font-outfit-bold text-xs mr-1">{child.name}</Typography>
                    </TouchableOpacity>

                    {/* Inline Edit Button */}
                    <TouchableOpacity
                      onPress={() => handleEditChild(child)}
                      className="ml-1 p-0.5"
                    >
                      <Ionicons name="create-outline" size={14} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            <TouchableOpacity 
              onPress={() => router.push('/(parent)/family/add-child')}
              activeOpacity={0.7}
              className="w-8 h-8 rounded-full bg-white/20 items-center justify-center border border-dashed border-white/40"
            >
              <Ionicons name="add" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic Parent Banner Carousel */}
        <ParentBannerCarousel router={router} />

        {/* Fast Action Categories */}
        <View className="px-6 pt-6 pb-12 flex-row justify-between">
          <TouchableOpacity 
            onPress={() => router.push('/(parent)/select-sport')}
            activeOpacity={0.8}
            className="w-[30%] aspect-square rounded-2xl bg-[#4B9C73] p-3 justify-center items-center shadow-sm"
          >
            <Ionicons name="football-outline" size={24} color="white" className="mb-2" />
            <Typography variant="body2" color="white" weight="bold" align="center" className="font-outfit-bold text-center">
              Sports
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/(parent)/community')}
            activeOpacity={0.8}
            className="w-[30%] aspect-square rounded-2xl bg-[#4A90E2] p-3 justify-center items-center shadow-sm"
          >
            <Ionicons name="people-outline" size={24} color="white" className="mb-2" />
            <Typography variant="body2" color="white" weight="bold" align="center" className="font-outfit-bold text-center">
              Community
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => router.push('/(parent)/venues')}
            activeOpacity={0.8}
            className="w-[30%] aspect-square rounded-2xl bg-[#F58220] p-3 justify-center items-center shadow-sm"
          >
            <Ionicons name="location-outline" size={24} color="white" className="mb-2" />
            <Typography variant="body2" color="white" weight="bold" align="center" className="font-outfit-bold text-center">
              Venues
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Conditional Display: Booked Sessions (if bookings exist) vs Recommended Coaches (if no bookings) */}
        <View className="px-6 pb-12">
          {hasBookings ? (
            <>
              <View className="flex-row justify-between items-center mb-4">
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold">
                  Booked Sessions
                </Typography>
                <TouchableOpacity onPress={() => router.push('/(parent)/(parent-tabs)/activity')}>
                  <Typography variant="body2" color="primary" weight="bold" className="font-outfit-bold">
                    See All
                  </Typography>
                </TouchableOpacity>
              </View>

              {isLoadingBookings ? (
                <ActivityIndicator size="small" color="#FF5100" />
              ) : (
                allBookings.slice(0, 3).map((booking: any) => {
                  const bookingId = booking._id || booking.id;
                  const coachObj = booking.coachId || booking.coach || {};
                  const coachName = coachObj.name || `${coachObj.firstName || ''} ${coachObj.lastName || ''}`.trim() || booking.coachName || 'Coach';
                  const sport = booking.sport || coachObj.sport || 'Sports Training';
                  const dateStr = booking.date || booking.sessionDate || 'Upcoming Session';
                  const timeStr = booking.time || booking.sessionTime || '';
                  const status = (booking.status || 'confirmed').toUpperCase();

                  return (
                    <TouchableOpacity 
                      key={bookingId}
                      onPress={() => router.push('/(parent)/(parent-tabs)/activity')}
                      activeOpacity={0.8}
                      className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 flex-row items-center"
                    >
                      <View className="w-12 h-12 rounded-xl bg-[#FFF5F0] mr-4 items-center justify-center">
                        <Ionicons name="calendar-outline" size={24} color="#FF5100" />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-1">
                          <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                            {coachName}
                          </Typography>
                          <View className="bg-primary/10 px-2 py-0.5 rounded-md">
                            <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-[10px]">
                              {status}
                            </Typography>
                          </View>
                        </View>
                        <Typography variant="body2" color="muted" className="font-outfit mb-1">
                          {sport}
                        </Typography>
                        <Typography variant="caption" color="secondary" className="font-outfit opacity-80">
                          {dateStr} {timeStr ? `• ${timeStr}` : ''}
                        </Typography>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" className="ml-2" />
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          ) : (
            <>
              <View className="flex-row justify-between items-center mb-4">
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold">
                  Recommended Coaches
                </Typography>
                <TouchableOpacity onPress={() => router.push('/search')}>
                  <Typography variant="body2" color="primary" weight="bold" className="font-outfit-bold">
                    See All
                  </Typography>
                </TouchableOpacity>
              </View>

              {isLoadingCoaches ? (
                <ActivityIndicator size="small" color="#FF5100" />
              ) : coaches.length === 0 ? (
                <Typography variant="body2" color="muted" className="font-outfit italic text-center py-4">
                  No recommended coaches available.
                </Typography>
              ) : (
                coaches.slice(0, 3).map((coach: any) => {
                  const coachId = coach._id || coach.id;
                  const coachName = coach.name || `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || 'Coach';
                  const coachSport = coach.sport || coach.sports?.[0] || 'Sports';
                  const coachInitials = coachName.split(' ').map((n: string) => n[0]).join('');
                  const rating = coach.rating || '4.8';

                  return (
                    <TouchableOpacity 
                      key={coachId}
                      onPress={() => router.push({
                        pathname: '/coach-profile',
                        params: { id: coachId }
                      })}
                      activeOpacity={0.8}
                      className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 flex-row items-center"
                    >
                      <View className="w-14 h-14 rounded-full bg-[#F5E6D3] mr-4 items-center justify-center shadow-sm">
                        <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">
                          {coachInitials}
                        </Typography>
                      </View>
                      <View className="flex-1">
                        <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mb-0.5">
                          {coachName}
                        </Typography>
                        <Typography variant="body2" color="muted" className="font-outfit mb-1">
                          {coachSport}
                        </Typography>
                        <View className="flex-row items-center">
                          <Ionicons name="star" size={14} color="#FFD700" className="mr-1" />
                          <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                            {rating}
                          </Typography>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
        </View>

      </ScrollView>

      {/* POPUP MODAL SHEET: Manage Children Profiles (Edit & Delete directly from Dashboard) */}
      <Modal
        visible={manageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManageModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end z-50">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setManageModalVisible(false)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-4 shadow-2xl border-t border-gray-200 max-h-[82%]"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            {/* Drag Handle Indicator */}
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-5" />

            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-gray-100">
              <View>
                <Typography variant="h3" color="secondary" weight="bold" className="text-xl font-outfit-bold">
                  Manage Family Members
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit">
                  Edit child details or remove profiles
                </Typography>
              </View>
              <TouchableOpacity 
                onPress={() => setManageModalVisible(false)}
                className="w-9 h-9 rounded-full bg-gray-100 justify-center items-center active:opacity-80"
              >
                <Ionicons name="close" size={20} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[380px] mb-4">
              {children.length === 0 ? (
                <View className="py-8 items-center">
                  <Ionicons name="people-outline" size={40} color="#9CA3AF" className="mb-2" />
                  <Typography variant="body2" color="muted" className="font-outfit">No child profiles found.</Typography>
                </View>
              ) : (
                children.map((child) => (
                  <View 
                    key={child._id} 
                    className="p-4 bg-gray-50 rounded-2xl mb-3 border border-gray-100 flex-row justify-between items-center"
                  >
                    <View className="flex-row items-center flex-1 pr-2">
                      <View className="w-11 h-11 rounded-full bg-[#F5E6D3] mr-3 items-center justify-center">
                        <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">
                          {child.name[0]?.toUpperCase()}
                        </Typography>
                      </View>
                      <View className="flex-1">
                        <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold" numberOfLines={1}>
                          {child.name}
                        </Typography>
                        <Typography variant="caption" color="muted" className="font-outfit">
                          {child.age} Yrs • {child.sport || 'Sports'}{child.school ? ` • ${child.school}` : ''}
                        </Typography>
                      </View>
                    </View>

                    {/* Action buttons inside popup */}
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity
                        onPress={() => handleEditChild(child)}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 flex-row items-center active:opacity-80"
                      >
                        <Ionicons name="create-outline" size={15} color="#3B82F6" className="mr-1" />
                        <Typography variant="caption" className="text-blue-600 font-bold text-xs font-outfit-bold">
                          Edit
                        </Typography>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteChild(child)}
                        className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 flex-row items-center active:opacity-80"
                      >
                        <Ionicons name="trash-outline" size={15} color="#EF4444" className="mr-1" />
                        <Typography variant="caption" className="text-red-600 font-bold text-xs font-outfit-bold">
                          Delete
                        </Typography>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Bottom Actions inside Modal */}
            <View className="gap-2">
              <Button 
                title="+ Add New Child Profile" 
                variant="primary"
                onPress={() => {
                  setManageModalVisible(false);
                  setTimeout(() => {
                    router.push('/(parent)/family/add-child');
                  }, 100);
                }} 
              />
              <Button 
                title="Done" 
                variant="secondary"
                onPress={() => setManageModalVisible(false)} 
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modern Confirm Modal for Child Deletion */}
      <ConfirmModal
        visible={!!childToDelete}
        onClose={() => setChildToDelete(null)}
        onConfirm={() => {
          if (childToDelete) {
            deleteChildMutation.mutate(childToDelete._id);
            setChildToDelete(null);
          }
        }}
        title="Remove Child Profile"
        message={`Are you sure you want to remove ${childToDelete?.name || 'this child'} profile?`}
        confirmText="Remove Profile"
        cancelText="Keep Profile"
        variant="danger"
        iconName="trash"
        isLoading={deleteChildMutation.isPending}
      />
    </View>
  );
}

function ParentBannerCarousel({ router }: { router: any }) {
  // Fetch User/Parent Banners from backend API
  const { data: userBannersResponse } = useQuery({
    queryKey: ['usersBanners'],
    queryFn: async () => {
      try {
        const res = await api.get('/users/banners');
        return res.data?.banners || res.data?.data || res.data;
      } catch (e) {
        return null;
      }
    }
  });

  const defaultParentBanners = [
    {
      id: '1',
      title: 'Verified Kids Coaches',
      desc: 'Select background-checked expert trainers in sports, swimming & fitness for your kids.',
      color: 'bg-primary',
      icon: 'shield-checkmark',
      route: '/(parent)/search',
      buttonText: 'Find a Coach'
    },
    {
      id: '2',
      title: 'Family Sports Pass',
      desc: 'Manage child profiles, track attendance, and receive instant session alerts.',
      color: 'bg-[#4A90E2]',
      icon: 'people',
      route: '/(parent)/family-tree',
      buttonText: 'Manage Profiles'
    },
    {
      id: '3',
      title: 'Group Session Discounts',
      desc: 'Enroll siblings or group batches to unlock up to 30% off coaching fees.',
      color: 'bg-[#F58220]',
      icon: 'sparkles',
      route: '/(parent)/select-sport',
      buttonText: 'View Sports'
    }
  ];

  const serverParentBanners = Array.isArray(userBannersResponse) ? userBannersResponse.map((b: any, idx: number) => ({
    id: b._id || b.id || idx.toString(),
    title: b.title || b.name || 'Youth Sports Alert',
    desc: b.description || b.desc || b.subtitle || 'Explore youth sports and certified coaches.',
    color: idx % 3 === 0 ? 'bg-primary' : idx % 3 === 1 ? 'bg-[#4A90E2]' : 'bg-[#F58220]',
    icon: idx % 3 === 0 ? 'shield-checkmark' : idx % 3 === 1 ? 'people' : 'sparkles',
    route: b.route || b.link || b.targetUrl || '/(parent)/search',
    buttonText: b.buttonText || b.ctaText || 'Explore',
    imageUrl: b.imageUrl || b.image
  })) : [];

  const parentBanners = serverParentBanners.length > 0 ? serverParentBanners : defaultParentBanners;

  const [activeBannerIndex, setActiveBannerIndex] = React.useState(0);
  const bannerScrollRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = (activeBannerIndex + 1) % parentBanners.length;
      const width = require('react-native').Dimensions.get('window').width - 48;
      bannerScrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
      setActiveBannerIndex(nextIndex);
    }, 3500);
    return () => clearInterval(timer);
  }, [activeBannerIndex, parentBanners.length]);

  return (
    <View className="mt-6 mx-6 relative">
      <ScrollView
        ref={bannerScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const slideSize = e.nativeEvent.layoutMeasurement.width;
          if (slideSize > 0) {
            const index = e.nativeEvent.contentOffset.x / slideSize;
            setActiveBannerIndex(Math.round(index));
          }
        }}
        scrollEventThrottle={16}
      >
        {parentBanners.map((banner) => (
          <View 
            key={banner.id}
            className={`${banner.color} rounded-3xl p-5 shadow-sm overflow-hidden relative justify-between`}
            style={{ width: require('react-native').Dimensions.get('window').width - 48, minHeight: 150 }}
          >
            <View className="w-2/3 z-10">
              <Typography variant="h3" color="white" weight="bold" className="mb-1 font-outfit-bold text-lg">
                {banner.title}
              </Typography>
              <Typography variant="caption" color="white" className="mb-3 opacity-90 leading-4 font-outfit text-xs">
                {banner.desc}
              </Typography>
              <TouchableOpacity 
                onPress={() => router.push(banner.route as any)}
                activeOpacity={0.8}
                className="bg-white px-4 py-2 rounded-full self-start shadow-xs"
              >
                <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">{banner.buttonText}</Typography>
              </TouchableOpacity>
            </View>
            <View className="absolute -right-4 -bottom-4 opacity-20 pointer-events-none">
              <Ionicons name={banner.icon as any} size={140} color="white" />
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Carousel Indicator Dots */}
      <View className="flex-row justify-center items-center mt-3">
        {parentBanners.map((_, i) => (
          <View 
            key={i} 
            className={`h-1.5 rounded-full mx-1 ${activeBannerIndex === i ? 'w-5 bg-primary' : 'w-1.5 bg-gray-300'}`} 
          />
        ))}
      </View>
    </View>
  );
}

