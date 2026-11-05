import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

export default function SelectPlayerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const searchParams = useLocalSearchParams<{
    slotId?: string;
    coachId?: string;
    coachName?: string;
    coachSport?: string;
    date?: string;
    time?: string;
    price?: string;
  }>();
  const { user, children: storedChildren } = useAuthStore();

  // Strict Role Guard: Coaches cannot book coaching sessions
  React.useEffect(() => {
    if (user?.role === 'coach') {
      Alert.alert(
        'Access Denied (Role Boundary)',
        'Coaches cannot book coaching sessions. Please use your coach dashboard.'
      );
      router.replace('/(coach)/(coach-tabs)/coach-dashboard');
    }
  }, [user, router]);

  // Fetch children list from API
  const { data: childrenResponse, isLoading } = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const res = await api.get('/users/me/children');
      return res.data;
    }
  });

  const rawChildren = childrenResponse?.data || childrenResponse?.children || (Array.isArray(childrenResponse) ? childrenResponse : []);
  const serverChildren = Array.isArray(rawChildren) ? rawChildren : [];

  // Merge server and local store so newly added children are always visible immediately
  const childrenMap = new Map<string, any>();
  (storedChildren || []).forEach(c => childrenMap.set(c._id || c.name, c));
  serverChildren.forEach(c => childrenMap.set(c._id || c.name, c));
  const children = Array.from(childrenMap.values());

  const isParent = user?.role === 'parent';

  const players: { id: string; name: string; role: string; color: string; isChild: boolean }[] = [
    { 
      id: 'self', 
      name: user?.name ? `${user.name} (Myself / Parent)` : 'Myself (Parent)', 
      role: isParent ? 'Parent / Family Member' : 'Player (Self)', 
      color: 'bg-blue-100', 
      isChild: false 
    }
  ];

  // Always show all available children in the list
  if (children.length > 0) {
    children.forEach((child: any) => {
      players.push({
        id: child._id || child.id,
        name: child.name,
        role: `Child (${child.sport || searchParams.coachSport || 'Sports'})`,
        color: 'bg-emerald-100',
        isChild: true
      });
    });
  }

  // Selected player IDs (supports single or multiple attendees)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(() => {
    if (children.length > 0) {
      return [children[0]._id || children[0].id];
    }
    return isParent ? [] : ['self'];
  });

  // Keep selection updated when children load
  React.useEffect(() => {
    if (children.length > 0 && selectedPlayerIds.length === 0) {
      setSelectedPlayerIds([children[0]._id || children[0].id]);
    }
  }, [children.length]);

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(p => p !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Pricing calculations
  const perPersonFee = Number(searchParams.price || 0);
  const attendeeCount = selectedPlayerIds.length;
  const subtotal = attendeeCount * perPersonFee;
  const totalAmount = subtotal;

  const handleContinue = () => {
    if (selectedPlayerIds.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one attendee to proceed.');
      return;
    }

    const selectedPlayers = players.filter(p => selectedPlayerIds.includes(p.id));
    const selectedChildren = selectedPlayers.filter(p => p.isChild);
    const hasSelfSelected = selectedPlayerIds.includes('self');

    // Strict Parent Module Rule:
    // If in parent mode and the parent selects ONLY 'self' without at least one child:
    if (isParent && hasSelfSelected && selectedChildren.length === 0) {
      Alert.alert(
        'Child Selection Required',
        'In parent module, you must select at least one child. If you want to book a coaching session solely for yourself, please use an Individual Player account.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (isParent && selectedChildren.length === 0) {
      Alert.alert(
        'Child Profile Required',
        'In parent module, sessions must include at least one child. Please add or select your child profile to proceed.',
        [
          { text: 'Add Child', onPress: () => router.push('/(parent)/family/add-child') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    const firstChild = selectedChildren[0];
    const attendeeNames = selectedPlayers.map(p => p.name).join(', ');
    const allChildIds = selectedChildren.map(c => c.id).join(',');

    router.push({
      pathname: '/session-summary',
      params: {
        ...searchParams,
        childId: firstChild ? firstChild.id : '',
        childIds: allChildIds,
        studentName: attendeeNames,
        attendeeCount: attendeeCount.toString(),
        sessionFee: subtotal.toString(),
        totalAmount: totalAmount.toString(),
        price: subtotal.toString()
      }
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#EEF3F9' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', zIndex: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
          Select Attendee(s)
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, paddingHorizontal: 16, paddingTop: 20 }} contentContainerStyle={{ paddingBottom: 140 }}>
        <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
          Who is attending this session?
        </Typography>
        <Typography variant="caption" color="muted" className="mb-4 font-outfit">
          Select yourself, your child, or multiple children. The session fee is calculated dynamically per attendee.
        </Typography>

        {isParent && (
          <View style={{ backgroundColor: '#EFF6FF', borderRadius: 16, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#BFDBFE', flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="information-circle" size={20} color="#2563EB" style={{ marginRight: 8 }} />
            <Typography variant="caption" style={{ color: '#1E40AF', flex: 1 }} className="font-outfit text-xs leading-4">
              Family Booking: You can participate together with your child by selecting 'Myself (Parent)' along with your child. In Parent mode, at least one child must be included.
            </Typography>
          </View>
        )}

        {isLoading ? (
          <View style={{ paddingVertical: 40, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#FF5100" />
          </View>
        ) : (
          players.map(player => {
            const isSelected = selectedPlayerIds.includes(player.id);
            return (
              <TouchableOpacity 
                key={player.id}
                onPress={() => togglePlayer(player.id)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? '#FF5100' : 'transparent'
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: player.isChild ? '#D1FAE5' : '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                      <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">
                        {player.name.substring(0, 2).toUpperCase()}
                      </Typography>
                    </View>
                    <View>
                      <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                        {player.name}
                      </Typography>
                      <Typography variant="caption" color="muted" className="font-outfit">
                        {player.role} • ₹{perPersonFee}
                      </Typography>
                    </View>
                  </View>
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderColor: isSelected ? '#FF5100' : '#D1D5DB',
                    backgroundColor: isSelected ? '#FF5100' : 'transparent'
                  }}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity 
          style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d1d5db', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => router.push({
            pathname: '/(parent)/family/add-child',
            params: {
              ...searchParams,
              coachSport: searchParams.coachSport || ''
            }
          })}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={24} color="#FF5100" style={{ marginRight: 8 }} />
          <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold">
            Add Another Child / Attendee
          </Typography>
        </TouchableOpacity>

        {/* Live Calculation Preview Card */}
        {selectedPlayerIds.length > 0 && (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: '#f3f4f6' }}>
            <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold mb-2">
              Fee Breakdown Preview
            </Typography>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Typography variant="body2" color="text" className="font-outfit">
                Coaching Fee ({attendeeCount} attendee{attendeeCount > 1 ? 's' : ''} × ₹{perPersonFee})
              </Typography>
              <Typography variant="body2" color="secondary" weight="semibold" className="font-outfit-semibold">
                ₹{subtotal}
              </Typography>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
              <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                Total Amount
              </Typography>
              <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold">
                ₹{totalAmount}
              </Typography>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={{ position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#ffffff', padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingBottom: Math.max(insets.bottom + 16, 32) }}>
        <Button 
          title={attendeeCount > 0 ? `Continue (₹${totalAmount})` : "Select Attendee"} 
          onPress={handleContinue}
          disabled={selectedPlayerIds.length === 0}
        />
      </View>
    </SafeAreaView>
  );
}
