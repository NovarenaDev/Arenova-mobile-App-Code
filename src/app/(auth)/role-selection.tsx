"use no memo";

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';

export default function RoleSelectionScreen() {
  const insets = useSafeAreaInsets();
  const [selectedRole, setSelectedRole] = useState<'individual' | 'parent' | 'coach' | null>(null);

  const roles = [
    { id: 'individual', title: 'Individual\nUser', icon: 'person' },
    { id: 'parent', title: 'Parent', icon: 'people' },
    { id: 'coach', title: 'Coach', icon: 'person-circle' },
  ] as const;


  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      <View className="flex-1 px-6 pt-4">
        
        <TouchableOpacity onPress={() => {
          try {
            router.back();
          } catch (e) {
            router.replace('/(auth)');
          }
        }} className="mb-8 p-2 -ml-2">
          <Ionicons name="arrow-back" size={28} color="#0F2C59" />
        </TouchableOpacity>

        <View className="items-center mb-10">
          <Typography variant="h1" color="secondary" className="mb-2 text-center font-bold">
            Welcome To Arenova
          </Typography>
          <Typography variant="body1" color="muted" className="text-center">
            Start your training journey today.
          </Typography>
        </View>

        <View className="flex-row justify-center mb-12 gap-5">
          {roles.map((role) => {
            const isSelected = selectedRole === role.id;
            return (
              <TouchableOpacity
                key={role.id}
                onPress={() => setSelectedRole(role.id)}
                activeOpacity={0.8}
                className="w-24"
              >
                <View 
                  className={isSelected 
                    ? "items-center justify-center aspect-square rounded-xl border-2 bg-secondary border-secondary"
                    : "items-center justify-center aspect-square rounded-xl border-2 bg-white border-gray-200 shadow-sm"
                  }
                >
                  {isSelected && (
                    <View className="absolute top-2 right-2 border-[1.5px] border-white rounded-sm w-4 h-4 items-center justify-center bg-transparent">
                      <Ionicons name="checkmark" size={12} color="white" />
                    </View>
                  )}
                  <Ionicons 
                    name={role.icon as any} 
                    size={48} 
                    color={isSelected ? '#FFFFFF' : '#0F2C59'} 
                    className="mb-3"
                  />
                </View>
                <Typography 
                  variant="subtitle2" 
                  color="secondary" 
                  className="mt-3 text-center"
                  weight={isSelected ? 'bold' : 'medium'}
                >
                  {role.title}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-1 justify-end" style={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}>
          <Button 
            title="Register" 
            disabled={!selectedRole}
            onPress={() => {
              router.push({ pathname: '/(auth)/register', params: { role: selectedRole } });
            }}
          />
          <View className="h-4" />
          <Button 
            title="Login" 
            variant="outline"
            disabled={!selectedRole}
            onPress={() => router.push({ pathname: '/(auth)/login', params: { role: selectedRole } })}
          />
        </View>

      </View>
    </SafeAreaView>
  );
}
