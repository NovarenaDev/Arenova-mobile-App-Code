import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'feed' | 'programs'>('feed');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [postText, setPostText] = useState('');
  const [postMediaUrl, setPostMediaUrl] = useState('');
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);

  // Fetch Community Posts
  const { data: postsData, isLoading: isLoadingPosts, refetch: refetchPosts, isRefetching: isRefetchingPosts } = useQuery({
    queryKey: ['communityPosts'],
    queryFn: async () => {
      try {
        const res = await api.get('/community');
        return res.data?.data || res.data;
      } catch (e) {
        console.log('Community posts fetch error:', e);
        return [];
      }
    },
    enabled: activeTab === 'feed'
  });

  // Fetch Public Coaching Communities
  const { data: communitiesData, isLoading: isLoadingCommunities, refetch: refetchCommunities } = useQuery({
    queryKey: ['publicCommunities'],
    queryFn: async () => {
      try {
        const res = await api.get('/communities');
        return res.data?.data || res.data;
      } catch (e) {
        console.log('Communities API fetch error:', e);
        return [];
      }
    },
    enabled: activeTab === 'programs'
  });

  // Fetch Single Community details
  const { data: communityDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['publicCommunityDetail', selectedCommunityId],
    queryFn: async () => {
      if (!selectedCommunityId) return null;
      try {
        const res = await api.get(`/communities/${selectedCommunityId}`);
        return res.data?.data || res.data;
      } catch (e) {
        console.log('Community detail fetch error:', e);
        return null;
      }
    },
    enabled: !!selectedCommunityId
  });

  // Create Post mutation
  const createPostMutation = useMutation({
    mutationFn: async (payload: { text: string; mediaUrl?: string }) => {
      const res = await api.post('/community', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communityPosts'] });
      setIsCreateModalVisible(false);
      setPostText('');
      setPostMediaUrl('');
      Alert.alert('Post Published!', 'Your post has been shared with the sports community.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to share post.');
    }
  });

  // Like Post mutation
  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await api.put(`/community/${postId}/like`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communityPosts'] });
    }
  });

  // Delete Post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await api.delete(`/community/${postId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communityPosts'] });
      Alert.alert('Deleted', 'Post removed.');
    }
  });

  const posts = Array.isArray(postsData) ? postsData : (postsData?.posts || postsData?.data || []);
  const communities = Array.isArray(communitiesData) ? communitiesData : (communitiesData?.communities || communitiesData?.data || []);

  const handleCreatePost = () => {
    if (!postText.trim()) {
      Alert.alert('Empty Post', 'Please write something to share.');
      return;
    }
    createPostMutation.mutate({
      text: postText.trim(),
      mediaUrl: postMediaUrl.trim() || undefined
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 flex-row justify-between items-center bg-[#0F2C59] border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }} 
          className="p-2 -ml-2"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold">
          Sports Community
        </Typography>
        <TouchableOpacity 
          onPress={() => activeTab === 'feed' ? setIsCreateModalVisible(true) : refetchCommunities()}
          className="p-2 -mr-2"
        >
          <Ionicons name={activeTab === 'feed' ? "create-outline" : "refresh"} size={22} color="#FF5100" />
        </TouchableOpacity>
      </View>

      {/* Tabs Row */}
      <View className="px-4 pt-4 pb-2 bg-white border-b border-gray-100">
        <View className="flex-row bg-[#EEF3F9] rounded-full p-1 border border-gray-200">
          <TouchableOpacity
            onPress={() => setActiveTab('feed')}
            className={`flex-1 py-2.5 rounded-full items-center justify-center ${activeTab === 'feed' ? 'bg-secondary' : 'bg-transparent'}`}
          >
            <Typography variant="subtitle2" color={activeTab === 'feed' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold">
              Community Feed
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('programs')}
            className={`flex-1 py-2.5 rounded-full items-center justify-center ${activeTab === 'programs' ? 'bg-secondary' : 'bg-transparent'}`}
          >
            <Typography variant="subtitle2" color={activeTab === 'programs' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold">
              Coaching Programs
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Views */}
      {activeTab === 'feed' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 80, 100) }}
        >
          {/* Post Creation Prompt */}
          <TouchableOpacity
            onPress={() => setIsCreateModalVisible(true)}
            activeOpacity={0.8}
            className="bg-white rounded-3xl p-4 mb-4 shadow-sm border border-gray-100 flex-row items-center"
          >
            <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
              <Ionicons name="person-circle" size={28} color="#FF5100" />
            </View>
            <Typography variant="body2" color="muted" className="font-outfit flex-1">
              Share your sports progress, updates, or photos...
            </Typography>
            <View className="bg-primary px-3 py-1.5 rounded-full">
              <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                Post
              </Typography>
            </View>
          </TouchableOpacity>

          {isLoadingPosts || isRefetchingPosts ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#FF5100" />
              <Typography variant="body2" color="muted" className="mt-2 font-outfit">
                Loading feed...
              </Typography>
            </View>
          ) : posts.length === 0 ? (
            <View className="bg-white rounded-3xl p-8 items-center border border-gray-100 shadow-sm my-4">
              <View className="w-16 h-16 rounded-full bg-orange-50 items-center justify-center mb-3">
                <Ionicons name="people-outline" size={32} color="#FF5100" />
              </View>
              <Typography variant="h3" color="secondary" weight="bold" align="center" className="mb-2 font-outfit-bold">
                No Posts Yet
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="mb-6 font-outfit">
                Be the first to share an update, training achievement, or photo with the community!
              </Typography>
              <Button title="Create First Post" onPress={() => setIsCreateModalVisible(true)} fullWidth={false} className="px-6" />
            </View>
          ) : (
            posts.map((post: any, idx: number) => {
              const postId = post._id || post.id || idx.toString();
              const authorName = post.authorName || post.user?.name || post.author?.name || 'Sports Member';
              const text = post.text || post.content || '';
              const media = post.mediaUrl || post.image || post.imageUrl;
              const likesCount = post.likesCount || (Array.isArray(post.likes) ? post.likes.length : 0);
              const isLiked = post.isLiked || false;
              const isOwner = post.userId === user?.id || post.user?._id === user?.id;

              return (
                <View key={postId} className="bg-white rounded-3xl p-5 mb-4 border border-gray-100 shadow-sm">
                  {/* Post Author Header */}
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-full bg-[#FFF5F0] items-center justify-center mr-3 border border-orange-100">
                        <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold">
                          {authorName.substring(0, 2).toUpperCase()}
                        </Typography>
                      </View>
                      <View>
                        <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                          {authorName}
                        </Typography>
                        <Typography variant="caption" color="muted" className="font-outfit text-xs">
                          {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'Community Member'}
                        </Typography>
                      </View>
                    </View>

                    {isOwner && (
                      <TouchableOpacity onPress={() => deletePostMutation.mutate(postId)} className="p-1">
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Post Content */}
                  <Typography variant="body1" color="secondary" className="font-outfit leading-6 mb-3">
                    {text}
                  </Typography>

                  {/* Media Image */}
                  {media && (
                    <View className="h-56 rounded-2xl overflow-hidden mb-3 bg-gray-100">
                      <Image source={{ uri: media }} className="w-full h-full" resizeMode="cover" />
                    </View>
                  )}

                  {/* Actions Row */}
                  <View className="flex-row items-center pt-3 border-t border-gray-100">
                    <TouchableOpacity 
                      onPress={() => likePostMutation.mutate(postId)}
                      className="flex-row items-center mr-6"
                    >
                      <Ionicons 
                        name={isLiked ? "heart" : "heart-outline"} 
                        size={20} 
                        color={isLiked ? "#EF4444" : "#6B7280"} 
                        className="mr-1.5"
                      />
                      <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                        {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
                      </Typography>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        /* Coaching Programs Tab */
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 60, 80) }}
        >
          {isLoadingCommunities ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#FF5100" />
              <Typography variant="body2" color="muted" className="mt-2 font-outfit">
                Loading coaching programs...
              </Typography>
            </View>
          ) : communities.length === 0 ? (
            <View className="bg-white rounded-3xl p-8 items-center border border-gray-100 shadow-sm my-4">
              <Ionicons name="sparkles-outline" size={38} color="#FF5100" className="mb-3" />
              <Typography variant="h3" color="secondary" weight="bold" align="center" className="mb-2 font-outfit-bold">
                No Active Communities Found
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="font-outfit mb-4">
                Coaching communities and training programs will be listed here.
              </Typography>
              <Button title="Refresh" onPress={() => refetchCommunities()} fullWidth={false} className="px-6" />
            </View>
          ) : (
            communities.map((c: any, idx: number) => {
              const cId = c._id || c.id || idx.toString();
              const name = c.name || c.title || 'Sports Community';
              const description = c.description || c.about || 'Join top-tier training programs & sports plans.';
              const sports = c.sports || c.sport || [];

              return (
                <TouchableOpacity
                  key={cId}
                  onPress={() => setSelectedCommunityId(cId)}
                  activeOpacity={0.85}
                  className="bg-white rounded-3xl p-5 mb-4 border border-gray-100 shadow-sm"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold flex-1 mr-2">
                      {name}
                    </Typography>
                    <View className="bg-orange-50 px-3 py-1 rounded-full border border-orange-100">
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs">
                        Active Program
                      </Typography>
                    </View>
                  </View>

                  <Typography variant="body2" color="muted" className="font-outfit leading-5 mb-3" numberOfLines={2}>
                    {description}
                  </Typography>

                  <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
                    <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                      {Array.isArray(sports) ? sports.join(', ') : 'Sports Training'}
                    </Typography>
                    <View className="flex-row items-center">
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold mr-1">
                        View Programs
                      </Typography>
                      <Ionicons name="chevron-forward" size={14} color="#FF5100" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* CREATE POST MODAL */}
      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/50 justify-end"
        >
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setIsCreateModalVisible(false)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
                Share Community Post
              </Typography>
              <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="What's happening in your sports journey?"
              placeholderTextColor="#9CA3AF"
              value={postText}
              onChangeText={setPostText}
              multiline
              style={{ minHeight: 110, textAlignVertical: 'top' }}
              className="bg-gray-50 border border-gray-200 rounded-2xl p-4 font-outfit text-secondary text-base mb-3"
            />

            <TextInput
              placeholder="Optional image/photo URL (https://...)"
              placeholderTextColor="#9CA3AF"
              value={postMediaUrl}
              onChangeText={setPostMediaUrl}
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-outfit text-secondary text-sm mb-5"
            />

            <Button
              title="Publish Post"
              onPress={handleCreatePost}
              isLoading={createPostMutation.isPending}
              disabled={!postText.trim() || createPostMutation.isPending}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* COMMUNITY DETAIL MODAL */}
      <Modal
        visible={!!selectedCommunityId}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCommunityId(null)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setSelectedCommunityId(null)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200 max-h-[85%]"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
                Community Details
              </Typography>
              <TouchableOpacity onPress={() => setSelectedCommunityId(null)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {isLoadingDetail ? (
              <ActivityIndicator size="small" color="#FF5100" style={{ paddingVertical: 20 }} />
            ) : communityDetail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-2">
                  {communityDetail.name || communityDetail.title}
                </Typography>
                <Typography variant="body2" color="muted" className="font-outfit leading-6 mb-4">
                  {communityDetail.description || 'Coaching community programs & plans.'}
                </Typography>

                {communityDetail.programs && communityDetail.programs.length > 0 && (
                  <View className="mb-4">
                    <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
                      Available Programs
                    </Typography>
                    {communityDetail.programs.map((prog: any, i: number) => (
                      <View key={i} className="p-3 bg-gray-50 rounded-2xl border border-gray-200 mb-2">
                        <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                          {prog.name || prog.title}
                        </Typography>
                        {prog.description && (
                          <Typography variant="caption" color="muted" className="font-outfit">
                            {prog.description}
                          </Typography>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                <Button title="Close" variant="white" onPress={() => setSelectedCommunityId(null)} className="mt-2" />
              </ScrollView>
            ) : (
              <Typography variant="body2" color="muted" align="center" className="py-4 font-outfit">
                Loaded community details.
              </Typography>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
