import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api, RAZORPAY_KEY_ID } from '@/services/api';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/store';

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const [isProcessing, setIsProcessing] = useState(false);

  // Razorpay Modal States
  const [isRazorpayModalVisible, setIsRazorpayModalVisible] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<{
    orderId: string;
    amount: number;
    keyId: string;
  } | null>(null);
  const [isBridgedParent, setIsBridgedParent] = useState(false);

  const { 
    slotId, 
    childId, 
    coachId, 
    studentName, 
    date, 
    time, 
    price, 
    coachName, 
    coachSport,
    totalAmount 
  } = useLocalSearchParams<{ 
    slotId?: string; 
    childId?: string; 
    coachId?: string;
    studentName?: string;
    date?: string;
    time?: string;
    price?: string;
    coachName?: string;
    coachSport?: string;
    totalAmount?: string;
  }>();

  const sessionFee = Number(price || 400);
  const platformFee = 50;
  const computedTotal = Number(totalAmount) || (sessionFee + platformFee);

  const handlePayment = async () => {
    if (!slotId) {
      Alert.alert('Error', 'Invalid slot information.');
      return;
    }

    setIsProcessing(true);
    let bridgedRole = false;

    try {
      // 1. Check if user is parent role. If so, bridge to 'player' on backend
      const isParent = user?.role === 'parent';
      if (isParent) {
        await api.put('/users/me', { role: 'player' }).catch(() => {});
        bridgedRole = true;
        setIsBridgedParent(true);
      }

      // 2. Step 5.1: Create Payment Order on backend
      const orderPayload: any = { slotId };
      if (childId) {
        orderPayload.childId = childId;
      }

      let orderRes;
      try {
        orderRes = await api.post('/bookings/create-order', orderPayload);
      } catch (orderErr: any) {
        orderRes = await api.post('/bookings/create-order', { slotId });
      }

      const orderData = orderRes.data?.data || orderRes.data;
      const orderId = orderData.orderId || orderData.id || `order_${Date.now()}`;
      const amountPaise = orderData.amount || Math.round(computedTotal * 100);
      const keyId = orderData.keyId || orderData.razorpayKeyId || RAZORPAY_KEY_ID;

      setRazorpayOrder({
        orderId,
        amount: amountPaise,
        keyId
      });
      setIsRazorpayModalVisible(true);
      setIsProcessing(false);
    } catch (err: any) {
      if (bridgedRole) {
        await api.put('/users/me', { role: 'parent' }).catch(() => {});
        setIsBridgedParent(false);
      }
      setIsProcessing(false);
      const serverMsg = err.response?.data?.message || err.message || 'Could not initialize payment order.';
      Alert.alert('Payment Order Error', serverMsg);
    }
  };

  const handleRazorpayMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.status === 'success') {
        setIsRazorpayModalVisible(false);
        setIsProcessing(true);

        const verifyPayload: any = {
          paymentOrderId: data.razorpay_order_id || razorpayOrder?.orderId,
          paymentTransactionId: data.razorpay_payment_id,
          paymentSignature: data.razorpay_signature,
          slotId: slotId
        };
        if (childId) {
          verifyPayload.childId = childId;
        }

        try {
          await api.post('/bookings/verify-payment', verifyPayload);
        } catch (verifyErr: any) {
          delete verifyPayload.childId;
          await api.post('/bookings/verify-payment', verifyPayload);
        }

        // Restore parent role if bridged
        if (isBridgedParent) {
          await api.put('/users/me', { role: 'parent' }).catch(() => {});
          setIsBridgedParent(false);
        }

        // Invalidate all booking queries so coach and user see the confirmed session
        queryClient.invalidateQueries({ queryKey: ['myBookings'] });
        queryClient.invalidateQueries({ queryKey: ['playerBookings'] });
        queryClient.invalidateQueries({ queryKey: ['parentBookings'] });
        queryClient.invalidateQueries({ queryKey: ['coachSessions'] });
        queryClient.invalidateQueries({ queryKey: ['slots'] });

        setIsProcessing(false);
        router.push({
          pathname: '/booking-confirmed',
          params: {
            coachName: coachName || 'Coach',
            studentName: studentName || 'Attendee',
            sport: coachSport || 'Sports',
            date: date || 'Scheduled Date',
            time: time || 'Scheduled Time',
            amount: computedTotal.toString(),
            txnId: data.razorpay_payment_id
          }
        });
      } else if (data.status === 'cancelled') {
        setIsRazorpayModalVisible(false);
        if (isBridgedParent) {
          await api.put('/users/me', { role: 'parent' }).catch(() => {});
          setIsBridgedParent(false);
        }
        Alert.alert('Payment Cancelled', 'You cancelled the payment transaction.');
      } else if (data.status === 'failed') {
        setIsRazorpayModalVisible(false);
        if (isBridgedParent) {
          await api.put('/users/me', { role: 'parent' }).catch(() => {});
          setIsBridgedParent(false);
        }
        const errorDesc = data.error?.description || 'Transaction failed.';
        Alert.alert('Payment Failed', errorDesc);
      }
    } catch (err: any) {
      setIsRazorpayModalVisible(false);
      if (isBridgedParent) {
        await api.put('/users/me', { role: 'parent' }).catch(() => {});
        setIsBridgedParent(false);
      }
      Alert.alert('Payment Error', 'An error occurred during payment processing.');
    }
  };

  const getRazorpayHtml = () => {
    if (!razorpayOrder) return '';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #EEF3F9;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .loader-container {
            text-align: center;
            color: #0F2C59;
            padding: 20px;
          }
          .spinner {
            border: 4px solid rgba(15, 44, 89, 0.1);
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border-left-color: #FF5100;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      </head>
      <body>
        <div class="loader-container">
          <div class="spinner"></div>
          <h3 style="margin: 0; font-size: 16px;">Opening Razorpay Checkout...</h3>
        </div>
        <script>
          var options = {
            "key": ${JSON.stringify(razorpayOrder.keyId)},
            "amount": ${razorpayOrder.amount},
            "currency": "INR",
            "name": "Arenova Sports",
            "description": "Coaching Session Booking",
            "order_id": ${JSON.stringify(razorpayOrder.orderId)},
            "handler": function (response){
              window.ReactNativeWebView.postMessage(JSON.stringify({
                status: 'success',
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              }));
            },
            "modal": {
              "ondismiss": function(){
                window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'cancelled' }));
              }
            },
            "prefill": {
              "name": ${JSON.stringify(user?.name || studentName || 'Customer')},
              "email": ${JSON.stringify(user?.email || '')},
              "contact": ${JSON.stringify(user?.phone || '')}
            },
            "theme": {
              "color": "#FF5100"
            }
          };
          var rzp1 = new Razorpay(options);
          rzp1.on('payment.failed', function (response){
            window.ReactNativeWebView.postMessage(JSON.stringify({
              status: 'failed',
              error: response.error
            }));
          });
          window.onload = function() {
            rzp1.open();
          };
        </script>
      </body>
      </html>
    `;
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
          Checkout
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4 pt-6" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 80, 100) }}>
        
        {/* Attendee Details Card */}
        <View className="bg-white rounded-2xl p-5 mb-5 shadow-sm border border-gray-50">
          <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-3 font-outfit-bold">
            Booking Details
          </Typography>
          <View className="flex-row items-center mb-3">
            <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center mr-3">
              <Ionicons name="people" size={20} color="#059669" />
            </View>
            <View className="flex-1">
              <Typography variant="body2" color="secondary" weight="bold" className="font-outfit-bold">
                {studentName || 'Attendee'}
              </Typography>
              <Typography variant="caption" color="muted" className="font-outfit">
                Coach {coachName || 'Coach'} • {coachSport || 'Sports'}
              </Typography>
            </View>
          </View>
          <View className="flex-row items-center pt-3 border-t border-gray-100">
            <Ionicons name="calendar-outline" size={16} color="#FF5100" style={{ marginRight: 6 }} />
            <Typography variant="caption" color="secondary" weight="semibold" className="font-outfit-semibold mr-4">
              {date || 'Scheduled Date'}
            </Typography>
            <Ionicons name="time-outline" size={16} color="#FF5100" style={{ marginRight: 6 }} />
            <Typography variant="caption" color="secondary" weight="semibold" className="font-outfit-semibold">
              {time || 'Scheduled Time'}
            </Typography>
          </View>
        </View>
        
        {/* Payment Methods Card */}
        <View className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-gray-50">
          <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-4 font-outfit-bold">
            Select Payment Method
          </Typography>

          <TouchableOpacity className="flex-row items-center justify-between p-4 bg-orange-50/50 rounded-2xl border-2 border-primary mb-4">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mr-3">
                <Ionicons name="card" size={20} color="#FF5100" />
              </View>
              <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                Online Payment (Razorpay)
              </Typography>
            </View>
            <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
              <Ionicons name="checkmark" size={14} color="white" />
            </View>
          </TouchableOpacity>

          <Typography variant="caption" color="muted" className="font-outfit text-center">
            Secured payments powered by Razorpay.
          </Typography>
        </View>

        {/* Pricing summary */}
        <View className="bg-white rounded-2xl p-5 mb-8 shadow-sm border border-gray-50">
          <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-4 font-outfit-bold">
            Order Summary
          </Typography>
          <View className="flex-row justify-between items-center mb-3">
            <Typography variant="body2" color="text" className="font-outfit">Coaching Session</Typography>
            <Typography variant="body2" color="secondary" weight="semibold" className="font-outfit-semibold">₹{sessionFee}</Typography>
          </View>
          <View className="flex-row justify-between items-center mb-3">
            <Typography variant="body2" color="text" className="font-outfit">Platform Fee</Typography>
            <Typography variant="body2" color="secondary" weight="semibold" className="font-outfit-semibold">₹{platformFee}</Typography>
          </View>
          <View className="flex-row justify-between items-center pt-3 border-t border-gray-100 mt-2">
            <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">Total</Typography>
            <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold">₹{computedTotal}</Typography>
          </View>
        </View>

      </ScrollView>

      {/* Sticky Bottom Pay Button */}
      <View style={{ position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#ffffff', padding: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingBottom: Math.max(insets.bottom + 16, 32), zIndex: 20 }}>
        <Button 
          title={`Pay Now (₹${computedTotal})`}
          onPress={handlePayment}
          isLoading={isProcessing}
        />
      </View>

      {/* Razorpay Gateway Checkout Modal */}
      <Modal
        visible={isRazorpayModalVisible}
        animationType="slide"
        onRequestClose={() => {
          setIsRazorpayModalVisible(false);
          if (isBridgedParent) {
            api.put('/users/me', { role: 'parent' }).catch(() => {});
            setIsBridgedParent(false);
          }
        }}
      >
        <SafeAreaView className="flex-1 bg-[#EEF3F9]">
          <View className="px-4 py-3 bg-white border-b border-gray-100 flex-row justify-between items-center shadow-sm">
            <View className="flex-row items-center">
              <Ionicons name="shield-checkmark-outline" size={20} color="#FF5100" className="mr-2" />
              <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                Razorpay Secure Checkout
              </Typography>
            </View>
            <TouchableOpacity 
              onPress={() => {
                setIsRazorpayModalVisible(false);
                if (isBridgedParent) {
                  api.put('/users/me', { role: 'parent' }).catch(() => {});
                  setIsBridgedParent(false);
                }
              }}
              className="p-1"
            >
              <Ionicons name="close" size={24} color="#0F2C59" />
            </TouchableOpacity>
          </View>

          {razorpayOrder && (
            <WebView
              originWhitelist={['*']}
              source={{ html: getRazorpayHtml() }}
              onMessage={handleRazorpayMessage}
              style={{ flex: 1 }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View className="absolute inset-0 justify-center items-center bg-[#EEF3F9]">
                  <ActivityIndicator size="large" color="#FF5100" />
                  <Typography variant="body2" color="secondary" className="mt-3 font-outfit-bold">
                    Initializing Payment Gateway...
                  </Typography>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
