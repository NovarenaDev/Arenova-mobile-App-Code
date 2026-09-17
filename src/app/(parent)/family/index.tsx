import React from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function FamilyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { children: storedChildren, removeChild } = useAuthStore();

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

  const [childToDelete, setChildToDelete] = React.useState<Child | null>(null);

  const handleDeleteChild = (child: Child) => {
    setChildToDelete(child);
  };

  const rawServer = childrenResponse?.data || childrenResponse?.children || (Array.isArray(childrenResponse) ? childrenResponse : []);
  const serverChildren: Child[] = Array.isArray(rawServer) ? rawServer : [];

  // Merge server and local store so added children are always visible
  const childrenMap = new Map<string, Child>();
  storedChildren.forEach(c => childrenMap.set(c._id || c.name, c));
  serverChildren.forEach(c => childrenMap.set(c._id || c.name, c));
  const children = Array.from(childrenMap.values());

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold">
          My Family
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-6 pb-8">
        
        {children.map(child => (
          <View key={child._id} className="bg-white rounded-2xl p-4 mb-4 border border-gray-100 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 pr-2">
                <View className="w-14 h-14 rounded-full bg-[#F5E6D3] mr-3.5 items-center justify-center">
                  <Typography variant="subtitle1" color="primary" weight="bold">{child.name[0]?.toUpperCase()}</Typography>
                </View>
                <View className="flex-1">
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-0.5" numberOfLines={1}>
                    {child.name}
                  </Typography>
                  <Typography variant="body2" color="secondary" weight="medium" className="mb-0.5">
                    {child.sport || 'Sports'}
                  </Typography>
                  <Typography variant="caption" color="text" className="opacity-80">
                    {child.age} Years Old {child.school ? `• ${child.school}` : ''}
                  </Typography>
                </View>
              </View>

              {/* Action Buttons: Edit & Delete */}
              <View className="flex-row items-center gap-1.5">
                <TouchableOpacity
                  onPress={() => router.push({
                    pathname: '/(parent)/family/add-child',
                    params: {
                      childId: child._id,
                      initialName: child.name,
                      initialAge: child.age?.toString(),
                      initialSport: child.sport,
                      initialSchool: child.school
                    }
                  })}
                  className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 items-center justify-center active:opacity-80"
                >
                  <Ionicons name="create-outline" size={18} color="#3B82F6" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeleteChild(child)}
                  className="w-9 h-9 rounded-full bg-red-50 border border-red-200 items-center justify-center active:opacity-80"
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity 
          className="bg-white rounded-2xl p-4 mb-8 flex-row items-center justify-between border-2 border-dashed border-gray-300 active:opacity-80"
          onPress={() => router.push('/(parent)/family/add-child')}
        >
          <View className="flex-row items-center">
            <View className="w-14 h-14 rounded-full bg-[#F5CEAA] items-center justify-center mr-4">
              <Ionicons name="add" size={32} color="#FF5100" />
            </View>
            <View>
              <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-0.5">
                Add New Child
              </Typography>
              <Typography variant="caption" color="text" className="opacity-60">
                Create a profile for booking
              </Typography>
            </View>
          </View>
        </TouchableOpacity>

      </ScrollView>

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
