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

  const players: { id: string; name: string; role: string; color: string; isChild: boolean }[] = [
    { id: 'self', name: user?.name || 'Myself (Account Owner)', role: 'Account Owner', color: 'bg-blue-100', isChild: false }
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
    return ['self'];
  });

  // Keep selection updated when children load
  React.useEffect(() => {
    if (children.length > 0 && (selectedPlayerIds.length === 0 || (selectedPlayerIds.length === 1 && selectedPlayerIds[0] === 'self'))) {
      setSelectedPlayerIds([children[0]._id || children[0].id]);
    }
  }, [children.length]);

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds(prev => {
      if (prev.includes(id)) {
        // Keep at least one attendee if possible
        const next = prev.filter(p => p !== id);
        return next;
      } else {
        return [...prev, id];
      }
    });
  };

  // Pricing calculations
  const perPersonFee = Number(searchParams.price || 400);
  const attendeeCount = selectedPlayerIds.length;
  const subtotal = attendeeCount * perPersonFee;
  const platformFee = 50;
  const totalAmount = subtotal > 0 ? subtotal + platformFee : 0;

  const handleContinue = () => {
    if (selectedPlayerIds.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one attendee (Myself or Child).');
      return;
    }

    const selectedPlayers = players.filter(p => selectedPlayerIds.includes(p.id));
    const firstChild = selectedPlayers.find(p => p.isChild);
    const attendeeNames = selectedPlayers.map(p => p.name).join(', ');

    router.push({
      pathname: '/session-summary',
      params: {
        ...searchParams,
        childId: firstChild ? firstChild.id : '',
        studentName: attendeeNames,
        attendeeCount: attendeeCount.toString(),
        sessionFee: subtotal.toString(),
        platformFee: platformFee.toString(),
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Typography variant="body2" color="text" className="font-outfit">
                Platform Fee
              </Typography>
              <Typography variant="body2" color="secondary" weight="semibold" className="font-outfit-semibold">
                ₹{platformFee}
              </Typography>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
              <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                Total
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
