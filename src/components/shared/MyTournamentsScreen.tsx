import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, RAZORPAY_KEY_ID } from '@/services/api';
import { useAuthStore } from '@/store';
import { 
  getDeletedPendingTournamentIds, 
  markPendingTournamentAsDeleted, 
  markMultiplePendingTournamentsAsDeleted,
  unmarkPendingTournamentAsDeleted,
  getConfirmedTournamentIds,
  markTournamentAsConfirmed,
  processTournamentRegistrations,
  normalizeInvoices,
  invoiceMatchesRegistration,
  isTournamentInvoice
} from '@/utils/deletedTournaments';

export default function MyTournamentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
  const [tournamentTab, setTournamentTab] = useState<'confirmed' | 'pending'>('confirmed');
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);

  // Resume Payment States
  const [activePayReg, setActivePayReg] = useState<any | null>(null);
  const [isRazorpayModalVisible, setIsRazorpayModalVisible] = useState(false);
  const [isResumingPayment, setIsResumingPayment] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<{
    orderId: string;
    amount: number;
    keyId: string;
    currency?: string;
  } | null>(null);

  // Fetch registrations: checks /novare/registrations/my AND fetches any registrations referenced in invoices
  const { data: registrationsResponse, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['myTournamentRegistrations', user?.phone],
    queryFn: async () => {
      let list: any[] = [];
      const cleanPhone = (user?.phone || '').replace(/\D/g, '').slice(-10);

      // 1. Fetch user registrations
      try {
        const res = await api.get('/novare/registrations/my', {
          params: cleanPhone ? { phone: cleanPhone, mobile: cleanPhone, mobileNumber: cleanPhone } : undefined
        });
        const data = res.data?.data || res.data;
        list = Array.isArray(data) ? [...data] : (Array.isArray(data?.registrations) ? [...data.registrations] : []);
      } catch (e) {
        console.log('Error fetching my registrations:', e);
      }

      // 2. Cross-check invoices to resolve any registration ID by that ID
      try {
        const invRes = await api.get('/invoices/my', { params: { limit: 50 } });
        const invList = normalizeInvoices(invRes.data);
        for (const inv of invList) {
          const invRegId = String(
            inv.registrationId || 
            inv.registration_id || 
            inv.registration?._id || 
            inv.metadata?.registrationId || 
            inv.metadata?.registration_id || 
            ''
          ).trim();

          if (invRegId && invRegId.length > 5) {
            const alreadyExists = list.some(r => String(r._id || r.id) === invRegId);
            if (!alreadyExists) {
              try {
                const regRes = await api.get(`/novare/registrations/${invRegId}`);
                const regData = regRes.data?.data || regRes.data;
                if (regData && (regData._id || regData.id)) {
                  list.push(regData);
                }
              } catch (_) {}
            }
          }
        }
      } catch (_) {}

      return list;
    }
  });

  const { data: invoicesResponse, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/invoices/my', { params: { limit: 50 } }).catch(() => null);
      return res?.data?.data || res?.data || [];
    }
  });

  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [locallyConfirmedIds, setLocallyConfirmedIds] = useState<string[]>([]);

  useEffect(() => {
    getDeletedPendingTournamentIds().then(setDeletedIds);
    getConfirmedTournamentIds().then(setLocallyConfirmedIds);
  }, []);

  // Process registrations and invoices with synthesis so every paid entry is included
  const {
    confirmedRegistrations,
    pendingRegistrations,
    allInvoices,
    totalPaidAmount,
  } = useMemo(() => {
    return processTournamentRegistrations({
      rawRegistrations: registrationsResponse,
      invoicesResponse,
      locallyConfirmedIds,
      deletedIds,
    });
  }, [registrationsResponse, invoicesResponse, locallyConfirmedIds, deletedIds]);

  const displayRegistrations = tournamentTab === 'confirmed' ? confirmedRegistrations : pendingRegistrations;

  const isRegConfirmed = (reg: any) => {
    if (!reg) return false;
    const rid = String(reg._id || reg.id || '').trim();
    return (
      confirmedRegistrations.some((cr: any) => String(cr._id || cr.id) === rid) ||
      locallyConfirmedIds.includes(rid) ||
      String(reg.paymentStatus || '').toUpperCase() === 'PAID' ||
      String(reg.registrationStatus || '').toUpperCase() === 'CONFIRMED'
    );
  };

  const { data: detailResponse, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['tournamentRegistrationDetail', selectedRegistrationId],
    queryFn: async () => {
      if (!selectedRegistrationId) return null;
      try {
        const res = await api.get(`/novare/registrations/${selectedRegistrationId}`);
        return res.data?.data || res.data;
      } catch (e) {
        return null;
      }
    },
    enabled: !!selectedRegistrationId
  });

  // Fallback to in-memory registration if detail query is loading or 404
  const detailObj = 
    detailResponse || 
    confirmedRegistrations.find(r => (r._id || r.id) === selectedRegistrationId) || 
    pendingRegistrations.find(r => (r._id || r.id) === selectedRegistrationId);

  const handleDownloadInvoice = async (regId?: string, invoiceIdParam?: string) => {
    setIsDownloadingInvoice(true);
    try {
      let targetInvoiceId = invoiceIdParam;

      if (!targetInvoiceId) {
        // Try finding matching invoice in allInvoices
        const match = allInvoices.find((inv: any) => {
          if (regId && invoiceMatchesRegistration(inv, { _id: regId, id: regId })) return true;
          return false;
        }) || allInvoices.find((inv: any) => isTournamentInvoice(inv)) || allInvoices[0];

        if (match) {
          targetInvoiceId = match._id || match.id;
        }
      }

      if (!targetInvoiceId) {
        try {
          const freshRes = await api.get('/invoices/my', { params: { limit: 25 } });
          const freshList = normalizeInvoices(freshRes.data);
          const freshMatch = freshList.find((inv: any) => {
            if (regId && invoiceMatchesRegistration(inv, { _id: regId, id: regId })) return true;
            return false;
          }) || freshList[0];
          if (freshMatch) {
            targetInvoiceId = freshMatch._id || freshMatch.id;
          }
        } catch (_) {}
      }

      if (!targetInvoiceId) {
        Alert.alert(
          'Invoice Being Prepared',
          'Your registration invoice PDF is currently being generated. Please check back in a few moments.'
        );
        setIsDownloadingInvoice(false);
        return;
      }

      const downloadRes = await api.get(`/invoices/${targetInvoiceId}/download`);
      const downloadData = downloadRes.data?.data || downloadRes.data;
      const pdfUrl = downloadData?.downloadUrl || downloadData?.url || downloadData?.pdfUrl;

      if (pdfUrl) {
        await Linking.openURL(pdfUrl);
      } else {
        Alert.alert('Notice', 'Invoice PDF will be ready in a few moments.');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 400) {
        Alert.alert(
          'PDF Being Generated',
          'Your invoice PDF is currently being prepared on the server. Please tap download again in a moment.'
        );
      } else {
        const msg = err?.response?.data?.message || err?.message || 'Invoice PDF is being prepared.';
        Alert.alert('Invoice', msg);
      }
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const handleResumePayment = async (reg: any) => {
    if (!reg) return;
    setActivePayReg(reg);
    setIsResumingPayment(true);

    const regId = reg._id || reg.id;
    const fee = Number(reg.amount || reg.fee || reg.category?.fee || 0);

    const orderObj = reg.order || reg.razorpayOrder || {};
    let orderId = orderObj.id || orderObj.orderId || reg.orderId || reg.order?.id || '';

    let amountPaise = 0;
    if (orderObj.amountInPaise) {
      amountPaise = Number(orderObj.amountInPaise);
    } else if (orderObj.amount) {
      const rawAmt = Number(orderObj.amount);
      if (fee > 0 && Math.abs(rawAmt - fee) < 1) {
        amountPaise = Math.round(fee * 100);
      } else if (rawAmt >= fee * 100) {
        amountPaise = Math.round(rawAmt);
      } else {
        amountPaise = Math.round(rawAmt * 100);
      }
    } else if (fee > 0) {
      amountPaise = Math.round(fee * 100);
    } else {
      amountPaise = 100;
    }

    let keyId = 
      orderObj.key || 
      orderObj.keyId || 
      orderObj.razorpayKeyId || 
      orderObj.gatewayKeyId || 
      reg.keyId || 
      reg.razorpayKeyId || 
      RAZORPAY_KEY_ID;

    if (!orderId || !orderId.startsWith('order_') || orderId.startsWith('order_tourn_')) {
      try {
        const orderRes = await api.post('/bookings/create-order', {
          amount: fee,
          tournamentId: reg.tournamentId?._id || reg.tournamentId || reg.tournament?._id || reg.tournament,
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
        if (orderData?.gatewayKeyId || orderData?.razorpayKeyId || orderData?.keyId) {
          keyId = orderData.gatewayKeyId || orderData.razorpayKeyId || orderData.keyId;
        }
      } catch (e) {
        console.log('Order creation fallback notice:', e);
      }
    }

    setRazorpayOrder({
      orderId: orderId || '',
      amount: amountPaise,
      keyId,
      currency: 'INR'
    });

    setIsResumingPayment(false);
    setIsRazorpayModalVisible(true);
  };

  const handleDeleteRegistration = (regItem: any) => {
    if (!regItem) return;
    const regId = regItem._id || regItem.id;
    const tournName = regItem.tournament?.name || regItem.tournamentName || regItem.tournamentId?.name || 'Tournament';

    Alert.alert(
      'Delete Pending Registration',
      `Are you sure you want to remove your pending registration for ${tournName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await markPendingTournamentAsDeleted(regId);
              setDeletedIds(prev => [...prev, regId]);
              await api.delete(`/novare/registrations/${regId}`).catch(() => 
                api.post(`/novare/registrations/${regId}/cancel`).catch(() => null)
              );
            } catch (e) {
              console.log('Delete registration API notice:', e);
            }

            queryClient.setQueryData(['myTournamentRegistrations', user?.phone], (old: any) => {
              if (Array.isArray(old)) {
                return old.filter((r: any) => (r._id || r.id) !== regId);
              }
              if (old && typeof old === 'object') {
                const list = old.registrations || old.data || [];
                const filtered = list.filter((r: any) => (r._id || r.id) !== regId);
                return { ...old, registrations: filtered, data: filtered };
              }
              return old;
            });

            setSelectedRegistrationId(null);
            Alert.alert('Registration Removed', 'The pending registration has been successfully removed.');
          }
        }
      ]
    );
  };

  const handleClearAllPending = () => {
    if (pendingRegistrations.length === 0) return;
    Alert.alert(
      'Clear All Pending Registrations',
      `Are you sure you want to delete all ${pendingRegistrations.length} pending registration(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            const ids = pendingRegistrations.map((r: any) => r._id || r.id).filter(Boolean);
            await markMultiplePendingTournamentsAsDeleted(ids);
            setDeletedIds(prev => Array.from(new Set([...prev, ...ids])));
            queryClient.invalidateQueries({ queryKey: ['myTournamentRegistrations'] });
            Alert.alert('Cleared', 'All pending registrations have been deleted.');
          }
        }
      ]
    );
  };

  const handleCloseRazorpay = () => {
    Alert.alert(
      'Exit Checkout?',
      'Are you sure you want to cancel payment? You can resume payment anytime from your pending list.',
      [
        { text: 'Keep Paying', style: 'cancel' },
        { 
          text: 'Exit', 
          style: 'destructive',
          onPress: () => setIsRazorpayModalVisible(false)
        }
      ]
    );
  };

  const handleRazorpayMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.status === 'success') {
        setIsRazorpayModalVisible(false);
        const targetRegId = activePayReg?._id || activePayReg?.id || selectedRegistrationId;

        if (targetRegId) {
          try {
            await api.post(`/novare/registrations/${targetRegId}/verify-payment`, {
              transactionId: data.razorpay_payment_id,
              paymentTransactionId: data.razorpay_payment_id,
              razorpay_payment_id: data.razorpay_payment_id,
              paymentOrderId: data.razorpay_order_id || razorpayOrder?.orderId,
              razorpay_order_id: data.razorpay_order_id || razorpayOrder?.orderId,
              paymentSignature: data.razorpay_signature,
              razorpay_signature: data.razorpay_signature,
              paymentStatus: 'PAID',
              registrationStatus: 'CONFIRMED',
              status: 'verified',
            });
            await unmarkPendingTournamentAsDeleted(targetRegId);
            await markTournamentAsConfirmed(targetRegId, activePayReg?.tournamentId?._id || activePayReg?.tournamentId);
            setLocallyConfirmedIds(prev => [...prev, targetRegId]);
            setDeletedIds(prev => prev.filter(id => id !== targetRegId));
          } catch (e) {
            console.warn('Payment verification error:', e);
          }
        }

        queryClient.invalidateQueries({ queryKey: ['myTournamentRegistrations'] });
        queryClient.invalidateQueries({ queryKey: ['tournamentRegistrationDetail'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });

        Alert.alert('Payment Successful!', 'Your tournament entry has been verified and registered.');
      } else if (data.status === 'cancelled') {
        setIsRazorpayModalVisible(false);
        Alert.alert('Payment Cancelled', 'Payment was cancelled. You can complete it whenever you are ready.');
      } else if (data.status === 'failed') {
        setIsRazorpayModalVisible(false);
        Alert.alert('Payment Failed', data.error?.description || 'Transaction failed. Please retry.');
      }
    } catch (e) {
      setIsRazorpayModalVisible(false);
    }
  };

  const generateRazorpayHtml = () => {
    if (!razorpayOrder) return '';
    const cleanPhone = (activePayReg?.phone || user?.phone || '').replace(/\D/g, '').slice(-10);
    const cleanName = activePayReg?.childName || activePayReg?.participantName || activePayReg?.name || user?.name || 'Athlete';
    const cleanEmail = activePayReg?.email || user?.email || '';
    const isRealOrderId = !!(razorpayOrder.orderId && razorpayOrder.orderId.startsWith('order_') && !razorpayOrder.orderId.startsWith('order_tourn_'));

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
            "description": "Tournament Registration",
            "handler": function (response){
              window.ReactNativeWebView.postMessage(JSON.stringify({
                status: 'success',
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id || ${JSON.stringify(razorpayOrder.orderId)},
                razorpay_signature: response.razorpay_signature || ''
              }));
            },
            "modal": {
              "ondismiss": function(){
                window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'cancelled' }));
              }
            },
            "prefill": {
              "name": ${JSON.stringify(cleanName)},
              "email": ${JSON.stringify(cleanEmail)},
              "contact": ${JSON.stringify(cleanPhone)}
            },
            "theme": {
              "color": "#FF5100"
            }
          };

          if (${JSON.stringify(isRealOrderId)}) {
            options.order_id = ${JSON.stringify(razorpayOrder.orderId)};
          }

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

  const handleRefresh = () => {
    refetch();
    refetchInvoices();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 flex-row justify-between items-center bg-[#0F2C59] border-b border-gray-100 shadow-sm z-10">
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
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold">
          My Tournaments
        </Typography>
        <TouchableOpacity onPress={handleRefresh} className="p-2 -mr-2">
          <Ionicons name="refresh" size={20} color="#FF5100" />
        </TouchableOpacity>
      </View>

      {/* Total Paid & Invoices Summary Header */}
      <View className="px-4 py-2.5 bg-[#0F2C59] border-t border-white/10">
        <View className="bg-white/10 rounded-2xl p-3 flex-row items-center justify-between border border-white/15">
          <View className="flex-row items-center flex-1 mr-2">
            <View className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 items-center justify-center mr-3">
              <Ionicons name="receipt-outline" size={20} color="#FF5100" />
            </View>
            <View>
              <Typography variant="caption" color="light" className="font-outfit opacity-80 text-[11px] uppercase tracking-wider">
                Total Tournaments Paid
              </Typography>
              <Typography variant="subtitle1" color="white" weight="bold" className="font-outfit-bold text-base">
                ₹{totalPaidAmount.toLocaleString('en-IN')}
              </Typography>
            </View>
          </View>

          {allInvoices.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowInvoicesModal(true)}
              className="px-3 py-2 bg-[#FF5100] rounded-xl flex-row items-center shadow-xs active:bg-orange-600"
            >
              <Ionicons name="document-text-outline" size={14} color="white" style={{ marginRight: 4 }} />
              <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                Invoices ({allInvoices.length})
              </Typography>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs: Confirmed vs Pending */}
      <View className="px-4 pt-2 pb-2.5 bg-[#0F2C59]">
        <View className="flex-row bg-white/10 p-1 rounded-2xl">
          <TouchableOpacity
            onPress={() => setTournamentTab('confirmed')}
            className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
              tournamentTab === 'confirmed' ? 'bg-[#FF5100]' : 'bg-transparent'
            }`}
          >
            <Ionicons name="checkmark-circle-outline" size={15} color="white" style={{ marginRight: 6 }} />
            <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
              Confirmed ({confirmedRegistrations.length})
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTournamentTab('pending')}
            className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
              tournamentTab === 'pending' ? 'bg-[#FF5100]' : 'bg-transparent'
            }`}
          >
            <Ionicons name="time-outline" size={15} color="white" style={{ marginRight: 6 }} />
            <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
              Pending ({pendingRegistrations.length})
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading || isRefetching ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FF5100" />
          <Typography variant="body2" color="muted" className="mt-2 font-outfit">
            Loading your tournament registrations...
          </Typography>
        </View>
      ) : displayRegistrations.length === 0 ? (
        <View className="flex-1 px-8 pt-20 items-center justify-center">
          <View className="w-20 h-20 rounded-full bg-white shadow-sm items-center justify-center mb-4 border border-gray-100">
            <Ionicons 
              name={tournamentTab === 'confirmed' ? 'trophy-outline' : 'checkmark-done-circle-outline'} 
              size={38} 
              color={tournamentTab === 'confirmed' ? '#9CA3AF' : '#10B981'} 
            />
          </View>
          <Typography variant="h3" color="secondary" weight="bold" className="mb-2 font-outfit-bold text-center">
            {tournamentTab === 'confirmed' ? 'No Confirmed Registrations' : 'No Pending Payments'}
          </Typography>
          <Typography variant="body2" color="muted" align="center" className="mb-6 font-outfit">
            {tournamentTab === 'confirmed' 
              ? "You don't have any confirmed tournament registrations yet. Explore tournaments to join the competition!" 
              : "Great news! You don't have any pending payments or unpaid registrations."}
          </Typography>
          {tournamentTab === 'confirmed' ? (
            <Button 
              title="Explore Tournaments" 
              onPress={() => {
                try {
                  router.back();
                } catch (e) {
                  router.replace('/');
                }
              }}
              fullWidth={false}
              className="px-6"
            />
          ) : (
            <Button 
              title="View Confirmed" 
              onPress={() => setTournamentTab('confirmed')}
              fullWidth={false}
              className="px-6"
            />
          )}
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 40, 60) }}
        >
          {tournamentTab === 'pending' && pendingRegistrations.length > 0 && (
            <View className="flex-row justify-between items-center mb-3 px-1">
              <Typography variant="caption" color="muted" className="font-outfit">
                {pendingRegistrations.length} Pending Registration{pendingRegistrations.length > 1 ? 's' : ''}
              </Typography>
              <TouchableOpacity
                onPress={handleClearAllPending}
                className="flex-row items-center px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-xl active:bg-red-100 shadow-xs"
              >
                <Ionicons name="trash-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                <Typography variant="caption" weight="bold" className="font-outfit-bold text-red-600 text-xs">
                  Clear All Pending
                </Typography>
              </TouchableOpacity>
            </View>
          )}

          {displayRegistrations.map((reg: any, idx: number) => {
            const regId = String(reg._id || reg.id || idx.toString());
            const tournamentObj = 
              typeof reg.tournamentId === 'object' && reg.tournamentId !== null 
                ? reg.tournamentId 
                : (typeof reg.tournament === 'object' && reg.tournament !== null ? reg.tournament : {});
            const tournamentName = 
              tournamentObj.name || 
              tournamentObj.title || 
              reg.tournamentName || 
              reg.title || 
              'Tournament Registration';
            const categoryName = 
              reg.categoryName || 
              reg.category?.name || 
              reg.category || 
              'Confirmed Entry';
            const isConfirmed = isRegConfirmed(reg);
            const dateStr = reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : '';
            const fee = Number(reg.amount || reg.fee || 0);
            const phoneDisplay = reg.phone || reg.mobileNumber || user?.phone || '';

            return (
              <TouchableOpacity
                key={regId}
                onPress={() => setSelectedRegistrationId(regId)}
                activeOpacity={0.8}
                className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-gray-100"
              >
                {/* Header: Trophy, Name, Category & Status Badge */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-10 h-10 rounded-xl bg-[#FFF5F0] items-center justify-center mr-3">
                      <Ionicons name="trophy" size={20} color="#FF5100" />
                    </View>
                    <View className="flex-1">
                      <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold" numberOfLines={1}>
                        {tournamentName}
                      </Typography>
                      <Typography variant="caption" color="muted" className="font-outfit">
                        {categoryName}
                      </Typography>
                    </View>
                  </View>

                  <View className={`px-2.5 py-1 rounded-full border ${isConfirmed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <Typography 
                      variant="caption" 
                      weight="bold" 
                      className={`font-outfit-bold text-[10px] ${isConfirmed ? 'text-emerald-700' : 'text-amber-800'}`}
                    >
                      {isConfirmed ? (fee > 0 ? `PAID ₹${fee}` : 'REGISTERED') : 'PAYMENT PENDING'}
                    </Typography>
                  </View>
                </View>

                {/* Details Badges: Participant, Phone Number & Registration ID */}
                <View className="flex-row flex-wrap items-center gap-1.5 mb-2.5">
                  {(reg.childName || reg.participantName) ? (
                    <View className="bg-gray-50 px-2.5 py-1 rounded-xl flex-row items-center border border-gray-100">
                      <Ionicons name="person-outline" size={11} color="#6B7280" style={{ marginRight: 4 }} />
                      <Typography variant="caption" color="secondary" weight="medium" className="font-outfit text-[11px]">
                        {reg.childName || reg.participantName}
                      </Typography>
                    </View>
                  ) : null}

                  {phoneDisplay ? (
                    <View className="bg-blue-50 px-2.5 py-1 rounded-xl flex-row items-center border border-blue-100">
                      <Ionicons name="call-outline" size={11} color="#2563EB" style={{ marginRight: 4 }} />
                      <Typography variant="caption" weight="medium" className="font-outfit text-blue-700 text-[11px]">
                        +91 {phoneDisplay}
                      </Typography>
                    </View>
                  ) : null}

                  {regId && !regId.startsWith('synth_') && !regId.startsWith('tourn_reg_') && (
                    <View className="bg-gray-50 px-2 py-1 rounded-xl flex-row items-center border border-gray-100">
                      <Typography variant="caption" color="muted" className="font-outfit text-[10px]">
                        ID: #{regId.length > 8 ? regId.slice(-8) : regId}
                      </Typography>
                    </View>
                  )}
                </View>

                {/* Footer: Date / Invoice # & Action Buttons */}
                <View className="flex-row items-center justify-between pt-3 border-t border-gray-100 mt-1">
                  <View>
                    <Typography variant="caption" color="muted" className="font-outfit text-xs">
                      {dateStr ? `Reg: ${dateStr}` : 'Confirmed Entry'}
                    </Typography>
                    {reg.invoiceNumber ? (
                      <Typography variant="caption" color="muted" className="font-outfit text-[11px] opacity-75">
                        Invoice #{reg.invoiceNumber}
                      </Typography>
                    ) : null}
                  </View>

                  <View className="flex-row items-center gap-2">
                    {isConfirmed ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDownloadInvoice(regId, reg.invoiceId);
                        }}
                        className="px-2.5 py-1.5 bg-orange-50 border border-orange-200 rounded-lg flex-row items-center active:bg-orange-100"
                      >
                        <Ionicons name="download-outline" size={13} color="#FF5100" style={{ marginRight: 4 }} />
                        <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-[11px]">
                          Invoice PDF
                        </Typography>
                      </TouchableOpacity>
                    ) : (
                      <View className="flex-row items-center gap-1.5">
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleResumePayment(reg);
                          }}
                          className="px-3 py-1.5 bg-primary rounded-xl flex-row items-center shadow-xs active:bg-orange-600"
                        >
                          <Ionicons name="card-outline" size={13} color="white" style={{ marginRight: 4 }} />
                          <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                            {fee > 0 ? `Pay ₹${fee}` : 'Complete'}
                          </Typography>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteRegistration(reg);
                          }}
                          className="px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-xl flex-row items-center justify-center shadow-xs active:bg-red-100"
                        >
                          <Ionicons name="trash-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                          <Typography variant="caption" weight="bold" className="font-outfit-bold text-red-600 text-xs">
                            Delete
                          </Typography>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View className="flex-row items-center">
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold mr-1">
                        Details
                      </Typography>
                      <Ionicons name="chevron-forward" size={14} color="#FF5100" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ALL INVOICES MODAL */}
      <Modal
        visible={showInvoicesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInvoicesModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setShowInvoicesModal(false)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200 max-h-[85%]"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
                  Payment Invoices
                </Typography>
                <Typography variant="caption" color="muted" className="font-outfit">
                  {allInvoices.length} Verified Invoice{allInvoices.length !== 1 ? 's' : ''} • Total ₹{totalPaidAmount.toLocaleString('en-IN')}
                </Typography>
              </View>
              <TouchableOpacity 
                onPress={() => setShowInvoicesModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {allInvoices.length === 0 ? (
              <View className="py-12 items-center justify-center">
                <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
                <Typography variant="body2" color="muted" className="font-outfit mt-2">
                  No payment invoices found yet.
                </Typography>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} className="mt-1">
                {allInvoices.map((inv: any, idx: number) => {
                  const invId = inv._id || inv.id || idx.toString();
                  const invNumber = inv.invoiceNumber || inv.number || `INV-${idx + 1}`;
                  const title = inv.title || inv.tournamentName || inv.description || inv.name || 'Tournament Registration';
                  const dateStr = inv.createdAt || inv.date ? new Date(inv.createdAt || inv.date).toLocaleDateString() : '';
                  const amount = Number(inv.total || inv.amount || inv.totalAmount || 0);

                  return (
                    <View 
                      key={invId}
                      className="p-4 mb-3 rounded-2xl bg-gray-50 border border-gray-200 flex-row justify-between items-center"
                    >
                      <View className="flex-1 mr-3">
                        <View className="flex-row items-center mb-1">
                          <View className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md mr-2">
                            <Typography variant="caption" weight="bold" className="font-outfit-bold text-emerald-700 text-[10px]">
                              PAID
                            </Typography>
                          </View>
                          <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">
                            {invNumber}
                          </Typography>
                        </View>
                        <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold" numberOfLines={1}>
                          {title}
                        </Typography>
                        <Typography variant="caption" color="muted" className="font-outfit text-xs mt-0.5">
                          {dateStr} • ₹{amount}
                        </Typography>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleDownloadInvoice(undefined, invId)}
                        disabled={isDownloadingInvoice}
                        className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl flex-row items-center active:bg-orange-100"
                      >
                        <Ionicons name="download-outline" size={15} color="#FF5100" style={{ marginRight: 4 }} />
                        <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs">
                          PDF
                        </Typography>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* REGISTRATION DETAILS MODAL */}
      <Modal
        visible={!!selectedRegistrationId}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRegistrationId(null)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setSelectedRegistrationId(null)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold">
                Registration Details
              </Typography>
              <TouchableOpacity onPress={() => setSelectedRegistrationId(null)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {isLoadingDetail && !detailObj ? (
              <ActivityIndicator size="small" color="#FF5100" style={{ paddingVertical: 20 }} />
            ) : detailObj ? (
              <View style={{ gap: 12 }}>
                <View className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                    {detailObj.tournament?.name || detailObj.tournamentName || detailObj.title || 'Tournament Registration'}
                  </Typography>
                  <Typography variant="body2" color="muted" className="font-outfit mt-1">
                    Category: <Typography weight="bold">{detailObj.categoryName || detailObj.category?.name || detailObj.category || 'Standard'}</Typography>
                  </Typography>
                  <Typography variant="caption" color="secondary" className="font-outfit mt-1">
                    Registration ID: #{detailObj._id || detailObj.id}
                  </Typography>
                  {detailObj.invoiceNumber ? (
                    <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold mt-0.5">
                      Invoice #{detailObj.invoiceNumber}
                    </Typography>
                  ) : null}
                </View>

                {detailObj.childName || detailObj.participantName ? (
                  <View className="flex-row justify-between py-2 border-b border-gray-100">
                    <Typography variant="body2" color="muted" className="font-outfit">Participant</Typography>
                    <Typography variant="body2" color="secondary" weight="bold" className="font-outfit-bold">
                      {detailObj.childName || detailObj.participantName}
                    </Typography>
                  </View>
                ) : null}

                {(detailObj.phone || detailObj.mobileNumber || user?.phone) ? (
                  <View className="flex-row justify-between py-2 border-b border-gray-100">
                    <Typography variant="body2" color="muted" className="font-outfit">Registered Mobile</Typography>
                    <Typography variant="body2" color="secondary" weight="medium" className="font-outfit text-xs">
                      +91 {detailObj.phone || detailObj.mobileNumber || user?.phone}
                    </Typography>
                  </View>
                ) : null}

                <View className="flex-row justify-between py-2 border-b border-gray-100">
                  <Typography variant="body2" color="muted" className="font-outfit">Registration Status</Typography>
                  <Typography 
                    variant="body2" 
                    weight="bold" 
                    className={`font-outfit-bold uppercase ${isRegConfirmed(detailObj) ? 'text-emerald-600' : 'text-amber-800'}`}
                  >
                    {isRegConfirmed(detailObj) ? 'CONFIRMED' : 'PENDING_PAYMENT'}
                  </Typography>
                </View>

                <View className="flex-row justify-between py-2 border-b border-gray-100">
                  <Typography variant="body2" color="muted" className="font-outfit">Payment Status</Typography>
                  <Typography 
                    variant="body2" 
                    weight="bold" 
                    className={`font-outfit-bold uppercase ${isRegConfirmed(detailObj) ? 'text-emerald-600' : 'text-amber-800'}`}
                  >
                    {isRegConfirmed(detailObj) ? 'PAID' : 'PENDING'}
                  </Typography>
                </View>

                {isRegConfirmed(detailObj) ? (
                  <Button
                    title="Download Invoice (PDF)"
                    onPress={() => handleDownloadInvoice(detailObj._id || detailObj.id, detailObj.invoiceId)}
                    isLoading={isDownloadingInvoice}
                    className="mt-3 mb-2"
                  />
                ) : (
                  <>
                    <Button
                      title={detailObj.amount ? `Pay Now (₹${detailObj.amount}) & Confirm` : 'Complete Payment'}
                      onPress={() => {
                        setSelectedRegistrationId(null);
                        handleResumePayment(detailObj);
                      }}
                      isLoading={isResumingPayment}
                      className="mt-3 mb-2"
                    />

                    <TouchableOpacity
                      onPress={() => {
                        const target = detailObj;
                        setSelectedRegistrationId(null);
                        handleDeleteRegistration(target);
                      }}
                      className="py-3 px-4 rounded-2xl border border-red-200 bg-red-50 flex-row items-center justify-center mb-2"
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                      <Typography variant="body2" weight="bold" className="font-outfit-bold text-red-600">
                        Delete Pending Registration
                      </Typography>
                    </TouchableOpacity>
                  </>
                )}

                <Button
                  title="Close"
                  variant="white"
                  onPress={() => setSelectedRegistrationId(null)}
                />
              </View>
            ) : (
              <Typography variant="body2" color="muted" align="center" className="py-4 font-outfit">
                Registration details loaded.
              </Typography>
            )}
          </View>
        </View>
      </Modal>

      {/* RAZORPAY GATEWAY MODAL FOR RESUMING PAYMENT */}
      <Modal
        visible={isRazorpayModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseRazorpay}
      >
        <View style={{ flex: 1, backgroundColor: '#0F2C59', paddingTop: insets.top }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3.5 bg-[#0F2C59] border-b border-white/10">
            <View className="flex-row items-center flex-1 mr-3">
              <View className="w-9 h-9 rounded-full bg-white/10 items-center justify-center mr-3 border border-white/15">
                <Ionicons name="shield-checkmark" size={18} color="#FF5100" />
              </View>
              <View className="flex-1">
                <Typography variant="subtitle1" color="white" weight="bold" className="font-outfit-bold text-sm">
                  Complete Payment
                </Typography>
                <Typography variant="caption" color="light" className="font-outfit opacity-75 text-[11px]">
                  Razorpay 256-bit Secure Checkout
                </Typography>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleCloseRazorpay}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              className="w-9 h-9 rounded-full bg-white/15 items-center justify-center active:bg-white/25"
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* WebView Container */}
          <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingBottom: insets.bottom }}>
            {razorpayOrder && (
              <WebView
                source={{ html: generateRazorpayHtml() }}
                onMessage={handleRazorpayMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                style={{ flex: 1, backgroundColor: '#F9FAFB' }}
                startInLoadingState={true}
                renderLoading={() => (
                  <View className="absolute inset-0 items-center justify-center bg-[#F9FAFB]">
                    <ActivityIndicator size="large" color="#FF5100" />
                    <Typography variant="body2" color="secondary" weight="bold" className="font-outfit-bold mt-3">
                      Connecting to Razorpay...
                    </Typography>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
