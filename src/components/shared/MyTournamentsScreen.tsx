import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, RAZORPAY_KEY_ID } from '@/services/api';

export default function MyTournamentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

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

  const { data: registrationsResponse, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['myTournamentRegistrations'],
    queryFn: async () => {
      const res = await api.get('/novare/registrations/my');
      return res.data?.data || res.data;
    }
  });

  const { data: detailResponse, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['tournamentRegistrationDetail', selectedRegistrationId],
    queryFn: async () => {
      if (!selectedRegistrationId) return null;
      const res = await api.get(`/novare/registrations/${selectedRegistrationId}`);
      return res.data?.data || res.data;
    },
    enabled: !!selectedRegistrationId
  });

  const registrations = Array.isArray(registrationsResponse) 
    ? registrationsResponse 
    : (registrationsResponse?.registrations || registrationsResponse?.data || []);

  const detailObj = detailResponse;

  const isRegConfirmed = (reg: any) => {
    const paymentStatus = String(reg?.paymentStatus || '').toUpperCase();
    const registrationStatus = String(reg?.registrationStatus || reg?.status || '').toUpperCase();
    const isPaid = paymentStatus === 'PAID' || paymentStatus === 'COMPLETED' || paymentStatus === 'VERIFIED';
    return isPaid && (registrationStatus === 'CONFIRMED' || registrationStatus === 'VERIFIED');
  };

  const handleDownloadInvoice = async (regId?: string, invoiceIdParam?: string) => {
    setIsDownloadingInvoice(true);
    try {
      let targetInvoiceId = invoiceIdParam;

      if (!targetInvoiceId) {
        const res = await api.get('/invoices/my', { params: { limit: 25 } }).catch(() => null);
        const list = res?.data?.data || res?.data || [];
        const match = list.find((inv: any) => 
          inv.registrationId === regId || 
          inv.registration?._id === regId ||
          inv.metadata?.registrationId === regId ||
          inv.bookingId === regId
        ) || list[0];

        if (match) {
          targetInvoiceId = match._id || match.id;
        }
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
      setIsDownloadingInvoice(false);
    } catch (err: any) {
      setIsDownloadingInvoice(false);
      const msg = err?.response?.data?.message || err?.message || 'Invoice PDF is being prepared.';
      Alert.alert('Invoice', msg);
    }
  };

  const handleResumePayment = async (reg: any) => {
    if (!reg) return;
    setActivePayReg(reg);
    setIsResumingPayment(true);

    const regId = reg._id || reg.id;
    const fee = Number(reg.amount || reg.fee || reg.category?.fee || 0);

    // Order Details from registration or create order
    let orderId = reg.orderId || reg.order?.id || reg.order?.orderId;
    let amountPaise = reg.order?.amount || (fee > 0 ? Math.round(fee * 100) : 100);
    let keyId = reg.order?.key || RAZORPAY_KEY_ID;

    if (!orderId && fee > 0) {
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
        if (orderData?.gatewayKeyId || orderData?.keyId) {
          keyId = orderData.gatewayKeyId || orderData.keyId;
        }
      } catch (e) {
        console.log('Order creation fallback:', e);
        orderId = `order_tourn_${Date.now()}`;
      }
    }

    setRazorpayOrder({
      orderId: orderId || `order_tourn_${Date.now()}`,
      amount: amountPaise,
      keyId,
      currency: 'INR'
    });

    setIsResumingPayment(false);
    setIsRazorpayModalVisible(true);
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
              razorpay_payment_id: data.razorpay_payment_id,
              paymentOrderId: data.razorpay_order_id || razorpayOrder?.orderId,
              razorpay_order_id: data.razorpay_order_id || razorpayOrder?.orderId,
              paymentSignature: data.razorpay_signature,
              razorpay_signature: data.razorpay_signature,
              paymentStatus: 'PAID',
              registrationStatus: 'CONFIRMED',
              status: 'verified',
            });
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
            "description": "Tournament Registration",
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
        <TouchableOpacity onPress={() => refetch()} className="p-2 -mr-2">
          <Ionicons name="refresh" size={20} color="#FF5100" />
        </TouchableOpacity>
      </View>

      {isLoading || isRefetching ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FF5100" />
          <Typography variant="body2" color="muted" className="mt-2 font-outfit">
            Loading your tournament registrations...
          </Typography>
        </View>
      ) : registrations.length === 0 ? (
        <View className="flex-1 px-8 pt-20 items-center justify-center">
          <View className="w-20 h-20 rounded-full bg-white shadow-sm items-center justify-center mb-4 border border-gray-100">
            <Ionicons name="trophy-outline" size={38} color="#9CA3AF" />
          </View>
          <Typography variant="h3" color="secondary" weight="bold" className="mb-2 font-outfit-bold text-center">
            No Tournament Registrations
          </Typography>
          <Typography variant="body2" color="muted" align="center" className="mb-6 font-outfit">
            You haven't registered for any sports tournaments yet. Explore upcoming tournaments and register!
          </Typography>
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
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 40, 60) }}
        >
          {registrations.map((reg: any, idx: number) => {
            const regId = reg._id || reg.id || idx.toString();
            const tournamentObj = reg.tournamentId || reg.tournament || {};
            const tournamentName = tournamentObj.name || tournamentObj.title || reg.tournamentName || 'Tournament';
            const categoryName = reg.categoryName || reg.category?.name || reg.category || 'Open Division';
            const isConfirmed = isRegConfirmed(reg);
            const dateStr = reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : '';
            const fee = reg.amount || reg.fee || 0;

            return (
              <TouchableOpacity
                key={regId}
                onPress={() => setSelectedRegistrationId(regId)}
                activeOpacity={0.8}
                className="bg-white rounded-3xl p-5 mb-4 shadow-sm border border-gray-100"
              >
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
                      {isConfirmed ? 'REGISTERED' : 'PAYMENT PENDING'}
                    </Typography>
                  </View>
                </View>

                {reg.childName && (
                  <View className="bg-gray-50 px-3 py-1.5 rounded-xl self-start mb-2 flex-row items-center">
                    <Ionicons name="person-outline" size={12} color="#6B7280" className="mr-1" />
                    <Typography variant="caption" color="secondary" weight="medium" className="font-outfit text-xs">
                      Participant: {reg.childName}
                    </Typography>
                  </View>
                )}

                <View className="flex-row items-center justify-between pt-3 border-t border-gray-100 mt-2">
                  <Typography variant="caption" color="muted" className="font-outfit">
                    {dateStr ? `Reg: ${dateStr}` : 'Registration'}
                  </Typography>

                  <View className="flex-row items-center gap-2">
                    {isConfirmed ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDownloadInvoice(regId, reg.invoiceId);
                        }}
                        className="px-2.5 py-1.5 bg-orange-50 border border-orange-200 rounded-lg flex-row items-center"
                      >
                        <Ionicons name="download-outline" size={13} color="#FF5100" style={{ marginRight: 4 }} />
                        <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-[11px]">
                          Invoice
                        </Typography>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleResumePayment(reg);
                        }}
                        className="px-3 py-1.5 bg-primary rounded-xl flex-row items-center shadow-xs"
                      >
                        <Ionicons name="card-outline" size={13} color="white" style={{ marginRight: 4 }} />
                        <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                          {fee > 0 ? `Pay ₹${fee}` : 'Complete'}
                        </Typography>
                      </TouchableOpacity>
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

      {/* REGISTRATION DETAILS MODAL */}
      <Modal
        visible={!!selectedRegistrationId}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRegistrationId(null)}
      >
        <View className="flex-1 bg-black/50 justify-end">
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

            {isLoadingDetail ? (
              <ActivityIndicator size="small" color="#FF5100" style={{ paddingVertical: 20 }} />
            ) : detailObj ? (
              <View style={{ gap: 12 }}>
                <View className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                    {detailObj.tournament?.name || detailObj.tournamentName || 'Tournament'}
                  </Typography>
                  <Typography variant="body2" color="muted" className="font-outfit mt-1">
                    Category: <Typography weight="bold">{detailObj.categoryName || detailObj.category || 'Standard'}</Typography>
                  </Typography>
                  <Typography variant="caption" color="secondary" className="font-outfit mt-1">
                    Registration ID: #{detailObj._id || detailObj.id}
                  </Typography>
                </View>

                {detailObj.childName || detailObj.participantName ? (
                  <View className="flex-row justify-between py-2 border-b border-gray-100">
                    <Typography variant="body2" color="muted" className="font-outfit">Participant</Typography>
                    <Typography variant="body2" color="secondary" weight="bold" className="font-outfit-bold">
                      {detailObj.childName || detailObj.participantName}
                    </Typography>
                  </View>
                ) : null}

                {detailObj.email || detailObj.phone ? (
                  <View className="flex-row justify-between py-2 border-b border-gray-100">
                    <Typography variant="body2" color="muted" className="font-outfit">Contact</Typography>
                    <Typography variant="body2" color="secondary" weight="medium" className="font-outfit text-xs">
                      {detailObj.phone ? `+91 ${detailObj.phone}` : ''} {detailObj.email ? `• ${detailObj.email}` : ''}
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
                  <Button
                    title={detailObj.amount ? `Pay Now (₹${detailObj.amount}) & Confirm` : 'Complete Payment'}
                    onPress={() => {
                      setSelectedRegistrationId(null);
                      handleResumePayment(detailObj);
                    }}
                    isLoading={isResumingPayment}
                    className="mt-3 mb-2"
                  />
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
        onRequestClose={() => setIsRazorpayModalVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
            <View>
              <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold">
                Complete Payment
              </Typography>
              <Typography variant="caption" color="muted" className="font-outfit text-xs">
                Tournament Entry Checkout
              </Typography>
            </View>
            <TouchableOpacity
              onPress={() => setIsRazorpayModalVisible(false)}
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
    </SafeAreaView>
  );
}
