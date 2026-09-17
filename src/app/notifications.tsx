import React, { useState } from 'react';
import { View, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, ConfirmModal } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

const getNotificationStyles = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'booking':
      return { icon: 'calendar-outline', color: '#4B9C73', bgColor: '#4B9C7320' };
    case 'reminder':
    case 'session_reminder':
      return { icon: 'time-outline', color: '#F58220', bgColor: '#F5822020' };
    case 'feedback':
    case 'review':
      return { icon: 'star-outline', color: '#FFD700', bgColor: '#FFD70020' };
    case 'promo':
    case 'bonus':
      return { icon: 'gift-outline', color: '#4A90E2', bgColor: '#4A90E220' };
    default:
      return { icon: 'notifications-outline', color: '#0F2C59', bgColor: '#0F2C5920' };
  }
};

const formatRelativeTime = (dateString: string) => {
  if (!dateString) return '';
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    
    if (isNaN(date.getTime())) return '';
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isMarkAllModalVisible, setIsMarkAllModalVisible] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<string | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching
  } = useInfiniteQuery({
    queryKey: ['notifications', filter],
    queryFn: async ({ pageParam = 1 }) => {
      const params: any = { page: pageParam, limit: 20 };
      if (filter === 'unread') {
        params.unread = 'true';
      }
      const res = await api.get('/notifications', { params });
      return res.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((acc, page) => acc + (page.data?.length || 0), 0);
      const total = lastPage.total || 0;
      if (loadedCount < total) {
        return allPages.length + 1;
      }
      return undefined;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/notifications/${id}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put('/notifications/read-all');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      Alert.alert('Success', 'All notifications marked as read.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/notifications/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.pages.flatMap((page) => page.data || []) || [];
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  const handleMarkAllRead = () => {
    setIsMarkAllModalVisible(true);
  };

  const renderEmptyComponent = () => (
    <View className="flex-1 items-center justify-center py-20 px-8">
      <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-4 shadow-sm">
        <Ionicons name="notifications-off-outline" size={40} color="#9CA3AF" />
      </View>
      <Typography variant="subtitle1" color="secondary" weight="semibold" className="mb-1 text-center font-outfit-semibold">
        No notifications yet
      </Typography>
      <Typography variant="body2" color="muted" align="center">
        {filter === 'unread' 
          ? "You don't have any unread notifications at the moment."
          : "We'll let you know when something new or important comes up!"}
      </Typography>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center justify-between bg-white border-b border-gray-100 shadow-sm z-10">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
            <Ionicons name="arrow-back" size={24} color="#0F2C59" />
          </TouchableOpacity>
          <Typography variant="h2" color="secondary" weight="bold">
            Notifications
          </Typography>
        </View>
        
        {hasUnread && (
          <TouchableOpacity 
            onPress={handleMarkAllRead} 
            disabled={markAllReadMutation.isPending}
            className="px-3 py-1.5 bg-orange-50 rounded-full active:opacity-75"
          >
            <Typography variant="caption" color="primary" weight="semibold">
              Mark all read
            </Typography>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white border-b border-gray-100 px-4">
        <TouchableOpacity 
          onPress={() => setFilter('all')} 
          className={`flex-1 py-3 items-center border-b-2 ${filter === 'all' ? 'border-primary' : 'border-transparent'}`}
        >
          <Typography 
            variant="subtitle2" 
            color={filter === 'all' ? 'primary' : 'muted'} 
            weight={filter === 'all' ? 'semibold' : 'normal'}
          >
            All
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setFilter('unread')} 
          className={`flex-1 py-3 items-center border-b-2 ${filter === 'unread' ? 'border-primary' : 'border-transparent'}`}
        >
          <View className="flex-row items-center">
            <Typography 
              variant="subtitle2" 
              color={filter === 'unread' ? 'primary' : 'muted'} 
              weight={filter === 'unread' ? 'semibold' : 'normal'}
            >
              Unread
            </Typography>
            {unreadCount > 0 && (
              <View className="ml-1.5 px-2 py-0.5 bg-primary rounded-full items-center justify-center">
                <Typography variant="overline" color="white" className="text-[10px] leading-3 font-outfit-bold">
                  {unreadCount}
                </Typography>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF5100" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const styles = getNotificationStyles(item.type);
            return (
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => {
                  if (!item.isRead) {
                    markAsReadMutation.mutate(item._id);
                  }
                }}
                className={`bg-white rounded-2xl p-4 flex-row mb-4 shadow-sm border relative overflow-hidden ${!item.isRead ? 'border-primary/20 bg-white' : 'border-transparent'}`}
              >
                {/* Unread indicator dot */}
                {!item.isRead && (
                  <View className="absolute top-4 left-4 w-2.5 h-2.5 rounded-full bg-primary z-10" />
                )}
                
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: styles.bgColor }}
                >
                  <Ionicons name={styles.icon as any} size={24} color={styles.color} />
                </View>
                
                <View className="flex-1 mr-2">
                  <View className="flex-row justify-between items-start mb-1">
                    <Typography 
                      variant="subtitle1" 
                      color="secondary" 
                      weight={!item.isRead ? 'bold' : 'medium'} 
                      className="flex-1 mr-2"
                    >
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="muted">
                      {formatRelativeTime(item.createdAt)}
                    </Typography>
                  </View>
                  <Typography variant="body2" color="text" className="leading-5">
                    {item.body}
                  </Typography>
                </View>
                
                {/* Delete button */}
                <TouchableOpacity 
                  onPress={() => setNotificationToDelete(item._id)}
                  className="p-1 justify-center items-center"
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: Math.max(insets.bottom + 40, 60) }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={isRefetching && !isFetchingNextPage} 
              onRefresh={refetch} 
              colors={['#FF5100']}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#FF5100" />
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmptyComponent}
        />
      )}
      {/* Modern Confirm Modal for Mark All Read */}
      <ConfirmModal
        visible={isMarkAllModalVisible}
        onClose={() => setIsMarkAllModalVisible(false)}
        onConfirm={() => {
          setIsMarkAllModalVisible(false);
          markAllReadMutation.mutate();
        }}
        title="Mark All as Read"
        message="Are you sure you want to mark all notifications as read?"
        confirmText="Mark Read"
        cancelText="Cancel"
        variant="warning"
        iconName="checkmark-done"
        isLoading={markAllReadMutation.isPending}
      />

      {/* Modern Confirm Modal for Delete Notification */}
      <ConfirmModal
        visible={!!notificationToDelete}
        onClose={() => setNotificationToDelete(null)}
        onConfirm={() => {
          if (notificationToDelete) {
            deleteMutation.mutate(notificationToDelete);
            setNotificationToDelete(null);
          }
        }}
        title="Delete Notification"
        message="Are you sure you want to delete this notification?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        iconName="trash"
        isLoading={deleteMutation.isPending}
      />
    </SafeAreaView>
  );
}
