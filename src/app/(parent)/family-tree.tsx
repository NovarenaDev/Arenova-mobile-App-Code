import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, ConfirmModal } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

import { useAuthStore } from '@/store';

interface Child {
  _id: string;
  name: string;
  age: number;
  sport?: string;
  school?: string;
}

export default function FamilyTreeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { children: storedChildren, removeChild } = useAuthStore();
  const [manageModalVisible, setManageModalVisible] = useState(false);

  // Fetch children list
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

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
          Family Tree
        </Typography>
        <TouchableOpacity 
          onPress={() => setManageModalVisible(true)}
          className="p-2 -mr-2 bg-orange-50 rounded-full border border-orange-200"
        >
          <Ionicons name="settings-outline" size={18} color="#FF5100" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-4 pb-8">
        {/* Banner Card - Clickable to Open Manage Children Popup Modal */}
        <TouchableOpacity 
          onPress={() => setManageModalVisible(true)}
          activeOpacity={0.85}
          className="bg-[#F5CEAA] rounded-2xl p-4 mb-5 flex-row items-center justify-between border border-[#EBA86A] shadow-sm"
        >
          <View className="flex-row items-center flex-1 pr-2">
            <View className="w-12 h-12 rounded-full bg-white mr-3.5 items-center justify-center shadow-sm">
              <Ionicons name="people" size={24} color="#FF5100" />
            </View>
            <View className="flex-1">
              <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                Manage Family Profiles
              </Typography>
              <Typography variant="caption" color="text" className="opacity-80 font-outfit">
                Tap to edit, delete or add children profiles
              </Typography>
            </View>
          </View>
          <View className="bg-white/80 px-2.5 py-1 rounded-full border border-[#EBA86A]">
            <Typography variant="caption" color="primary" weight="bold" className="text-[10px] font-outfit-bold">
              Manage
            </Typography>
          </View>
        </TouchableOpacity>

        <Typography variant="subtitle2" color="muted" weight="bold" className="mb-3 ml-1 uppercase font-outfit-bold">
          Active Account Profile
        </Typography>

        {/* Parent Profile */}
        <View className="bg-white rounded-2xl p-4 mb-4 flex-row items-center justify-between border border-gray-100 shadow-sm">
          <View className="flex-row items-center flex-1 mr-4">
            <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mr-3.5">
              <Ionicons name="person" size={22} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mb-0.5">
                Yourself
              </Typography>
              <Typography variant="caption" color="muted" className="font-outfit">
                Account Owner
              </Typography>
            </View>
          </View>
          <View className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            <Typography variant="caption" color="primary" weight="bold" className="text-[11px] font-outfit-bold text-blue-600">
              Primary Account
            </Typography>
          </View>
        </View>

        <Typography variant="subtitle2" color="muted" weight="bold" className="mb-3 ml-1 uppercase font-outfit-bold">
          Child Profiles
        </Typography>

        {/* Children Profiles */}
        {isLoading ? (
          <View className="py-10 justify-center items-center">
            <ActivityIndicator size="small" color="#FF5100" />
          </View>
        ) : (
          children.map((child) => (
            <View 
              key={child._id}
              className="bg-white rounded-2xl p-4 mb-4 border border-gray-100 flex-row items-center justify-between shadow-sm"
            >
              <View className="flex-row items-center flex-1 pr-2">
                <View className="w-12 h-12 rounded-full bg-emerald-50 items-center justify-center mr-3.5">
                  <Typography variant="subtitle1" className="text-emerald-700 font-bold font-outfit-bold">
                    {child.name[0]?.toUpperCase()}
                  </Typography>
                </View>
                <View className="flex-1">
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mb-0.5" numberOfLines={1}>
                    {child.name}
                  </Typography>
                  <Typography variant="body2" color="secondary" weight="medium" className="font-outfit-medium mb-0.5">
                    {child.sport || 'Sports'}
                  </Typography>
                  <Typography variant="caption" color="muted" className="font-outfit">
                    {child.age} Years Old {child.school ? `• ${child.school}` : ''}
                  </Typography>
                </View>
              </View>

              {/* Action Buttons: Edit & Delete */}
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => handleEditChild(child)}
                  className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 items-center justify-center active:opacity-80"
                >
                  <Ionicons name="create-outline" size={17} color="#3B82F6" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeleteChild(child)}
                  className="w-9 h-9 rounded-full bg-red-50 border border-red-200 items-center justify-center active:opacity-80"
                >
                  <Ionicons name="trash-outline" size={17} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Add New Child Profile Button */}
        <TouchableOpacity 
          className="bg-white rounded-2xl p-4 mb-8 flex-row items-center justify-between border border-dashed border-gray-300 active:opacity-80"
          onPress={() => router.push('/(parent)/family/add-child')}
        >
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-orange-50 items-center justify-center mr-3">
              <Ionicons name="add-circle" size={26} color="#FF5100" />
            </View>
            <View>
              <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mb-0.5">
                Add New Child
              </Typography>
              <Typography variant="caption" color="muted" className="font-outfit">
                Add Child Profile to Family Tree
              </Typography>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </ScrollView>

      {/* POPUP MODAL SHEET: Manage Family Members (Edit / Delete Children) */}
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
                  Manage Family Profiles
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
    </SafeAreaView>
  );
}
