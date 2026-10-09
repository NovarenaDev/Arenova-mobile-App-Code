import React, { useState, useEffect } from 'react';
import { View, Modal, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';

export interface GroupStudent {
  id: string;
  name: string;
  otp?: string;
  isVerified?: boolean;
}

export interface SessionOtpModalProps {
  visible: boolean;
  onClose: () => void;
  session?: {
    id?: string;
    title?: string;
    sport?: string;
    date?: string;
    time?: string;
    location?: string;
    type?: 'individual' | 'group';
    studentName?: string;
    students?: GroupStudent[];
    expectedOtp?: string;
  } | null;
  onSuccess?: (verificationResult: { mode: 'individual' | 'group'; verifiedCount: number }) => void;
}

export function SessionOtpVerificationModal({ visible, onClose, session, onSuccess }: SessionOtpModalProps) {
  const isGroupSession = session?.type === 'group' || (session?.students && session.students.length > 1);
  const [activeTab, setActiveTab] = useState<'individual' | 'group'>(isGroupSession ? 'group' : 'individual');

  // Individual State
  const [individualOtp, setIndividualOtp] = useState('');
  const [individualError, setIndividualError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Group State
  const [masterOtp, setMasterOtp] = useState('');
  const [groupStudents, setGroupStudents] = useState<GroupStudent[]>([]);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentInputOtp, setStudentInputOtp] = useState('');

  useEffect(() => {
    if (visible) {
      setIsSuccess(false);
      setIsVerifying(false);
      setIndividualOtp('');
      setIndividualError('');
      setMasterOtp('');

      const defaultType = session?.type === 'group' || (session?.students && session.students.length > 1) ? 'group' : 'individual';
      setActiveTab(defaultType);

      if (session?.students && session.students.length > 0) {
        setGroupStudents(session.students.map(s => ({ ...s, isVerified: s.isVerified || false })));
      } else {
        // Mock group students if none provided
        setGroupStudents([
          { id: '1', name: session?.studentName || 'Alex Rivers', otp: '4829', isVerified: false },
          { id: '2', name: 'Jordan Lee', otp: '1934', isVerified: false },
          { id: '3', name: 'Mia Sharma', otp: '7721', isVerified: false },
          { id: '4', name: 'Lucas Chen', otp: '3049', isVerified: false },
        ]);
      }
    }
  }, [visible, session]);

  const handleVerifyIndividual = () => {
    if (!individualOtp || individualOtp.trim().length < 4) {
      setIndividualError('Please enter a valid 4-digit OTP.');
      return;
    }

    setIndividualError('');
    setIsVerifying(true);

    setTimeout(() => {
      setIsVerifying(false);
      setIsSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess({ mode: 'individual', verifiedCount: 1 });
        onClose();
      }, 1200);
    }, 800);
  };

  const handleVerifyMasterGroupOtp = () => {
    if (!masterOtp || masterOtp.trim().length < 4) {
      Alert.alert('Invalid Master OTP', 'Please enter a valid 4-digit Master Group OTP.');
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      const updated = groupStudents.map(s => ({ ...s, isVerified: true }));
      setGroupStudents(updated);
      setIsSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess({ mode: 'group', verifiedCount: updated.length });
        onClose();
      }, 1200);
    }, 800);
  };

  const handleVerifySingleStudentInGroup = (studentId: string) => {
    if (!studentInputOtp || studentInputOtp.trim().length < 4) {
      Alert.alert('Invalid Code', 'Enter 4-digit OTP for this student.');
      return;
    }

    setGroupStudents(prev => prev.map(s => s.id === studentId ? { ...s, isVerified: true } : s));
    setEditingStudentId(null);
    setStudentInputOtp('');
  };

  const verifiedCount = groupStudents.filter(s => s.isVerified).length;
  const totalCount = groupStudents.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end z-50">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
        <View className="bg-white rounded-t-[32px] px-6 pt-4 pb-8 max-h-[90%] shadow-2xl border-t border-gray-100">
          
          {/* Top Handle */}
          <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

          {/* Header */}
          <View className="flex-row justify-between items-center pb-3 border-b border-gray-100 mb-4">
            <View>
              <Typography variant="h3" color="secondary" weight="bold" className="text-xl font-outfit-bold">
                Session OTP Verification
              </Typography>
              <Typography variant="caption" color="muted" className="font-outfit text-xs">
                {session?.sport || 'Coaching Session'} • {session?.date || 'Today'}
              </Typography>
            </View>
            <TouchableOpacity onPress={onClose} className="w-9 h-9 rounded-full bg-gray-100 justify-center items-center">
              <Ionicons name="close" size={20} color="#0F2C59" />
            </TouchableOpacity>
          </View>

          {/* Tab Selection: Individual vs Group */}
          <View className="flex-row bg-gray-100 p-1.5 rounded-2xl mb-5 border border-gray-200">
            <TouchableOpacity 
              onPress={() => setActiveTab('individual')}
              activeOpacity={0.8}
              className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${activeTab === 'individual' ? 'bg-white shadow-xs' : ''}`}
            >
              <Ionicons name="person" size={16} color={activeTab === 'individual' ? '#FF5100' : '#6B7280'} className="mr-1.5" />
              <Typography variant="caption" weight="bold" color={activeTab === 'individual' ? 'primary' : 'muted'} className="font-outfit-bold">
                Individual OTP
              </Typography>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setActiveTab('group')}
              activeOpacity={0.8}
              className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${activeTab === 'group' ? 'bg-white shadow-xs' : ''}`}
            >
              <Ionicons name="people" size={16} color={activeTab === 'group' ? '#FF5100' : '#6B7280'} className="mr-1.5" />
              <Typography variant="caption" weight="bold" color={activeTab === 'group' ? 'primary' : 'muted'} className="font-outfit-bold">
                Group Batch OTP
              </Typography>
            </TouchableOpacity>
          </View>

          {/* Success Overlay View */}
          {isSuccess ? (
            <View className="py-10 items-center justify-center">
              <View className="w-20 h-20 rounded-full bg-emerald-100 items-center justify-center mb-4">
                <Ionicons name="checkmark-circle" size={54} color="#10B981" />
              </View>
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold mb-1">
                OTP Verified!
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="font-outfit px-4">
                Attendance marked successfully. Session has been authorized to start.
              </Typography>
            </View>
          ) : activeTab === 'individual' ? (
            /* INDIVIDUAL OTP VERIFICATION TAB */
            <ScrollView showsVerticalScrollIndicator={false} className="mb-2">
              <View className="bg-orange-50 p-4 rounded-2xl mb-4 border border-orange-200 flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mr-3">
                  <Ionicons name="key-outline" size={22} color="#FF5100" />
                </View>
                <View className="flex-1">
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                    Student: {session?.studentName || 'Individual Player'}
                  </Typography>
                  <Typography variant="caption" color="muted" className="font-outfit text-xs">
                    Ask student/parent for the 4-digit OTP shown on their Arenova app.
                  </Typography>
                </View>
              </View>

              <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold">
                Enter 4-Digit Attendance Code
              </Typography>

              <TextInput
                className="bg-gray-100 rounded-2xl px-4 py-3.5 text-center text-2xl font-bold tracking-[12px] text-[#0F2C59] border border-gray-200 mb-2"
                placeholder="••••"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={4}
                value={individualOtp}
                onChangeText={(text) => {
                  setIndividualOtp(text);
                  if (individualError) setIndividualError('');
                }}
              />

              {individualError ? (
                <Typography variant="caption" className="text-red-500 mb-3 ml-1 font-outfit">
                  {individualError}
                </Typography>
              ) : (
                <View className="mb-4" />
              )}

              <Button
                title={isVerifying ? 'Verifying OTP...' : 'Verify & Start Session'}
                onPress={handleVerifyIndividual}
                isLoading={isVerifying}
                disabled={individualOtp.length < 4 || isVerifying}
                variant="primary"
              />
            </ScrollView>
          ) : (
            /* GROUP OTP VERIFICATION TAB */
            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[420px] mb-2">
              <View className="bg-blue-50 p-4 rounded-2xl mb-4 border border-blue-200">
                <View className="flex-row justify-between items-center mb-2">
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                    Group Attendance Progress
                  </Typography>
                  <View className="bg-blue-600 px-2.5 py-0.5 rounded-full">
                    <Typography variant="caption" color="white" weight="bold" className="text-[10px]">
                      {verifiedCount} / {totalCount} Verified
                    </Typography>
                  </View>
                </View>

                {/* Progress Bar */}
                <View className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
                  <View 
                    className="h-full bg-blue-600 rounded-full" 
                    style={{ width: `${totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0}%` }} 
                  />
                </View>
              </View>

              {/* Option A: Master Group OTP */}
              <View className="bg-white p-4 rounded-2xl mb-4 border border-gray-200 shadow-xs">
                <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold mb-1">
                  Option 1: Master Group OTP Code
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit text-xs mb-3">
                  Enter the 4-digit Master OTP provided by the group organizer to verify all students at once.
                </Typography>

                <View className="flex-row gap-2 items-center">
                  <TextInput
                    className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 text-center text-lg font-bold tracking-[8px] text-[#0F2C59] border border-gray-200"
                    placeholder="••••"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={4}
                    value={masterOtp}
                    onChangeText={setMasterOtp}
                  />
                  <TouchableOpacity 
                    onPress={handleVerifyMasterGroupOtp}
                    disabled={masterOtp.length < 4 || isVerifying}
                    className={`px-4 py-3 rounded-xl justify-center items-center ${masterOtp.length >= 4 ? 'bg-primary' : 'bg-gray-300'}`}
                  >
                    <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold">
                      Verify All
                    </Typography>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Option B: Individual Students List */}
              <Typography variant="caption" color="secondary" weight="bold" className="mb-2 ml-1 font-outfit-bold">
                Option 2: Individual Group Members ({groupStudents.length})
              </Typography>

              {groupStudents.map((student) => (
                <View key={student.id} className="bg-gray-50 p-3.5 rounded-2xl mb-2.5 border border-gray-200 flex-row justify-between items-center">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View className={`w-9 h-9 rounded-full justify-center items-center mr-3 ${student.isVerified ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                      <Ionicons 
                        name={student.isVerified ? 'checkmark' : 'person-outline'} 
                        size={18} 
                        color={student.isVerified ? '#10B981' : '#FF5100'} 
                      />
                    </View>
                    <View className="flex-1">
                      <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold text-sm">
                        {student.name}
                      </Typography>
                      <Typography variant="caption" color="muted" className={`font-outfit text-[11px] ${student.isVerified ? 'text-emerald-600 font-bold' : ''}`}>
                        {student.isVerified ? '✓ Verified' : 'Pending OTP'}
                      </Typography>
                    </View>
                  </View>

                  {student.isVerified ? (
                    <View className="bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                      <Typography variant="caption" className="text-emerald-700 font-bold text-[11px]">
                        Verified
                      </Typography>
                    </View>
                  ) : editingStudentId === student.id ? (
                    <View className="flex-row items-center gap-1">
                      <TextInput
                        className="w-16 bg-white px-2 py-1.5 rounded-lg text-center font-bold text-xs border border-orange-300"
                        placeholder="OTP"
                        keyboardType="number-pad"
                        maxLength={4}
                        value={studentInputOtp}
                        onChangeText={setStudentInputOtp}
                      />
                      <TouchableOpacity 
                        onPress={() => handleVerifySingleStudentInGroup(student.id)}
                        className="p-1.5 bg-primary rounded-lg"
                      >
                        <Ionicons name="checkmark" size={16} color="white" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => setEditingStudentId(null)}
                        className="p-1.5 bg-gray-200 rounded-lg"
                      >
                        <Ionicons name="close" size={16} color="#4B5563" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        setEditingStudentId(student.id);
                        setStudentInputOtp('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 flex-row items-center"
                    >
                      <Ionicons name="key-outline" size={13} color="#FF5100" className="mr-1" />
                      <Typography variant="caption" color="primary" weight="bold" className="text-[11px]">
                        Enter OTP
                      </Typography>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <View className="mt-2 mb-2">
                <Button 
                  title={verifiedCount === totalCount ? 'Complete Session Attendance' : `Submit Verified (${verifiedCount}/${totalCount})`}
                  onPress={() => {
                    if (onSuccess) onSuccess({ mode: 'group', verifiedCount });
                    onClose();
                  }}
                  variant="primary"
                  disabled={verifiedCount === 0}
                />
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
