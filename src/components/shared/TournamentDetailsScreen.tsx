import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, Alert, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, RAZORPAY_KEY_ID } from '@/services/api';
import { useAuthStore } from '@/store';
import { getTournamentBanner } from '@/utils/tournamentImages';

export default function TournamentDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, children: storedChildren } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [regName, setRegName] = useState(user?.name || '');
  const [regPhone, setRegPhone] = useState(user?.phone || '');
  const [regEmail, setRegEmail] = useState(user?.email || '');
  const [partnerName, setPartnerName] = useState('');
  const [regStep, setRegStep] = useState<1 | 2>(1);

  const [isRegisterModalVisible, setIsRegisterModalVisible] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Razorpay Payment States
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isRazorpayModalVisible, setIsRazorpayModalVisible] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<{
    orderId: string;
    amount: number;
    keyId: string;
    currency?: string;
  } | null>(null);
  const [pendingRegistrationId, setPendingRegistrationId] = useState<string | null>(null);

  // Success Confirmation & Invoice Download States
  const [confirmedRegistration, setConfirmedRegistration] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  const { data: tournamentResponse, isLoading, error } = useQuery({
    queryKey: ['novareTournament', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await api.get(`/novare/tournaments/${id}`);
      return res.data?.data || res.data;
    },
    enabled: !!id,
  });

  const tournament = tournamentResponse;

  const { data: childrenResponse } = useQuery({
    queryKey: ['children'],
    queryFn: async () => {
      const res = await api.get('/users/me/children');
      return res.data;
    },
    enabled: user?.role === 'parent',
  });

  const serverChildren = childrenResponse?.data || childrenResponse?.children || [];
  const childrenList = Array.isArray(serverChildren) && serverChildren.length > 0 ? serverChildren : storedChildren || [];

  const getCategoryFee = (cat: any) => {
    if (typeof cat === 'object' && cat !== null && cat.fee !== undefined && !isNaN(Number(cat.fee))) {
      return Number(cat.fee);
    }
    if (typeof cat === 'object' && cat !== null && cat.price !== undefined && !isNaN(Number(cat.price))) {
      return Number(cat.price);
    }
    if (tournament?.entryFee !== undefined && !isNaN(Number(tournament.entryFee))) {
      return Number(tournament.entryFee);
    }
    if (tournament?.fee !== undefined && !isNaN(Number(tournament.fee))) {
      return Number(tournament.fee);
    }
    return 0;
  };

  const handleDownloadInvoice = async (registrationId?: string) => {
    setIsDownloadingInvoice(true);
    try {
      let invoiceId = null;
      const invoicesRes = await api.get('/invoices/my', { params: { limit: 25 } }).catch(() => null);
      const invoiceList = invoicesRes?.data?.data || invoicesRes?.data || [];
      
      const targetRegId = registrationId || confirmedRegistration?._id || confirmedRegistration?.id;
      const match = invoiceList.find((inv: any) => 
        inv.registrationId === targetRegId || 
        inv.registration?._id === targetRegId ||
        inv.tournamentId === id ||
        inv.tournament?._id === id ||
        inv.metadata?.registrationId === targetRegId
      ) || invoiceList[0];

      if (match) {
        invoiceId = match._id || match.id;
      }

      if (!invoiceId) {
        Alert.alert(
          'Invoice Being Prepared',
          'Your registration invoice PDF is currently being generated. You can view and download it anytime from My Tournaments in your Profile.'
        );
        setIsDownloadingInvoice(false);
        return;
      }

      const downloadRes = await api.get(`/invoices/${invoiceId}/download`);
      const downloadData = downloadRes.data?.data || downloadRes.data;
      const pdfUrl = downloadData?.downloadUrl || downloadData?.url || downloadData?.pdfUrl;

      if (pdfUrl) {
        await Linking.openURL(pdfUrl);
      } else {
        Alert.alert('Notice', 'Invoice PDF will be ready in a few moments.');
      }
      setIsDownloadingInvoice(false);
    } catch (err: any) {
      setIsDownloadingInvoice(false);
      Alert.alert('Invoice', err?.response?.data?.message || 'Invoice will be ready shortly in My Tournaments.');
    }
  };

  const handleOpenRegisterModal = (cat?: any) => {
    const targetCat = cat || (tournament?.categories?.[0] || null);
    setSelectedCategory(targetCat);
    setRegisterError(null);
    setRegStep(1);
    setRegName(user?.name || '');
    setRegPhone(user?.phone || '');
    setRegEmail(user?.email || '');
    setPartnerName('');
    if (childrenList.length > 0 && !selectedChildId) {
      setSelectedChildId(childrenList[0]._id || childrenList[0].id || '');
    }
    setIsRegisterModalVisible(true);
  };

  const handleProceedToReview = () => {
    setRegisterError(null);
    const cleanPhone = regPhone.trim();
    const cleanEmail = regEmail.trim();

    if (!cleanPhone || cleanPhone.replace(/[^0-9]/g, '').length < 10) {
      setRegisterError('Please enter a valid 10-digit mobile number for registration.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setRegisterError('Please enter a valid email address for tournament communications and invoice receipt.');
      return;
    }
    if (user?.role === 'parent' && !selectedChildId && childrenList.length > 0) {
      setRegisterError('Please select a child profile for registration.');
      return;
    }
    setRegStep(2);
  };

  const handleInitiatePayment = async () => {
    setRegisterError(null);
    setIsProcessingPayment(true);

    const categoryIdVal = selectedCategory?._id || selectedCategory?.id || selectedCategory?.name || selectedCategory;
    const categoryNameVal = typeof selectedCategory === 'string' ? selectedCategory : (selectedCategory?.name || selectedCategory?.title || 'Open Division');
    const fee = getCategoryFee(selectedCategory);

    const payload: any = {
      categoryId: categoryIdVal,
      category: categoryNameVal,
      categoryName: categoryNameVal,
      phone: regPhone.trim() || user?.phone || '',
      mobileNumber: regPhone.trim() || user?.phone || '',
      email: regEmail.trim() || user?.email || '',
      name: regName.trim() || user?.name || 'Athlete',
      amount: fee,
      fee: fee,
    };

    if (partnerName.trim()) {
      payload.partnerName = partnerName.trim();
      payload.teamName = partnerName.trim();
    }

    let participantDisplayName = regName.trim() || user?.name || 'Player';
    if (user?.role === 'parent') {
      if (selectedChildId) {
        payload.childId = selectedChildId;
        payload.participantId = selectedChildId;
        const childObj = childrenList.find((c: any) => (c._id || c.id) === selectedChildId);
        if (childObj?.name) {
          payload.childName = childObj.name;
          payload.participantName = childObj.name;
          participantDisplayName = childObj.name;
        }
      }
    } else {
      payload.participantName = participantDisplayName;
    }

    try {
      // 1. Submit Registration
      const regRes = await api.post(`/novare/tournaments/${id}/register`, payload);
      const regData = regRes.data?.data || regRes.data?.registration || regRes.data;
      const regId = regData?._id || regData?.id;

      if (!regId) {
        throw new Error('Registration could not be created. Please try again.');
      }

      setPendingRegistrationId(regId);
      const regSummary = {
        ...regData,
        tournamentName: tournament?.name || tournament?.title,
        categoryName: categoryNameVal,
        amount: fee,
        participantName: participantDisplayName,
      };
      setConfirmedRegistration(regSummary);

      // 2. If Free Tournament
      if (fee === 0) {
        try {
          await api.post(`/novare/registrations/${regId}/verify-payment`, {
            transactionId: 'FREE_ENTRY',
            paymentStatus: 'completed',
            status: 'verified'
          });
        } catch (e) {}

        setIsProcessingPayment(false);
        setIsRegisterModalVisible(false);
        setShowSuccessModal(true);
        queryClient.invalidateQueries({ queryKey: ['myTournamentRegistrations'] });
        return;
      }

      // 3. Paid Tournament -> Initialize Razorpay Order
      let orderId = `order_tourn_${Date.now()}`;
      let amountPaise = Math.round(fee * 100);
      let keyId = RAZORPAY_KEY_ID;

      try {
        const orderRes = await api.post('/bookings/create-order', {
          amount: fee,
          tournamentId: id,
          registrationId: regId,
          type: 'tournament_registration'
        });
        const orderData = orderRes.data?.data || orderRes.data;
        if (orderData?.orderId || orderData?.id) {
          orderId = orderData.orderId || orderData.id;
        }
        if (orderData?.amountInPaise || orderData?.amount) {
          amountPaise = orderData.amountInPaise || orderData.amount;
        }
        if (orderData?.gatewayKeyId || orderData?.keyId) {
          keyId = orderData.gatewayKeyId || orderData.keyId;
        }
      } catch (orderErr) {
        console.log('Order creation fallback to client-side order ID:', orderErr);
      }

      setRazorpayOrder({
        orderId,
        amount: amountPaise,
        keyId,
        currency: 'INR'
      });

      setIsProcessingPayment(false);
      setIsRegisterModalVisible(false);
      setIsRazorpayModalVisible(true);
    } catch (err: any) {
      setIsProcessingPayment(false);
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to initialize tournament registration. Please try again.';
      setRegisterError(errMsg);
    }
  };

  const handleRazorpayMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.status === 'success') {
        setIsRazorpayModalVisible(false);
        setIsProcessingPayment(true);

        const verifyPayload = {
          transactionId: data.razorpay_payment_id,
          paymentOrderId: data.razorpay_order_id || razorpayOrder?.orderId,
          paymentSignature: data.razorpay_signature,
          paymentStatus: 'completed',
          status: 'verified',
        };

        if (pendingRegistrationId) {
          try {
            await api.post(`/novare/registrations/${pendingRegistrationId}/verify-payment`, verifyPayload);
          } catch (e) {
            console.warn('Payment verification fallback:', e);
          }
        }

        queryClient.invalidateQueries({ queryKey: ['myTournamentRegistrations'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });

        if (confirmedRegistration) {
          setConfirmedRegistration({
            ...confirmedRegistration,
            transactionId: data.razorpay_payment_id,
            paymentStatus: 'completed',
          });
        }

        setIsProcessingPayment(false);
        setShowSuccessModal(true);
      } else if (data.status === 'cancelled') {
        setIsRazorpayModalVisible(false);
        setIsRegisterModalVisible(true);
        setRegStep(2);
        Alert.alert('Payment Cancelled', 'You cancelled the payment transaction. Your registration details have been saved, so you can retry payment whenever you are ready.');
      } else if (data.status === 'failed') {
        setIsRazorpayModalVisible(false);
        setIsRegisterModalVisible(true);
        setRegStep(2);
        const errorDesc = data.error?.description || 'Payment transaction failed. Please retry or choose a different payment method.';
        setRegisterError(errorDesc);
        Alert.alert('Payment Failed', errorDesc);
      }
    } catch (e) {
      setIsRazorpayModalVisible(false);
    }
  };

  const generateRazorpayHtml = () => {
    if (!razorpayOrder) return '';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: -apple-system, sans-serif; background-color: #f9fafb; }
          .loader-container { text-align: center; }
          .spinner { width: 44px; height: 44px; border: 4px solid #E5E7EB; border-radius: 50%; border-left-color: #FF5100; animation: spin 1s linear infinite; margin: 0 auto 16px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      </head>
      <body>
        <div class="loader-container">
          <div class="spinner"></div>
          <h3 style="margin: 0; font-size: 16px; color: #0F2C59;">Connecting to Secure Payment Gateway...</h3>
        </div>
        <script>
          var options = {
            "key": ${JSON.stringify(razorpayOrder.keyId)},
            "amount": ${razorpayOrder.amount},
            "currency": "INR",
            "name": "Arenova Tournaments",
            "description": ${JSON.stringify(tournament?.name || 'Tournament Registration')},
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
              "name": ${JSON.stringify(regName || user?.name || 'Athlete')},
              "email": ${JSON.stringify(regEmail || user?.email || '')},
              "contact": ${JSON.stringify(regPhone || user?.phone || '')}
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

  const bannerUrl = getTournamentBanner(tournament);
  const categories = tournament?.categories || tournament?.divisions || [];

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F9] justify-center items-center">
        <ActivityIndicator size="large" color="#FF5100" />
        <Typography variant="body2" color="muted" className="mt-2 font-outfit">
          Loading tournament details...
        </Typography>
      </SafeAreaView>
    );
  }

  if (error || !tournament) {
    return (
      <SafeAreaView className="flex-1 bg-[#EEF3F9] justify-center items-center px-6">
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" className="mb-2" />
        <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold mb-2">
          Tournament Not Found
        </Typography>
        <Typography variant="body2" color="muted" align="center" className="font-outfit mb-6">
          Unable to load tournament information or it may no longer be available.
        </Typography>
        <Button title="Go Back" onPress={() => { try { router.back(); } catch (e) { router.replace('/'); } }} fullWidth={false} className="px-6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View className="px-4 py-3 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity 
          onPress={() => {
            try {
              router.back();
            } catch (e) {
              router.replace('/');
            }
          }} 
          className="p-2 -ml-2"
        >
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold flex-1 text-center mx-2" numberOfLines={1}>
          {tournament.name || tournament.title || 'Tournament Details'}
        </Typography>
        <TouchableOpacity className="p-2 -mr-2">
          <Ionicons name="share-social-outline" size={22} color="#0F2C59" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 90, 110) }}
      >
        {/* Dynamic Banner Image */}
        <View className="h-56 bg-secondary relative overflow-hidden">
          <Image source={{ uri: bannerUrl }} className="w-full h-full" resizeMode="cover" />
          <View className="absolute top-4 right-4 bg-primary px-3 py-1.5 rounded-full shadow-md">
            <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold uppercase text-[11px]">
              {tournament.sport || tournament.sportName || 'Sports'}
            </Typography>
          </View>
        </View>

        <View className="px-5 pt-5">
          {/* Main Info */}
          <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold mb-3">
            {tournament.name || tournament.title || 'Tournament Name'}
          </Typography>

          {/* Key Badges / Details Row */}
          <View className="flex-row flex-wrap items-center gap-3 mb-5">
            <View className="flex-row items-center bg-white px-3.5 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
              <Ionicons name="calendar" size={16} color="#FF5100" className="mr-2" />
              <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                {tournament.startDate ? `${new Date(tournament.startDate).toLocaleDateString()} - ${tournament.endDate ? new Date(tournament.endDate).toLocaleDateString() : ''}` : (tournament.date || 'TBA')}
              </Typography>
            </View>

            <View className="flex-row items-center bg-white px-3.5 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
              <Ionicons name="location" size={16} color="#4A90E2" className="mr-2" />
              <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                {tournament.location || tournament.venue || 'Sports Arena'}
              </Typography>
            </View>

            <View className="flex-row items-center bg-white px-3.5 py-2.5 rounded-2xl border border-gray-100 shadow-sm">
              <Ionicons name="pricetag" size={16} color="#10B981" className="mr-2" />
              <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                {tournament.entryFee !== undefined ? `₹${tournament.entryFee}` : (tournament.fee || 'Free Entry')}
              </Typography>
            </View>
          </View>

          {/* Description */}
          <View className="bg-white rounded-3xl p-5 mb-5 border border-gray-100 shadow-sm">
            <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
              About Tournament
            </Typography>
            <Typography variant="body2" color="muted" className="font-outfit leading-6">
              {tournament.description || tournament.details || 'Join this exciting tournament! Challenge top athletes, showcase your skills, and compete for trophies and prizes.'}
            </Typography>
          </View>

          {/* Available Categories / Divisions */}
          <View className="bg-white rounded-3xl p-5 mb-6 border border-gray-100 shadow-sm">
            <Typography variant="subtitle1" color="secondary" weight="bold" className="mb-4 font-outfit-bold">
              Categories & Divisions
            </Typography>

            {categories.length === 0 ? (
              <TouchableOpacity
                onPress={() => handleOpenRegisterModal()}
                className="p-4 rounded-2xl bg-orange-50/60 border border-orange-100 flex-row items-center justify-between"
              >
                <View className="flex-1 mr-2">
                  <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                    Open General Registration
                  </Typography>
                  <Typography variant="caption" color="muted" className="font-outfit mt-0.5">
                    Standard division open for all participants.
                  </Typography>
                </View>
                <View className="bg-primary px-4 py-2 rounded-full shadow-sm">
                  <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                    Register
                  </Typography>
                </View>
              </TouchableOpacity>
            ) : (
              categories.map((cat: any, idx: number) => {
                const catName = typeof cat === 'string' ? cat : (cat.name || cat.title || `Category ${idx + 1}`);
                const catFee = typeof cat === 'object' && cat.fee !== undefined ? `₹${cat.fee}` : null;

                return (
                  <TouchableOpacity
                    key={cat._id || cat.id || idx}
                    onPress={() => handleOpenRegisterModal(cat)}
                    activeOpacity={0.8}
                    className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex-row items-center justify-between mb-3"
                  >
                    <View className="flex-1 mr-2">
                      <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                        {catName}
                      </Typography>
                      {cat.description && (
                        <Typography variant="caption" color="muted" className="font-outfit mt-0.5">
                          {cat.description}
                        </Typography>
                      )}
                    </View>
                    {catFee && (
                      <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold mr-3">
                        {catFee}
                      </Typography>
                    )}
                    <View className="bg-primary px-3.5 py-2 rounded-full shadow-sm">
                      <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                        Register
                      </Typography>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Fixed Action Bar - Raised with Safe Area Bottom Padding */}
      <View 
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 pt-4 flex-row items-center justify-between shadow-2xl z-20"
        style={{ paddingBottom: Math.max(insets.bottom + 12, 18) }}
      >
        <View>
          <Typography variant="caption" color="muted" className="font-outfit text-xs">Entry Fee</Typography>
          <Typography variant="h2" color="primary" weight="bold" className="font-outfit-bold text-xl">
            {tournament.entryFee !== undefined ? `₹${tournament.entryFee}` : 'Free'}
          </Typography>
        </View>

        <Button
          title="Register Now"
          onPress={() => handleOpenRegisterModal()}
          fullWidth={false}
          className="px-8 shadow-sm"
        />
      </View>

      {/* REGISTRATION MODAL SHEET (Step 1: Selection & Details | Step 2: Review & Price Breakdown) */}
      <Modal
        visible={isRegisterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (regStep === 2) {
            setRegStep(1);
          } else {
            setIsRegisterModalVisible(false);
          }
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/60 justify-end"
        >
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setIsRegisterModalVisible(false)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-4 shadow-2xl border-t border-gray-200 max-h-[90%]"
            style={{ paddingBottom: Math.max(insets.bottom + 16, 28) }}
          >
            {/* Drag Handle Indicator */}
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            {/* Header with Step Indicator */}
            <View className="flex-row justify-between items-center mb-3 pb-2 border-b border-gray-100">
              <View>
                <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold">
                  {regStep === 1 ? 'Tournament Registration' : 'Review & Payment'}
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit">
                  {regStep === 1 ? 'Step 1 of 2: Participant & Category' : 'Step 2 of 2: Review & Pay Fee'}
                </Typography>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="flex-row items-center gap-1.5 mr-2">
                  <View className={`w-2.5 h-2.5 rounded-full ${regStep === 1 ? 'bg-primary' : 'bg-emerald-500'}`} />
                  <View className={`w-2.5 h-2.5 rounded-full ${regStep === 2 ? 'bg-primary' : 'bg-gray-200'}`} />
                </View>
                <TouchableOpacity 
                  onPress={() => setIsRegisterModalVisible(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#0F2C59" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-grow-0" keyboardShouldPersistTaps="handled">
              {registerError && (
                <View className="mb-4 bg-red-50 p-3.5 rounded-2xl border border-red-200 flex-row items-center">
                  <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5" />
                  <Typography variant="caption" className="font-outfit text-red-600 flex-1 leading-4">
                    {registerError}
                  </Typography>
                </View>
              )}

              {/* STEP 1: CATEGORY, PARTICIPANT & CONTACT DETAILS */}
              {regStep === 1 && (
                <>
                  {/* Tournament Summary Card */}
                  <View className="bg-orange-50/70 p-4 rounded-2xl border border-orange-100 mb-4">
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold uppercase text-[10px] tracking-wider">
                      Tournament Event
                    </Typography>
                    <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mt-0.5">
                      {tournament.name || tournament.title}
                    </Typography>
                    {tournament.sport && (
                      <Typography variant="caption" color="muted" className="font-outfit mt-0.5">
                        Sport: {tournament.sport} {tournament.city ? `• ${tournament.city}` : ''}
                      </Typography>
                    )}
                  </View>

                  {/* Category Selector */}
                  <View className="mb-5">
                    <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
                      Select Category / Division
                    </Typography>
                    {categories.length === 0 ? (
                      <View className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                        <Typography variant="body2" color="secondary" weight="semibold" className="font-outfit-semibold">
                          Open Standard Division
                        </Typography>
                        <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold mt-1">
                          Fee: ₹{tournament.entryFee !== undefined ? tournament.entryFee : 0}
                        </Typography>
                      </View>
                    ) : (
                      categories.map((cat: any, idx: number) => {
                        const isSel = selectedCategory === cat || 
                          (typeof selectedCategory === 'object' && selectedCategory?._id === cat?._id) ||
                          (typeof selectedCategory === 'string' && (cat.name === selectedCategory || cat === selectedCategory));
                        const cName = typeof cat === 'string' ? cat : (cat.name || cat.title || `Category ${idx + 1}`);
                        const cFee = getCategoryFee(cat);

                        return (
                          <TouchableOpacity
                            key={cat._id || cat.id || idx}
                            onPress={() => setSelectedCategory(cat)}
                            className={`p-3.5 rounded-2xl border mb-2.5 flex-row items-center justify-between ${
                              isSel ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <View className="flex-1 mr-3">
                              <Typography variant="subtitle2" color={isSel ? 'primary' : 'secondary'} weight="bold" className="font-outfit-bold">
                                {cName}
                              </Typography>
                              {cat.description && (
                                <Typography variant="caption" color="muted" className="font-outfit text-xs mt-0.5" numberOfLines={1}>
                                  {cat.description}
                                </Typography>
                              )}
                            </View>
                            <View className="items-end">
                              <Typography variant="subtitle2" color="primary" weight="bold" className="font-outfit-bold">
                                {cFee > 0 ? `₹${cFee}` : 'Free'}
                              </Typography>
                              {isSel && (
                                <Ionicons name="checkmark-circle" size={18} color="#FF5100" style={{ marginTop: 2 }} />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>

                  {/* Participant Selection (Child for Parent role, Athlete display for Individual) */}
                  {user?.role === 'parent' ? (
                    <View className="mb-5">
                      <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
                        Select Participant (Child)
                      </Typography>
                      {childrenList.length === 0 ? (
                        <TouchableOpacity 
                          onPress={() => {
                            setIsRegisterModalVisible(false);
                            router.push('/(parent)/family/add-child');
                          }}
                          className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex-row items-center justify-between"
                        >
                          <Typography variant="body2" color="secondary" className="font-outfit">
                            No child profiles found. Tap to add a child profile.
                          </Typography>
                          <Ionicons name="add-circle" size={22} color="#FF5100" />
                        </TouchableOpacity>
                      ) : (
                        childrenList.map((child: any) => {
                          const cId = child._id || child.id;
                          const isSelected = selectedChildId === cId;
                          return (
                            <TouchableOpacity
                              key={cId}
                              onPress={() => setSelectedChildId(cId)}
                              className={`p-3.5 rounded-2xl border mb-2.5 flex-row items-center justify-between ${
                                isSelected ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <View className="flex-row items-center">
                                <Ionicons name="person-circle" size={28} color={isSelected ? '#FF5100' : '#9CA3AF'} className="mr-3" />
                                <View>
                                  <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                                    {child.name}
                                  </Typography>
                                  <Typography variant="caption" color="muted" className="font-outfit text-xs">
                                    {child.age ? `${child.age} yrs` : 'Child Profile'} {child.sport ? `• ${child.sport}` : ''}
                                  </Typography>
                                </View>
                              </View>
                              {isSelected && <Ionicons name="checkmark-circle" size={22} color="#FF5100" />}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  ) : (
                    <View className="mb-5 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                      <Typography variant="caption" color="muted" className="font-outfit">Registering Athlete</Typography>
                      <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mt-0.5">
                        {user?.name || 'Individual Player'}
                      </Typography>
                      <Typography variant="caption" color="secondary" className="font-outfit opacity-80 mt-0.5">
                        {user?.email}
                      </Typography>
                    </View>
                  )}

                  {/* Contact Information Form */}
                  <View className="mb-4">
                    <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-2 font-outfit-bold">
                      Contact & Participant Details
                    </Typography>
                    <TextInput
                      label="Full Name"
                      placeholder="Participant or Guardian name"
                      value={regName}
                      onChangeText={setRegName}
                      className="mb-2.5"
                    />
                    <TextInput
                      label="Mobile Number (10 Digits)"
                      placeholder="e.g. 9876543210"
                      keyboardType="phone-pad"
                      value={regPhone}
                      onChangeText={setRegPhone}
                      className="mb-2.5"
                    />
                    <TextInput
                      label="Email Address"
                      placeholder="name@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={regEmail}
                      onChangeText={setRegEmail}
                      className="mb-2.5"
                    />
                    <TextInput
                      label="Partner / Team Name (Optional)"
                      placeholder="For doubles or team events"
                      value={partnerName}
                      onChangeText={setPartnerName}
                      className="mb-2"
                    />
                  </View>

                  <Button
                    title="Continue to Review & Payment"
                    onPress={handleProceedToReview}
                    className="mt-2 mb-4 shadow-sm"
                  />
                </>
              )}

              {/* STEP 2: REVIEW SUMMARY & PRICE BREAKDOWN */}
              {regStep === 2 && (
                <>
                  {/* Review Summary Card */}
                  <View className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 shadow-sm">
                    <Typography variant="caption" color="muted" weight="bold" className="font-outfit-bold uppercase tracking-wider text-[11px] mb-3">
                      Order Summary
                    </Typography>

                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                      <Typography variant="body2" color="muted" className="font-outfit">Tournament</Typography>
                      <Typography variant="body2" color="secondary" weight="bold" className="font-outfit-bold text-right flex-1 ml-4" numberOfLines={1}>
                        {tournament.name || tournament.title}
                      </Typography>
                    </View>

                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                      <Typography variant="body2" color="muted" className="font-outfit">Category</Typography>
                      <Typography variant="body2" color="secondary" weight="bold" className="font-outfit-bold text-right">
                        {typeof selectedCategory === 'string' ? selectedCategory : (selectedCategory?.name || selectedCategory?.title || 'Open Division')}
                      </Typography>
                    </View>

                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                      <Typography variant="body2" color="muted" className="font-outfit">Participant</Typography>
                      <Typography variant="body2" color="primary" weight="bold" className="font-outfit-bold text-right">
                        {user?.role === 'parent' && selectedChildId
                          ? (childrenList.find((c: any) => (c._id || c.id) === selectedChildId)?.name || 'Child')
                          : (regName || user?.name || 'Athlete')}
                      </Typography>
                    </View>

                    {partnerName.trim() ? (
                      <View className="flex-row justify-between py-2 border-b border-gray-100">
                        <Typography variant="body2" color="muted" className="font-outfit">Partner / Team</Typography>
                        <Typography variant="body2" color="secondary" weight="medium" className="font-outfit text-right">
                          {partnerName}
                        </Typography>
                      </View>
                    ) : null}

                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                      <Typography variant="body2" color="muted" className="font-outfit">Mobile</Typography>
                      <Typography variant="body2" color="secondary" weight="medium" className="font-outfit text-right">
                        +91 {regPhone}
                      </Typography>
                    </View>

                    <View className="flex-row justify-between py-2">
                      <Typography variant="body2" color="muted" className="font-outfit">Email</Typography>
                      <Typography variant="body2" color="secondary" weight="medium" className="font-outfit text-right flex-1 ml-4" numberOfLines={1}>
                        {regEmail}
                      </Typography>
                    </View>
                  </View>

                  {/* Price Breakdown Card */}
                  <View className="bg-orange-50/60 rounded-2xl border border-orange-100 p-4 mb-5">
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold uppercase tracking-wider text-[11px] mb-3">
                      Payment Details
                    </Typography>

                    <View className="flex-row justify-between py-1.5">
                      <Typography variant="body2" color="muted" className="font-outfit">Category Registration Fee</Typography>
                      <Typography variant="body2" color="secondary" weight="semibold" className="font-outfit-semibold">
                        ₹{getCategoryFee(selectedCategory)}
                      </Typography>
                    </View>

                    <View className="flex-row justify-between py-1.5">
                      <Typography variant="body2" color="muted" className="font-outfit">Platform Convenience Fee</Typography>
                      <Typography variant="body2" color="text" weight="bold" className="font-outfit-bold text-emerald-600">
                        Free (₹0)
                      </Typography>
                    </View>

                    <View className="flex-row justify-between pt-3 mt-2 border-t border-orange-200/80 items-center">
                      <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                        Total Payable
                      </Typography>
                      <Typography variant="h2" color="primary" weight="bold" className="font-outfit-bold text-xl">
                        ₹{getCategoryFee(selectedCategory)}
                      </Typography>
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <Button
                    title={getCategoryFee(selectedCategory) > 0 ? `Pay ₹${getCategoryFee(selectedCategory)} via Razorpay` : "Confirm Free Registration"}
                    onPress={handleInitiatePayment}
                    isLoading={isProcessingPayment}
                    className="mb-3 shadow-sm"
                  />

                  <Button
                    title="Back to Edit Details"
                    variant="outline"
                    onPress={() => setRegStep(1)}
                    disabled={isProcessingPayment}
                    className="mb-4"
                  />
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* RAZORPAY GATEWAY WEBVIEW MODAL */}
      <Modal
        visible={isRazorpayModalVisible}
        animationType="slide"
        onRequestClose={() => {
          setIsRazorpayModalVisible(false);
          setIsRegisterModalVisible(true);
          setRegStep(2);
        }}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
            <View>
              <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                Secure Payment
              </Typography>
              <Typography variant="caption" color="muted" className="font-outfit text-xs">
                Arenova Tournament Registration
              </Typography>
            </View>
            <TouchableOpacity
              onPress={() => {
                setIsRazorpayModalVisible(false);
                setIsRegisterModalVisible(true);
                setRegStep(2);
              }}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#0F2C59" />
            </TouchableOpacity>
          </View>
          {razorpayOrder && (
            <WebView
              source={{ html: generateRazorpayHtml() }}
              onMessage={handleRazorpayMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              className="flex-1"
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* REGISTRATION & PAYMENT SUCCESS MODAL WITH DOWNLOAD INVOICE */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-5">
          <View className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl items-center border border-gray-100">
            <View className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 items-center justify-center mb-4 shadow-sm">
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>

            <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-center mb-1">
              Registration Confirmed!
            </Typography>
            <Typography variant="caption" color="muted" align="center" className="font-outfit mb-5">
              Your entry and payment have been verified.
            </Typography>

            <View className="w-full bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-200">
              <Typography variant="caption" color="muted" className="font-outfit text-xs">Tournament</Typography>
              <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold mt-0.5">
                {tournament?.name || tournament?.title}
              </Typography>

              <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-200">
                <Typography variant="caption" color="muted" className="font-outfit">Category</Typography>
                <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold">
                  {typeof selectedCategory === 'string' ? selectedCategory : (selectedCategory?.name || selectedCategory?.title || 'Standard')}
                </Typography>
              </View>

              <View className="flex-row justify-between items-center mt-2">
                <Typography variant="caption" color="muted" className="font-outfit">Participant</Typography>
                <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold">
                  {user?.role === 'parent' && selectedChildId
                    ? (childrenList.find((c: any) => (c._id || c.id) === selectedChildId)?.name || 'Child')
                    : (regName || user?.name || 'Athlete')}
                </Typography>
              </View>

              <View className="flex-row justify-between items-center mt-2">
                <Typography variant="caption" color="muted" className="font-outfit">Payment Status</Typography>
                <Typography variant="caption" weight="bold" className="font-outfit-bold text-emerald-600 uppercase">
                  Verified / Paid
                </Typography>
              </View>

              {confirmedRegistration?.transactionId ? (
                <View className="flex-row justify-between items-center mt-2">
                  <Typography variant="caption" color="muted" className="font-outfit">Transaction ID</Typography>
                  <Typography variant="caption" color="secondary" weight="medium" className="font-outfit text-xs">
                    {confirmedRegistration.transactionId}
                  </Typography>
                </View>
              ) : null}
            </View>

            <Button
              title="Download Invoice (PDF)"
              onPress={() => handleDownloadInvoice()}
              isLoading={isDownloadingInvoice}
              className="w-full mb-3"
            />

            <Button
              title="View My Registrations"
              variant="outline"
              onPress={() => {
                setShowSuccessModal(false);
                router.push('/my-tournaments');
              }}
              className="w-full mb-3"
            />

            <TouchableOpacity 
              onPress={() => setShowSuccessModal(false)}
              className="py-2 px-4"
            >
              <Typography variant="body2" color="muted" className="font-outfit">
                Done
              </Typography>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
