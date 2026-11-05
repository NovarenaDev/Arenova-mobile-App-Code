import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Switch, Share, Platform, Modal, Alert, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store';
import { api } from '@/services/api';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setUser, soundEnabled, vibrationEnabled, setSoundEnabled, setVibrationEnabled } = useAuthStore();
  const [modalDocType, setModalDocType] = useState<'support' | 'privacy' | 'terms' | null>(null);

  // Password Management State
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'direct' | 'otp'>('direct');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const userHasPassword = Boolean(user?.hasPassword || user?.password);

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Join Arenova! Book professional coaching sessions, training slots, and track activity instantly.',
        url: 'https://arenova.com',
      });
    } catch (e) {
      console.error('Error sharing app:', e);
    }
  };

  const handleSendPasswordOtp = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsSendingOtp(true);

    try {
      const cleanEmail = user?.email ? user.email.trim().toLowerCase() : '';
      let sent = false;

      // Try email-based password reset OTP first if user has email
      if (cleanEmail && cleanEmail.includes('@')) {
        try {
          const res = await api.post('/auth/forgot-password', {
            email: cleanEmail
          });
          sent = true;
          setIsSendingOtp(false);
          setOtpSent(true);
          setPasswordSuccess(res.data?.message || `6-digit verification code sent to ${cleanEmail}.`);
          return;
        } catch (emailErr: any) {
          // If 404 or fails, fallback to phone OTP
        }
      }

      const cleanPhone = user?.phone ? user.phone.replace(/[^0-9]/g, '').slice(-10) : '';
      const endpoint = user?.role === 'coach' ? '/auth/coach/send-otp' : '/auth/send-otp';

      const res = await api.post(endpoint, {
        phone: cleanPhone || user?.email,
        purpose: 'reset'
      });

      setIsSendingOtp(false);
      setOtpSent(true);
      setPasswordSuccess(res.data?.message || `6-digit verification code sent to ${cleanPhone ? `+91 ${cleanPhone}` : user?.email || 'your device'}.`);
    } catch (err: any) {
      setIsSendingOtp(false);
      const msg = err?.response?.data?.message || err?.message || 'Failed to send verification code. Please try again.';
      setPasswordError(msg);
    }
  };

  const handleSavePassword = async () => {
    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanNew) {
      setPasswordError('Please enter a new password.');
      return;
    }
    if (cleanNew.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    if (passwordMode === 'otp') {
      const cleanOtp = otpCode.trim();
      if (!cleanOtp || cleanOtp.length < 4) {
        setPasswordError('Please enter the 6-digit verification code received.');
        return;
      }
    }

    setPasswordError(null);
    setPasswordSuccess(null);
    setIsSavingPassword(true);

    try {
      if (passwordMode === 'otp') {
        const cleanEmail = user?.email ? user.email.trim().toLowerCase() : '';
        const cleanPhone = user?.phone ? user.phone.replace(/[^0-9]/g, '').slice(-10) : '';
        
        await api.post('/auth/reset-password', {
          email: cleanEmail || undefined,
          phone: cleanPhone || undefined,
          otp: otpCode.trim(),
          newPassword: cleanNew
        });
      } else {
        // Direct authenticated update with graceful fallbacks
        let updated = false;
        const endpoint = user?.role === 'coach' ? '/auth/coach/change-password' : '/auth/change-password';

        try {
          await api.post(endpoint, {
            currentPassword: currentPassword.trim() || undefined,
            oldPassword: currentPassword.trim() || undefined,
            newPassword: cleanNew,
            password: cleanNew
          });
          updated = true;
        } catch (e1: any) {
          const status = e1?.response?.status;
          if (status === 404 || status === 405 || status === 400) {
            try {
              await api.post('/auth/set-password', {
                password: cleanNew,
                newPassword: cleanNew
              });
              updated = true;
            } catch (e2: any) {
              const status2 = e2?.response?.status;
              if (status2 === 404 || status2 === 405 || status2 === 400) {
                const profileEndpoint = user?.role === 'coach' ? '/coaches/my/profile' : '/users/me';
                await api.put(profileEndpoint, { password: cleanNew });
                updated = true;
              } else {
                throw e2;
              }
            }
          } else {
            throw e1;
          }
        }
      }

      if (user) {
        setUser({
          ...user,
          hasPassword: true,
          password: cleanNew,
        });
      }

      setIsSavingPassword(false);
      const successMessage = userHasPassword
        ? 'Password updated successfully! You can now log in with your new password anytime.'
        : 'Password created successfully! You can now log in directly using your email/phone and password without waiting for an OTP.';
      
      setPasswordSuccess(successMessage);
      Alert.alert('Success', successMessage);

      setTimeout(() => {
        setIsPasswordModalVisible(false);
        setPasswordSuccess(null);
        setPasswordError(null);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setOtpCode('');
        setOtpSent(false);
      }, 1200);

    } catch (err: any) {
      setIsSavingPassword(false);
      const msg = err?.response?.data?.message || err?.message || 'Failed to update password. Please verify and try again.';
      setPasswordError(msg);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-4">
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
          Settings
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-4" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 40, 60) }}>
        
        {/* Security & Password */}
        <Typography variant="subtitle2" color="muted" weight="bold" className="mb-2 ml-1 uppercase font-outfit-bold">
          Security & Password
        </Typography>
        <View className="bg-white rounded-2xl mb-6 shadow-sm overflow-hidden border border-gray-100">
          <TouchableOpacity 
            onPress={() => {
              setIsPasswordModalVisible(true);
              setPasswordError(null);
              setPasswordSuccess(null);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setOtpCode('');
              setOtpSent(false);
              setPasswordMode('direct');
            }} 
            className="flex-row items-center justify-between p-4"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center flex-1 mr-3">
              <View className="w-9 h-9 rounded-full bg-orange-50 items-center justify-center mr-3 border border-orange-100">
                <Ionicons name="key" size={18} color="#FF5100" />
              </View>
              <View className="flex-1">
                <Typography variant="body1" color="secondary" weight="medium" className="font-outfit-medium">
                  {userHasPassword ? 'Change Password' : 'Create Password'}
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit text-xs mt-0.5">
                  {userHasPassword 
                    ? 'Update your login password for fast direct access' 
                    : 'Set a password to log in without waiting for OTP'}
                </Typography>
              </View>
            </View>
            <View className="flex-row items-center">
              <View className={`px-2.5 py-1 rounded-full mr-2 ${userHasPassword ? 'bg-emerald-50 border border-emerald-200' : 'bg-orange-50 border border-orange-200'}`}>
                <Typography variant="caption" weight="bold" className={`text-[10px] font-outfit-bold ${userHasPassword ? 'text-emerald-700' : 'text-orange-700'}`}>
                  {userHasPassword ? 'Active' : 'Create Now'}
                </Typography>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <Typography variant="subtitle2" color="muted" weight="bold" className="mb-2 ml-1 uppercase font-outfit-bold">
          Preferences
        </Typography>
        <View className="bg-white rounded-2xl mb-6 shadow-sm overflow-hidden border border-gray-100">
          
          <View className="flex-row items-center justify-between p-4 border-b border-gray-50">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mr-3">
                <Ionicons name="volume-medium" size={18} color="#3B82F6" />
              </View>
              <Typography variant="body1" color="secondary" weight="medium" className="font-outfit-medium">Sound</Typography>
            </View>
            <Switch 
              value={soundEnabled} 
              onValueChange={setSoundEnabled} 
              trackColor={{ false: '#D1D5DB', true: '#FF5100' }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>

          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-orange-50 items-center justify-center mr-3">
                <Ionicons name="phone-portrait" size={18} color="#F97316" />
              </View>
              <Typography variant="body1" color="secondary" weight="medium" className="font-outfit-medium">Vibration</Typography>
            </View>
            <Switch 
              value={vibrationEnabled} 
              onValueChange={setVibrationEnabled} 
              trackColor={{ false: '#D1D5DB', true: '#FF5100' }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>
        </View>

        {/* Account Settings */}
        <Typography variant="subtitle2" color="muted" weight="bold" className="mb-2 ml-1 uppercase font-outfit-bold">
          Account
        </Typography>
        <View className="bg-white rounded-2xl mb-6 shadow-sm overflow-hidden border border-gray-100">
          <TouchableOpacity 
            onPress={handleShareApp} 
            className="flex-row items-center justify-between p-4 border-b border-gray-50"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-green-50 items-center justify-center mr-3">
                <Ionicons name="share-social" size={18} color="#10B981" />
              </View>
              <Typography variant="body1" color="secondary" weight="medium" className="font-outfit-medium">Share App</Typography>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setModalDocType('support')} 
            className="flex-row items-center justify-between p-4"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-indigo-50 items-center justify-center mr-3">
                <Ionicons name="help-circle" size={18} color="#6366F1" />
              </View>
              <Typography variant="body1" color="secondary" weight="medium" className="font-outfit-medium">Help & Support</Typography>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Legal */}
        <Typography variant="subtitle2" color="muted" weight="bold" className="mb-2 ml-1 uppercase font-outfit-bold">
          Legal
        </Typography>
        <View className="bg-white rounded-2xl mb-6 shadow-sm overflow-hidden border border-gray-100">
          <TouchableOpacity 
            onPress={() => setModalDocType('privacy')}
            className="flex-row items-center justify-between p-4 border-b border-gray-50"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center mr-3">
                <Ionicons name="shield-checkmark" size={18} color="#4B5563" />
              </View>
              <Typography variant="body1" color="secondary" weight="medium" className="font-outfit-medium">Privacy Policy</Typography>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setModalDocType('terms')}
            className="flex-row items-center justify-between p-4"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center mr-3">
                <Ionicons name="document-text" size={18} color="#4B5563" />
              </View>
              <Typography variant="body1" color="secondary" weight="medium" className="font-outfit-medium">Terms & Conditions</Typography>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Dynamic Password Management Modal */}
      <Modal
        visible={isPasswordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="bg-white rounded-t-3xl p-6 shadow-xl max-h-[92%]">
              {/* Modal Header */}
              <View className="flex-row justify-between items-center mb-4 border-b border-gray-100 pb-3">
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-full bg-orange-50 items-center justify-center mr-3 border border-orange-100">
                    <Ionicons name="lock-closed" size={18} color="#FF5100" />
                  </View>
                  <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold text-lg">
                    {userHasPassword ? 'Change Password' : 'Create Password'}
                  </Typography>
                </View>
                <TouchableOpacity onPress={() => setIsPasswordModalVisible(false)} className="p-1">
                  <Ionicons name="close" size={24} color="#0F2C59" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Information Card */}
                <View className="bg-orange-50/70 border border-orange-100 rounded-2xl p-3.5 mb-4">
                  <Typography variant="caption" className="font-outfit text-orange-950 leading-5">
                    {userHasPassword
                      ? 'Update your password below. You can log in instantly with your email/phone and password on any device.'
                      : 'Create a secure password to log in directly using your registered email or mobile number without waiting for an SMS OTP each time.'}
                  </Typography>
                </View>

                {/* Error Banner */}
                {passwordError && (
                  <View className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-3.5 flex-row items-start">
                    <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 8, marginTop: 1 }} />
                    <Typography variant="caption" className="font-outfit text-red-700 flex-1 leading-4">
                      {passwordError}
                    </Typography>
                  </View>
                )}

                {/* Success Banner */}
                {passwordSuccess && (
                  <View className="mb-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex-row items-start">
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 8, marginTop: 1 }} />
                    <Typography variant="caption" className="font-outfit text-emerald-700 flex-1 leading-4">
                      {passwordSuccess}
                    </Typography>
                  </View>
                )}

                {/* Mode Selector Tabs */}
                <View className="flex-row bg-gray-100 rounded-xl p-1 mb-4">
                  <TouchableOpacity
                    onPress={() => {
                      setPasswordMode('direct');
                      setPasswordError(null);
                    }}
                    className={`flex-1 py-2 rounded-lg items-center ${passwordMode === 'direct' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <Typography
                      variant="caption"
                      weight="bold"
                      color={passwordMode === 'direct' ? 'secondary' : 'muted'}
                      className="font-outfit-bold text-xs"
                    >
                      Direct Setup
                    </Typography>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setPasswordMode('otp');
                      setPasswordError(null);
                      if (!otpSent) {
                        handleSendPasswordOtp();
                      }
                    }}
                    className={`flex-1 py-2 rounded-lg items-center ${passwordMode === 'otp' ? 'bg-white shadow-sm' : ''}`}
                  >
                    <Typography
                      variant="caption"
                      weight="bold"
                      color={passwordMode === 'otp' ? 'secondary' : 'muted'}
                      className="font-outfit-bold text-xs"
                    >
                      Verify via OTP
                    </Typography>
                  </TouchableOpacity>
                </View>

                {/* Direct Setup Form */}
                {passwordMode === 'direct' ? (
                  <View>
                    {userHasPassword && (
                      <TextInput
                        label="Current Password (Optional)"
                        placeholder="Enter current password if known"
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        isPassword
                        className="mb-3"
                      />
                    )}

                    <TextInput
                      label="New Password"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      isPassword
                      className="mb-3"
                    />

                    <TextInput
                      label="Confirm New Password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      isPassword
                      className="mb-4"
                    />
                  </View>
                ) : (
                  /* OTP Verification Form */
                  <View>
                    <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4">
                      <View className="flex-row justify-between items-center mb-2">
                        <Typography variant="subtitle2" weight="bold" color="secondary" className="font-outfit-bold text-xs">
                          Registered Target
                        </Typography>
                        <TouchableOpacity
                          onPress={handleSendPasswordOtp}
                          disabled={isSendingOtp}
                          className="p-1"
                        >
                          <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs">
                            {isSendingOtp ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                          </Typography>
                        </TouchableOpacity>
                      </View>
                      <Typography variant="caption" color="muted" className="font-outfit text-xs">
                        {user?.phone ? `+91 ${user.phone}` : user?.email || 'Registered account'}
                      </Typography>
                    </View>

                    <TextInput
                      label="6-Digit Verification Code"
                      placeholder="• • • • • •"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      className="mb-3"
                    />

                    <TextInput
                      label="New Password"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      isPassword
                      className="mb-3"
                    />

                    <TextInput
                      label="Confirm New Password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      isPassword
                      className="mb-4"
                    />
                  </View>
                )}

                {/* Action Buttons */}
                <View className="mt-2 mb-4 space-y-2.5">
                  <Button
                    title={userHasPassword ? 'Update Password' : 'Save & Set Password'}
                    isLoading={isSavingPassword}
                    onPress={handleSavePassword}
                    className="w-full"
                  />
                  <TouchableOpacity
                    onPress={() => setIsPasswordModalVisible(false)}
                    className="py-2.5 items-center mt-2"
                  >
                    <Typography variant="caption" color="muted" weight="bold" className="font-outfit-bold text-xs">
                      Cancel
                    </Typography>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Local Document Viewer Modal */}
      <Modal
        visible={modalDocType !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalDocType(null)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl p-6 shadow-xl max-h-[80%]">
            <View className="flex-row justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold">
                {modalDocType === 'support' && "Help & Support"}
                {modalDocType === 'privacy' && "Privacy Policy"}
                {modalDocType === 'terms' && "Terms & Conditions"}
              </Typography>
              <TouchableOpacity onPress={() => setModalDocType(null)} className="p-1">
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
              <Typography variant="body1" color="text" className="font-outfit leading-6 text-gray-700">
                {modalDocType === 'support' && "Welcome to Arenova Support.\n\nIf you have any inquiries regarding scheduling, bookings, or wallet withdrawals, please reach out to our administration at contact@arenova.com.\n\nOur team is dedicated to ensuring a seamless experience for coaches, parents, and players alike. We typically respond to email inquiries within 24 business hours."}
                {modalDocType === 'privacy' && "At Arenova, we prioritize the protection and confidentiality of your personal information.\n\nOur platform processes registration profiles, geolocation services, and transaction logs solely to coordinate sports coaching activities, book slots, and ensure secure payouts.\n\nYour data is encrypted in transit and at rest, and is never sold or shared with unauthorized third-party platforms. You may request data deletion at any time by contacting our support team."}
                {modalDocType === 'terms' && "By using the Arenova application, you agree to our guidelines regarding booking schedules, payment verification, and professional conduct.\n\nCoaches are required to submit accurate certifications, maintain availability, and honor confirmed bookings. Players and parents agree to show up for confirmed time slots.\n\nCancellations and refunds are governed by our standard booking policies and administrative oversight."}
              </Typography>
            </ScrollView>

            <Button 
              title="Close" 
              onPress={() => setModalDocType(null)} 
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
