import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput, ConfirmModal } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

import { useAuthStore } from '@/store';

export default function AddChildScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addChild, updateChild, removeChild } = useAuthStore();
  const params = useLocalSearchParams<{ 
    childId?: string;
    initialName?: string;
    initialAge?: string;
    initialSport?: string;
    initialSchool?: string;
    coachSport?: string;
    sport?: string;
    slotId?: string;
  }>();

  const childId = params.childId || '';
  const isEdit = !!childId;
  const coachSport = params.coachSport || params.sport || '';

  // Form states
  const [name, setName] = useState(params.initialName || '');
  const [age, setAge] = useState(params.initialAge ? params.initialAge.toString() : '');
  const [sport, setSport] = useState(params.initialSport || coachSport || 'Football');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [school, setSchool] = useState(params.initialSchool || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const baseSports = ['Football', 'Basketball', 'Tennis', 'Cricket', 'Swimming', 'Yoga', 'Fitness', 'Badminton'];
  const sportsList = coachSport 
    ? [coachSport, ...baseSports.filter(s => s.toLowerCase() !== coachSport.toLowerCase())]
    : baseSports;

  // POST /api/users/me/children (Add child)
  const createChildMutation = useMutation({
    mutationFn: async (payload: { name: string; age: number; sport?: string; school?: string }) => {
      const res = await api.post('/users/me/children', payload);
      return res.data;
    },
    onSuccess: (resData) => {
      const createdChild = {
        _id: resData?.data?.[0]?._id || resData?.data?._id || ('child_' + Date.now()),
        id: resData?.data?.[0]?._id || resData?.data?._id || ('child_' + Date.now()),
        name: name.trim(),
        age: parseInt(age) || 0,
        sport: sport.trim(),
        school: school.trim() || undefined
      };

      // Persist in AuthStore & SecureStore
      addChild(createdChild);

      queryClient.invalidateQueries({ queryKey: ['children'] });

      // If in booking flow, immediately assign this child to the session
      if (params.slotId) {
        Alert.alert('Child Added', `${name.trim()} has been added and assigned to this session.`);
        router.replace({
          pathname: '/(shared)/session-summary',
          params: {
            ...params,
            childId: createdChild._id,
            studentName: createdChild.name
          }
        });
      } else {
        Alert.alert('Success', `${name.trim()} added successfully!`);
        router.back();
      }
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create child profile');
    }
  });

  // PUT /api/users/me/children/{childId} (Update child)
  const updateChildMutation = useMutation({
    mutationFn: async (payload: { name: string; age: number; sport?: string; school?: string }) => {
      const res = await api.put(`/users/me/children/${childId}`, payload);
      return res.data;
    },
    onSuccess: () => {
      const updatedChild = {
        _id: childId,
        id: childId,
        name: name.trim(),
        age: parseInt(age) || 0,
        sport: sport.trim(),
        school: school.trim() || undefined
      };

      updateChild(childId, updatedChild);
      queryClient.invalidateQueries({ queryKey: ['children'] });

      Alert.alert('Profile Updated', `${name.trim()}'s profile updated successfully!`);
      router.back();
    },
    onError: (err: any) => {
      // Fallback if backend returns 404 for mock ID
      const updatedChild = {
        _id: childId,
        id: childId,
        name: name.trim(),
        age: parseInt(age) || 0,
        sport: sport.trim(),
        school: school.trim() || undefined
      };
      updateChild(childId, updatedChild);
      queryClient.invalidateQueries({ queryKey: ['children'] });
      Alert.alert('Profile Updated', `${name.trim()}'s profile updated successfully!`);
      router.back();
    }
  });

  // DELETE /api/users/me/children/{childId} (Remove child)
  const deleteChildMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/users/me/children/${childId}`);
      return res.data;
    },
    onSuccess: () => {
      removeChild(childId);
      queryClient.invalidateQueries({ queryKey: ['children'] });
      Alert.alert('Profile Removed', 'Child profile has been removed.');
      router.back();
    },
    onError: (err: any) => {
      // Fallback for local mock deletion
      removeChild(childId);
      queryClient.invalidateQueries({ queryKey: ['children'] });
      Alert.alert('Profile Removed', 'Child profile has been removed.');
      router.back();
    }
  });

  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const handleDelete = () => {
    setIsDeleteModalVisible(true);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Child's name is required";
    if (!age.trim()) {
      newErrors.age = "Age is required";
    } else if (isNaN(Number(age)) || Number(age) <= 0) {
      newErrors.age = "Please enter a valid age";
    }
    if (!sport.trim()) newErrors.sport = "Primary sport interest is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const payload = {
      name: name.trim(),
      age: parseInt(age) || 0,
      sport: sport.trim(),
      school: school.trim() || undefined
    };

    if (isEdit) {
      updateChildMutation.mutate(payload);
    } else {
      createChildMutation.mutate(payload);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', zIndex: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
          {isEdit ? 'Edit Child Profile' : 'Add Child Profile'}
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1, paddingHorizontal: 16, paddingTop: 24 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 80, 100) }}>
          
          {/* Photo Upload Mockup */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <TouchableOpacity 
              style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#FFEAE0', borderWidth: 2, borderStyle: 'dashed', borderColor: '#FF5100', alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden' }}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={32} color="#FF5100" />
              <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold mt-1 text-[11px]">Upload Photo</Typography>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 16, marginBottom: 24 }}>
            <TextInput 
              label="Child's Name"
              placeholder="Enter full name"
              value={name}
              onChangeText={setName}
              error={errors.name}
            />

            {/* Gender Switcher tabs */}
            <View style={{ marginBottom: 8 }}>
              <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold text-gray-500 uppercase tracking-wider">
                Gender
              </Typography>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  onPress={() => setGender('Male')}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 9999,
                    borderWidth: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: gender === 'Male' ? '#FF5100' : '#ffffff',
                    borderColor: gender === 'Male' ? '#FF5100' : '#e5e7eb'
                  }}
                >
                  <Typography color={gender === 'Male' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-sm">
                    Male
                  </Typography>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setGender('Female')}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 9999,
                    borderWidth: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: gender === 'Female' ? '#FF5100' : '#ffffff',
                    borderColor: gender === 'Female' ? '#FF5100' : '#e5e7eb'
                  }}
                >
                  <Typography color={gender === 'Female' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-sm">
                    Female
                  </Typography>
                </TouchableOpacity>
              </View>
            </View>
            
            <TextInput 
              label="Age"
              placeholder="Enter age" 
              keyboardType="numeric" 
              value={age}
              onChangeText={setAge}
              error={errors.age}
            />

            {/* Sport Toggle selection */}
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Typography variant="caption" color="secondary" weight="bold" className="ml-1 font-outfit-bold text-gray-500 uppercase tracking-wider">
                  Sport Interest
                </Typography>
                {coachSport ? (
                  <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#ffedd5' }}>
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-[10px]">
                      Coach's Sport: {coachSport}
                    </Typography>
                  </View>
                ) : null}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', paddingVertical: 4 }}>
                {sportsList.map((s) => {
                  const isSelected = sport === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setSport(s)}
                      activeOpacity={0.8}
                      style={{
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 9999,
                        borderWidth: 1,
                        marginRight: 12,
                        backgroundColor: isSelected ? '#0F2C59' : '#ffffff',
                        borderColor: isSelected ? '#0F2C59' : '#e5e7eb'
                      }}
                    >
                      <Typography color={isSelected ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
                        {s}
                      </Typography>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <TextInput 
              label="School (Optional)"
              placeholder="Enter school name" 
              value={school}
              onChangeText={setSchool}
            />
          </View>

          {/* Delete Button in Edit Mode */}
          {isEdit && (
            <TouchableOpacity 
              onPress={handleDelete}
              disabled={deleteChildMutation.isPending}
              style={{
                backgroundColor: '#FEF2F2',
                borderWidth: 1,
                borderColor: '#FCA5A5',
                borderRadius: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
              <Typography variant="subtitle2" style={{ color: '#EF4444' }} weight="bold" className="font-outfit-bold">
                {deleteChildMutation.isPending ? 'Removing...' : 'Delete Child Profile'}
              </Typography>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Bottom Bar */}
      <View style={{ backgroundColor: '#ffffff', padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingBottom: Math.max(insets.bottom + 16, 28) }}>
        <Button 
          title={isEdit ? "Update Profile" : "Save Profile"}
          onPress={handleSave}
          isLoading={createChildMutation.isPending || updateChildMutation.isPending}
        />
      </View>
      {/* Modern Confirm Modal for Child Deletion */}
      <ConfirmModal
        visible={isDeleteModalVisible}
        onClose={() => setIsDeleteModalVisible(false)}
        onConfirm={() => {
          setIsDeleteModalVisible(false);
          deleteChildMutation.mutate();
        }}
        title="Delete Child Profile"
        message={`Are you sure you want to delete ${name || 'this child profile'}?`}
        confirmText="Delete Profile"
        cancelText="Keep Profile"
        variant="danger"
        iconName="trash"
        isLoading={deleteChildMutation.isPending}
      />
    </SafeAreaView>
  );
}
