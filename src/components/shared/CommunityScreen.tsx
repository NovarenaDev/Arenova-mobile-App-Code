import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  Modal, 
  TextInput, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button } from '@/components/ui';
import { router, useNavigation, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WebView } from 'react-native-webview';
import { api, RAZORPAY_KEY_ID } from '@/services/api';
import { useAuthStore } from '@/store';
import { 
  CommunityCenter, 
  CommunityProgram, 
  CommunityPlan, 
  CommunitySubscription, 
  UserChild,
  formatTimeHHmm, 
  formatWeekdays, 
  formatDateOnly 
} from '@/utils/communityHelpers';

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Strict Role Guard: Coaches cannot access player community discovery / purchase
  useEffect(() => {
    if (user?.role === 'coach') {
      Alert.alert(
        'Access Denied (Role Boundary)',
        'Coaches cannot purchase academy subscriptions. Navigating to coach community portal.'
      );
      router.replace('/(coach)/community');
    }
  }, [user]);

  const isParent = user?.role === 'parent';

  // Navigation Tabs: 'explore' | 'subscriptions' | 'complaints' | 'refunds'
  const [activeTab, setActiveTab] = useState<'explore' | 'subscriptions' | 'complaints' | 'refunds'>(
    params?.tab && ['explore', 'subscriptions', 'complaints', 'refunds'].includes(params.tab)
      ? (params.tab as any)
      : 'explore'
  );

  useEffect(() => {
    if (params?.tab && ['explore', 'subscriptions', 'complaints', 'refunds'].includes(params.tab)) {
      setActiveTab(params.tab as any);
    }
  }, [params?.tab]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSportFilter, setSelectedSportFilter] = useState('All');

  // Selected Community Detail Modal
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);

  // Program Plan Selection & Checkout State
  const [selectedProgram, setSelectedProgram] = useState<CommunityProgram | null>(null);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [isCheckoutModalVisible, setIsCheckoutModalVisible] = useState(false);

  // New Child Registration (for parents)
  const [isAddChildModalVisible, setIsAddChildModalVisible] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState('');
  const [newChildSport, setNewChildSport] = useState('');
  const [newChildSchool, setNewChildSchool] = useState('');

  // Razorpay Checkout Modal
  const [isRazorpayModalVisible, setIsRazorpayModalVisible] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<{
    orderId: string;
    amount: number;
    amountInPaise: number;
    currency: string;
    gatewayKeyId: string;
    programId: string;
    planIndex: number;
    childId?: string;
    programTitle?: string;
    communityName?: string;
    planLabel?: string;
    participantName?: string;
  } | null>(null);

  // Success Activation Modal
  const [activatedSubscription, setActivatedSubscription] = useState<any | null>(null);

  // Access Pass Viewer Modal
  const [viewingPass, setViewingPass] = useState<CommunitySubscription | null>(null);

  // Report Complaint Modal
  const [complaintSubscription, setComplaintSubscription] = useState<CommunitySubscription | null>(null);
  const [complaintSessionDate, setComplaintSessionDate] = useState('');
  const [complaintType, setComplaintType] = useState<'COACH_ABSENCE' | 'PROGRAM_NOT_CONDUCTED' | 'REPEATED_MISSED_SESSIONS' | 'OTHER'>('COACH_ABSENCE');
  const [complaintReason, setComplaintReason] = useState('');

  const openComplaintModalForSub = (sub: CommunitySubscription) => {
    setComplaintSubscription(sub);
    const today = new Date().toISOString().split('T')[0];
    setComplaintSessionDate(today);
    setComplaintType('COACH_ABSENCE');
  };

  // 1. Fetch Communities List (Public Discovery)
  const { 
    data: communitiesData, 
    isLoading: isLoadingCommunities, 
    refetch: refetchCommunities,
    isRefetching: isRefetchingCommunities 
  } = useQuery({
    queryKey: ['publicCommunities'],
    queryFn: async () => {
      try {
        const res = await api.get('/communities');
        return res.data?.data || res.data || [];
      } catch (e) {
        return [];
      }
    }
  });

  // 2. Fetch Single Community Detail with Programs
  const { 
    data: communityDetail, 
    isLoading: isLoadingDetail,
    refetch: refetchCommunityDetail 
  } = useQuery({
    queryKey: ['publicCommunityDetail', selectedCommunityId],
    queryFn: async () => {
      if (!selectedCommunityId) return null;
      try {
        const res = await api.get(`/communities/${selectedCommunityId}`);
        return res.data?.data || res.data || null;
      } catch (e) {
        return null;
      }
    },
    enabled: !!selectedCommunityId
  });

  // 3. Fetch Parent's Children (if parent)
  const { 
    data: childrenData, 
    refetch: refetchChildren 
  } = useQuery({
    queryKey: ['parentChildren'],
    queryFn: async () => {
      if (!isParent) return [];
      try {
        const res = await api.get('/users/me/children');
        return res.data?.data || res.data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: isParent
  });

  // 4. Fetch My Subscriptions
  const { 
    data: mySubscriptionsData, 
    isLoading: isLoadingSubscriptions, 
    refetch: refetchSubscriptions,
    isRefetching: isRefetchingSubscriptions 
  } = useQuery({
    queryKey: ['mySubscriptions'],
    queryFn: async () => {
      try {
        const res = await api.get('/subscriptions/my');
        return res.data?.data || res.data || [];
      } catch (e) {
        return [];
      }
    }
  });

  // 5. Fetch My Complaints
  const { 
    data: myComplaintsData, 
    isLoading: isLoadingComplaints, 
    refetch: refetchComplaints,
    isRefetching: isRefetchingComplaints 
  } = useQuery({
    queryKey: ['myCommunityComplaints'],
    queryFn: async () => {
      try {
        const res = await api.get('/subscriptions/complaints/my?page=1&limit=20');
        return res.data?.data || res.data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: activeTab === 'complaints'
  });

  // 6. Fetch My Subscription Refunds
  const { 
    data: myRefundsData, 
    isLoading: isLoadingRefunds, 
    refetch: refetchRefunds,
    isRefetching: isRefetchingRefunds 
  } = useQuery({
    queryKey: ['myCommunityRefunds'],
    queryFn: async () => {
      try {
        const res = await api.get('/refunds/my?sourceType=SUBSCRIPTION&page=1&limit=20');
        return res.data?.data || res.data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: activeTab === 'refunds'
  });

  // Screen focus listener
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refetchCommunities();
      refetchSubscriptions();
      if (isParent) refetchChildren();
    });
    return unsubscribe;
  }, [navigation, refetchCommunities, refetchSubscriptions, isParent, refetchChildren]);

  // Add Child Mutation
  const addChildMutation = useMutation({
    mutationFn: async (payload: { name: string; age?: number; sport?: string; school?: string }) => {
      const res = await api.post('/users/me/children', payload);
      return res.data?.data || res.data;
    },
    onSuccess: (child: any) => {
      queryClient.invalidateQueries({ queryKey: ['parentChildren'] });
      setIsAddChildModalVisible(false);
      setNewChildName('');
      setNewChildAge('');
      setNewChildSport('');
      setNewChildSchool('');
      if (child?._id) {
        setSelectedChildId(child._id);
      }
      Alert.alert('Child Registered', 'Child profile has been linked to your account.');
    },
    onError: (err: any) => {
      Alert.alert('Registration Failed', err?.response?.data?.message || err.message || 'Could not add child.');
    }
  });

  // Create Subscription Order Mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload: { programId: string; planIndex: number; childId?: string }) => {
      const res = await api.post('/subscriptions/create-order', payload);
      return res.data?.data || res.data;
    },
    onSuccess: (data: any) => {
      setIsCheckoutModalVisible(false);
      const gatewayKeyId = data.gatewayKeyId || RAZORPAY_KEY_ID;
      const amountInPaise = data.amountInPaise || (data.amount ? data.amount * 100 : 0);

      setRazorpayOrder({
        orderId: data.orderId,
        amount: data.amount || (amountInPaise / 100),
        amountInPaise,
        currency: data.currency || 'INR',
        gatewayKeyId,
        programId: selectedProgram!._id,
        planIndex: selectedPlanIndex!,
        childId: selectedChildId || undefined,
        programTitle: selectedProgram?.title,
        communityName: communityDetail?.name,
        planLabel: selectedProgram?.plans?.[selectedPlanIndex!]?.label,
        participantName: data.participantName || user?.name
      });
      setIsRazorpayModalVisible(true);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Could not initiate subscription order.';
      Alert.alert('Order Creation Failed', msg);
    }
  });

  // Verify Subscription Payment Mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: async (payload: {
      programId: string;
      planIndex: number;
      paymentOrderId: string;
      paymentTransactionId: string;
      paymentSignature: string;
      childId?: string;
    }) => {
      const res = await api.post('/subscriptions/verify-payment', payload);
      return res.data;
    },
    onSuccess: (data: any) => {
      setIsRazorpayModalVisible(false);
      setRazorpayOrder(null);
      setSelectedCommunityId(null);
      setSelectedProgram(null);
      setSelectedPlanIndex(null);

      queryClient.invalidateQueries({ queryKey: ['mySubscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['publicCommunities'] });
      if (selectedCommunityId) {
        queryClient.invalidateQueries({ queryKey: ['publicCommunityDetail', selectedCommunityId] });
      }

      setActivatedSubscription(data);
    },
    onError: (err: any) => {
      setIsRazorpayModalVisible(false);
      const msg = err?.response?.data?.message || err.message || 'Payment verification could not be completed.';
      Alert.alert('Verification Issue', msg);
    }
  });

  // Submit Complaint Mutation
  const submitComplaintMutation = useMutation({
    mutationFn: async ({ subscriptionId, payload }: { subscriptionId: string; payload: any }) => {
      const res = await api.post(`/subscriptions/${subscriptionId}/complaints`, payload);
      return res.data;
    },
    onSuccess: () => {
      setComplaintSubscription(null);
      setComplaintSessionDate('');
      setComplaintReason('');
      queryClient.invalidateQueries({ queryKey: ['myCommunityComplaints'] });
      setActiveTab('complaints');
      Alert.alert('Complaint Submitted', 'Your report has been logged and assigned for community review.');
    },
    onError: (err: any) => {
      Alert.alert('Submission Error', err?.response?.data?.message || err.message || 'Could not submit complaint.');
    }
  });

  // Invoice Download Handler
  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}/download`);
      const downloadUrl = res.data?.data?.downloadUrl || res.data?.downloadUrl;
      if (downloadUrl) {
        Linking.openURL(downloadUrl).catch(() => {
          Alert.alert('Error', 'Unable to open invoice download URL.');
        });
      } else {
        Alert.alert('Processing', 'Invoice PDF is being generated. Please check back in a few moments.');
      }
    } catch (e: any) {
      Alert.alert('Invoice Error', e?.response?.data?.message || 'Failed to retrieve invoice download.');
    }
  };

  // Razorpay WebView message handler
  const handleRazorpayMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === 'success') {
        if (!razorpayOrder) return;
        verifyPaymentMutation.mutate({
          programId: razorpayOrder.programId,
          planIndex: razorpayOrder.planIndex,
          paymentOrderId: data.razorpay_order_id || razorpayOrder.orderId,
          paymentTransactionId: data.razorpay_payment_id,
          paymentSignature: data.razorpay_signature || '',
          childId: razorpayOrder.childId
        });
      } else if (data.status === 'cancelled') {
        setIsRazorpayModalVisible(false);
        Alert.alert('Payment Cancelled', 'You dismissed the payment checkout.');
      } else if (data.status === 'failed') {
        setIsRazorpayModalVisible(false);
        Alert.alert('Payment Failed', data.error?.description || 'Transaction could not be completed.');
      }
    } catch (_) {
      setIsRazorpayModalVisible(false);
    }
  };

  const generateRazorpayHtml = () => {
    if (!razorpayOrder) return '';
    const cleanPhone = (user?.phone || '').replace(/\D/g, '').slice(-10);
    const cleanName = razorpayOrder.participantName || user?.name || 'Sports Participant';
    const cleanEmail = user?.email || '';

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
            "key": ${JSON.stringify(razorpayOrder.gatewayKeyId)},
            "amount": ${razorpayOrder.amountInPaise},
            "currency": "INR",
            "name": ${JSON.stringify(razorpayOrder.communityName || 'Arenova Coaching')},
            "description": ${JSON.stringify(razorpayOrder.programTitle || 'Program Subscription Pass')},
            "order_id": ${JSON.stringify(razorpayOrder.orderId)},
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

          var rzp = new Razorpay(options);
          rzp.on('payment.failed', function (response){
            window.ReactNativeWebView.postMessage(JSON.stringify({
              status: 'failed',
              error: response.error
            }));
          });
          window.onload = function() {
            rzp.open();
          };
        </script>
      </body>
      </html>
    `;
  };

  const communitiesList: CommunityCenter[] = Array.isArray(communitiesData) 
    ? communitiesData 
    : (communitiesData?.data || []);

  const subscriptionsList: CommunitySubscription[] = Array.isArray(mySubscriptionsData)
    ? mySubscriptionsData
    : (mySubscriptionsData?.data || []);

  const complaintsList: any[] = Array.isArray(myComplaintsData)
    ? myComplaintsData
    : (myComplaintsData?.data || []);

  const refundsList: any[] = Array.isArray(myRefundsData)
    ? myRefundsData
    : (myRefundsData?.data || []);

  const childrenList: UserChild[] = Array.isArray(childrenData)
    ? childrenData
    : (childrenData?.data || []);

  // Filter communities by search and sport
  const filteredCommunities = communitiesList.filter((c: CommunityCenter) => {
    const matchesSearch = !searchQuery.trim() || 
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.address || '').toLowerCase().includes(searchQuery.toLowerCase());

    const sportsArr = Array.isArray(c.sports) ? c.sports : [];
    const matchesSport = selectedSportFilter === 'All' || 
      sportsArr.some(s => s.toLowerCase() === selectedSportFilter.toLowerCase());

    return matchesSearch && matchesSport;
  });

  // Distinct sports list for filter chips
  const allSportsSet = new Set<string>();
  communitiesList.forEach((c: CommunityCenter) => {
    if (Array.isArray(c.sports)) {
      c.sports.forEach(s => allSportsSet.add(s));
    }
  });
  const sportsFilterOptions = ['All', ...Array.from(allSportsSet)];

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]" edges={['top']}>
      {/* Top Header */}
      <View className="px-4 py-3 flex-row justify-between items-center bg-[#0F2C59] border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity 
          onPress={() => {
            if (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
              navigation.goBack();
            } else if (user?.role === 'parent') {
              router.replace('/(parent)/(parent-tabs)/parent-dashboard');
            } else if (user?.role === 'coach') {
              router.replace('/(coach)/(coach-tabs)/coach-dashboard');
            } else {
              router.replace('/(individual)/(individual-tabs)/individual-dashboard');
            }
          }} 
          className="p-2 -ml-2"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold text-lg">
          Coaching Communities
        </Typography>
        <TouchableOpacity 
          onPress={() => {
            if (activeTab === 'explore') refetchCommunities();
            else if (activeTab === 'subscriptions') refetchSubscriptions();
            else if (activeTab === 'complaints') refetchComplaints();
            else if (activeTab === 'refunds') refetchRefunds();
          }}
          className="p-2 -mr-2"
        >
          <Ionicons name="refresh" size={22} color="#FF5100" />
        </TouchableOpacity>
      </View>

      {/* Modern 4-Tab Navigation Bar */}
      <View className="bg-white border-b border-gray-100 px-4 pt-3 pb-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          <TouchableOpacity
            onPress={() => setActiveTab('explore')}
            className={`mr-2 px-4 py-2 rounded-full border ${activeTab === 'explore' ? 'bg-[#0F2C59] border-[#0F2C59]' : 'bg-gray-100 border-gray-200'}`}
          >
            <Typography variant="caption" color={activeTab === 'explore' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
              Explore Academies
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('subscriptions')}
            className={`mr-2 px-4 py-2 rounded-full border ${activeTab === 'subscriptions' ? 'bg-[#0F2C59] border-[#0F2C59]' : 'bg-gray-100 border-gray-200'}`}
          >
            <Typography variant="caption" color={activeTab === 'subscriptions' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
              My Subscriptions ({subscriptionsList.length})
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('complaints')}
            className={`mr-2 px-4 py-2 rounded-full border ${activeTab === 'complaints' ? 'bg-[#0F2C59] border-[#0F2C59]' : 'bg-gray-100 border-gray-200'}`}
          >
            <Typography variant="caption" color={activeTab === 'complaints' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
              Complaints
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('refunds')}
            className={`px-4 py-2 rounded-full border ${activeTab === 'refunds' ? 'bg-[#0F2C59] border-[#0F2C59]' : 'bg-gray-100 border-gray-200'}`}
          >
            <Typography variant="caption" color={activeTab === 'refunds' ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
              Refund Tracking
            </Typography>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ========================================================================= */}
      {/* TAB 1: EXPLORE ACADEMIES & PROGRAMS                                       */}
      {/* ========================================================================= */}
      {activeTab === 'explore' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 60, 80) }}
        >
          {/* Search Box */}
          <View className="bg-white rounded-2xl px-3.5 py-2.5 flex-row items-center border border-gray-200 shadow-xs mb-3">
            <Ionicons name="search" size={18} color="#64748B" className="mr-2" />
            <TextInput
              placeholder="Search academy by name, city, or locality..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 font-outfit text-secondary text-sm"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Sport Filter Chips */}
          {sportsFilterOptions.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
              {sportsFilterOptions.map((sport) => (
                <TouchableOpacity
                  key={sport}
                  onPress={() => setSelectedSportFilter(sport)}
                  className={`mr-2 px-3 py-1.5 rounded-full border ${selectedSportFilter === sport ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                >
                  <Typography variant="caption" color={selectedSportFilter === sport ? 'white' : 'secondary'} weight="semibold" className="font-outfit text-xs">
                    {sport}
                  </Typography>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Communities List */}
          {isLoadingCommunities || isRefetchingCommunities ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#FF5100" />
              <Typography variant="body2" color="muted" className="mt-2 font-outfit">
                Loading sports academies...
              </Typography>
            </View>
          ) : filteredCommunities.length === 0 ? (
            <View className="bg-white rounded-3xl p-8 items-center border border-gray-100 shadow-sm my-4">
              <Ionicons name="business-outline" size={38} color="#FF5100" className="mb-3" />
              <Typography variant="h3" color="secondary" weight="bold" align="center" className="mb-2 font-outfit-bold">
                No Communities Found
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="font-outfit mb-4">
                No coaching academies match your search criteria.
              </Typography>
              <Button title="Refresh List" onPress={() => refetchCommunities()} fullWidth={false} className="px-6" />
            </View>
          ) : (
            filteredCommunities.map((c: CommunityCenter) => {
              const sportsArr = Array.isArray(c.sports) ? c.sports : [];
              const programsCount = c.programs?.length ?? 0;

              return (
                <TouchableOpacity
                  key={c._id}
                  onPress={() => setSelectedCommunityId(c._id)}
                  activeOpacity={0.88}
                  className="bg-white rounded-3xl p-5 mb-4 border border-gray-100 shadow-sm"
                >
                  {/* Top Row: Academy Name & City Badge */}
                  <View className="flex-row items-center justify-between mb-2">
                    <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold text-lg flex-1 mr-2">
                      {c.name}
                    </Typography>
                    <View className="bg-primary/10 px-3 py-1 rounded-full">
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs">
                        {c.city}
                      </Typography>
                    </View>
                  </View>

                  {/* Address */}
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="location-outline" size={14} color="#64748B" className="mr-1.5" />
                    <Typography variant="caption" color="muted" className="font-outfit text-xs flex-1" numberOfLines={1}>
                      {c.address}
                    </Typography>
                  </View>

                  {/* Description */}
                  {c.description ? (
                    <Typography variant="body2" color="muted" className="font-outfit text-xs leading-4 mb-3" numberOfLines={2}>
                      {c.description}
                    </Typography>
                  ) : null}

                  {/* Bottom Stats & Sports */}
                  <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
                    <View className="flex-row items-center">
                      <Ionicons name="trophy-outline" size={14} color="#047857" className="mr-1" />
                      <Typography variant="caption" className="text-[#047857] font-outfit-bold text-xs">
                        {sportsArr.length > 0 ? sportsArr.join(', ') : 'Coaching Programs'}
                      </Typography>
                    </View>

                    <View className="flex-row items-center">
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs mr-1">
                        {programsCount} {programsCount === 1 ? 'Batch' : 'Batches'} Available
                      </Typography>
                      <Ionicons name="chevron-forward" size={14} color="#FF5100" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MY SUBSCRIPTIONS & ACCESS PASSES                                   */}
      {/* ========================================================================= */}
      {activeTab === 'subscriptions' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 60, 80) }}
        >
          {isLoadingSubscriptions || isRefetchingSubscriptions ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#FF5100" />
              <Typography variant="body2" color="muted" className="mt-2 font-outfit">
                Loading subscriptions...
              </Typography>
            </View>
          ) : subscriptionsList.length === 0 ? (
            <View className="bg-white rounded-3xl p-8 items-center border border-gray-100 shadow-sm my-4">
              <Ionicons name="card-outline" size={40} color="#FF5100" className="mb-3" />
              <Typography variant="h3" color="secondary" weight="bold" align="center" className="mb-2 font-outfit-bold">
                No Active Subscriptions
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="font-outfit mb-6">
                You haven't enrolled in any coaching community batches yet. Explore academies to get a training pass!
              </Typography>
              <Button 
                title="Explore Programs" 
                onPress={() => setActiveTab('explore')} 
                fullWidth={false} 
                className="px-6" 
              />
            </View>
          ) : (
            subscriptionsList.map((sub: CommunitySubscription) => {
              const isActivePass = sub.status === 'active';
              const isExpired = sub.status === 'expired';
              const isCancelled = sub.status === 'cancelled';
              const isRefunded = sub.paymentStatus === 'refunded' || sub.paymentStatus === 'partially_refunded';

              const programTitle = sub.programTitle || (typeof sub.programId === 'object' ? sub.programId?.title : 'Community Coaching Batch');
              const sportName = sub.sport || (typeof sub.programId === 'object' ? sub.programId?.sport : 'Sports');
              const communityName = sub.communityName || (typeof sub.programId === 'object' ? sub.programId?.communityId?.name : 'Sports Academy');

              return (
                <View 
                  key={sub._id}
                  className="bg-white rounded-3xl p-5 mb-4 border border-gray-100 shadow-sm overflow-hidden"
                >
                  {/* Top Status & Participant Row */}
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center flex-1 mr-2">
                      <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-2">
                        <Ionicons name="person" size={16} color="#FF5100" />
                      </View>
                      <View>
                        <Typography variant="caption" color="muted" className="text-[10px] uppercase font-outfit">
                          Participant
                        </Typography>
                        <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                          {sub.participantName}
                        </Typography>
                      </View>
                    </View>

                    {/* Status Pill */}
                    <View className={`px-3 py-1 rounded-full border ${
                      isActivePass 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : isCancelled 
                        ? 'bg-rose-50 border-rose-200' 
                        : 'bg-slate-100 border-slate-200'
                    }`}>
                      <Typography variant="caption" weight="bold" className={`text-xs font-outfit-bold ${
                        isActivePass 
                          ? 'text-emerald-700' 
                          : isCancelled 
                          ? 'text-rose-700' 
                          : 'text-slate-600'
                      }`}>
                        {isActivePass ? 'Active Access Pass' : isCancelled ? 'Program Cancelled' : isExpired ? 'Expired' : sub.status}
                      </Typography>
                    </View>
                  </View>

                  {/* Program & Academy */}
                  <View className="mb-3">
                    <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold text-base mb-0.5">
                      {programTitle}
                    </Typography>
                    <Typography variant="caption" color="muted" className="font-outfit text-xs">
                      {communityName} • {sportName}
                    </Typography>
                  </View>

                  {/* Validity & Plan Box */}
                  <View className="bg-gray-50 rounded-2xl p-3 mb-4 border border-gray-100">
                    <View className="flex-row items-center justify-between mb-1.5">
                      <Typography variant="caption" color="muted" className="font-outfit text-xs">
                        Valid Access Period:
                      </Typography>
                      <Typography variant="caption" color="secondary" weight="semibold" className="font-outfit-semibold text-xs">
                        {formatDateOnly(sub.plan?.startDate)} — {formatDateOnly(sub.plan?.endDate)}
                      </Typography>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Typography variant="caption" color="muted" className="font-outfit text-xs">
                        Plan Fee Paid:
                      </Typography>
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs">
                        ₹{sub.plan?.price} ({sub.plan?.label || `${sub.plan?.duration} ${sub.plan?.unit}`})
                      </Typography>
                    </View>
                  </View>

                  {/* Actions Row */}
                  <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
                    <TouchableOpacity
                      onPress={() => setViewingPass(sub)}
                      className="flex-row items-center bg-[#0F2C59] px-3.5 py-1.5 rounded-full"
                    >
                      <Ionicons name="qr-code-outline" size={14} color="white" className="mr-1.5" />
                      <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                        View Pass
                      </Typography>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => openComplaintModalForSub(sub)}
                      className="flex-row items-center bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200"
                    >
                      <Ionicons name="alert-circle-outline" size={14} color="#64748B" className="mr-1" />
                      <Typography variant="caption" color="secondary" weight="semibold" className="font-outfit text-xs">
                        Report Issue
                      </Typography>
                    </TouchableOpacity>

                    {isRefunded && (
                      <TouchableOpacity
                        onPress={() => setActiveTab('refunds')}
                        className="flex-row items-center bg-amber-50 px-2.5 py-1.5 rounded-full border border-amber-200"
                      >
                        <Ionicons name="cash-outline" size={13} color="#D97706" className="mr-1" />
                        <Typography variant="caption" className="text-amber-700 font-outfit-bold text-[11px]">
                          Refund
                        </Typography>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MY COMPLAINTS & ISSUES                                             */}
      {/* ========================================================================= */}
      {activeTab === 'complaints' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 60, 80) }}
        >
          {/* Header Action Bar */}
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold text-base">
                Reported Issues ({complaintsList.length})
              </Typography>
              <Typography variant="caption" color="muted" className="font-outfit text-xs">
                Track status and feedback for reported sessions
              </Typography>
            </View>

            {subscriptionsList.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  if (subscriptionsList.length === 1) {
                    openComplaintModalForSub(subscriptionsList[0]);
                  } else {
                    setActiveTab('subscriptions');
                    Alert.alert(
                      'Report Program Issue',
                      'Please tap "Report Issue" on the subscription pass for the specific coaching program.'
                    );
                  }
                }}
                className="flex-row items-center bg-[#0F2C59] px-3.5 py-2 rounded-full active:opacity-80"
              >
                <Ionicons name="add" size={16} color="white" className="mr-1" />
                <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                  Report Issue
                </Typography>
              </TouchableOpacity>
            )}
          </View>

          {isLoadingComplaints || isRefetchingComplaints ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#FF5100" />
              <Typography variant="body2" color="muted" className="mt-2 font-outfit">
                Loading complaints...
              </Typography>
            </View>
          ) : complaintsList.length === 0 ? (
            <View className="bg-white rounded-3xl p-8 items-center border border-gray-100 shadow-sm my-4">
              <Ionicons name="shield-checkmark-outline" size={48} color="#047857" className="mb-3" />
              <Typography variant="h3" color="secondary" weight="bold" align="center" className="mb-2 font-outfit-bold">
                No Complaints Logged
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="font-outfit mb-5">
                Any issues reported regarding missed coach attendance or program disruptions will be tracked here.
              </Typography>

              {subscriptionsList.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    if (subscriptionsList.length === 1) {
                      openComplaintModalForSub(subscriptionsList[0]);
                    } else {
                      setActiveTab('subscriptions');
                    }
                  }}
                  className="bg-primary px-5 py-3 rounded-2xl flex-row items-center active:opacity-80 shadow-xs"
                >
                  <Ionicons name="alert-circle-outline" size={18} color="white" className="mr-2" />
                  <Typography variant="body2" color="white" weight="bold" className="font-outfit-bold">
                    Report Issue on a Subscription
                  </Typography>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setActiveTab('explore')}
                  className="bg-[#0F2C59] px-5 py-3 rounded-2xl flex-row items-center active:opacity-80 shadow-xs"
                >
                  <Ionicons name="compass-outline" size={18} color="white" className="mr-2" />
                  <Typography variant="body2" color="white" weight="bold" className="font-outfit-bold">
                    Explore Academies
                  </Typography>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            complaintsList.map((comp: any) => {
              const compId = comp._id || comp.id;
              const status = comp.status || 'OPEN';

              return (
                <View key={compId} className="bg-white rounded-3xl p-5 mb-4 border border-gray-100 shadow-sm">
                  <View className="flex-row items-center justify-between mb-2">
                    <View className="bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs">
                        {comp.type || 'COACH_ABSENCE'}
                      </Typography>
                    </View>

                    <View className={`px-2.5 py-0.5 rounded-full border ${
                      status === 'RESOLVED' 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : status === 'MANUAL_REVIEW' 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <Typography variant="caption" weight="bold" className={`text-xs font-outfit-bold ${
                        status === 'RESOLVED' 
                          ? 'text-emerald-700' 
                          : status === 'MANUAL_REVIEW' 
                          ? 'text-amber-700' 
                          : 'text-blue-700'
                      }`}>
                        {status}
                      </Typography>
                    </View>
                  </View>

                  <Typography variant="caption" color="muted" className="font-outfit text-xs mb-2">
                    Session Date: {formatDateOnly(comp.sessionDate)}
                  </Typography>

                  <Typography variant="body2" color="secondary" className="font-outfit leading-5 mb-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    "{comp.reason}"
                  </Typography>

                  {/* Decision History */}
                  {Array.isArray(comp.decisionHistory) && comp.decisionHistory.length > 0 && (
                    <View className="pt-2 border-t border-gray-100">
                      <Typography variant="caption" color="muted" weight="bold" className="font-outfit-bold text-[11px] mb-1">
                        Admin Review Notes:
                      </Typography>
                      {comp.decisionHistory.map((d: any, i: number) => (
                        <Typography key={i} variant="caption" color="secondary" className="font-outfit text-xs leading-4">
                          • {d.reason || d.note || 'Review updated'}
                        </Typography>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: REFUND TRACKING                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'refunds' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1 px-4 pt-4"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 60, 80) }}
        >
          {isLoadingRefunds || isRefetchingRefunds ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#FF5100" />
              <Typography variant="body2" color="muted" className="mt-2 font-outfit">
                Loading refund cases...
              </Typography>
            </View>
          ) : refundsList.length === 0 ? (
            <View className="bg-white rounded-3xl p-8 items-center border border-gray-100 shadow-sm my-4">
              <Ionicons name="wallet-outline" size={40} color="#047857" className="mb-3" />
              <Typography variant="h3" color="secondary" weight="bold" align="center" className="mb-2 font-outfit-bold">
                No Subscription Refunds
              </Typography>
              <Typography variant="body2" color="muted" align="center" className="font-outfit">
                Automatic pro-rata refunds for cancelled community batches will appear here.
              </Typography>
            </View>
          ) : (
            refundsList.map((refItem: any) => {
              const refId = refItem._id || refItem.id;
              const amountINR = refItem.amountPaise ? (refItem.amountPaise / 100).toFixed(2) : (refItem.amount || 0);
              const originalINR = refItem.originalAmountPaise ? (refItem.originalAmountPaise / 100).toFixed(2) : (refItem.originalAmount || 0);
              const status = refItem.status || 'REQUESTED';

              return (
                <View key={refId} className="bg-white rounded-3xl p-5 mb-4 border border-gray-100 shadow-sm">
                  <View className="flex-row items-center justify-between mb-2">
                    <Typography variant="h3" color="primary" weight="bold" className="font-outfit-bold text-lg">
                      ₹{amountINR}
                    </Typography>

                    <View className={`px-2.5 py-0.5 rounded-full border ${
                      status === 'COMPLETED' 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : status === 'FAILED' 
                        ? 'bg-rose-50 border-rose-200' 
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                      <Typography variant="caption" weight="bold" className={`text-xs font-outfit-bold ${
                        status === 'COMPLETED' 
                          ? 'text-emerald-700' 
                          : status === 'FAILED' 
                          ? 'text-rose-700' 
                          : 'text-amber-700'
                      }`}>
                        {status}
                      </Typography>
                    </View>
                  </View>

                  <Typography variant="caption" color="muted" className="font-outfit text-xs mb-2">
                    Original Price: ₹{originalINR} • Case ID: {refId.slice(-8)}
                  </Typography>

                  {refItem.calculationEvidence && (
                    <View className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-2">
                      <Typography variant="caption" color="secondary" className="font-outfit text-xs">
                        Unused sessions refunded as per approved cancellation policy.
                      </Typography>
                    </View>
                  )}

                  {refItem.providerRefundId && (
                    <Typography variant="caption" color="muted" className="font-outfit text-[11px]">
                      Provider Reference: {refItem.providerRefundId}
                    </Typography>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: COMMUNITY DETAILS & PROGRAMS VIEW                                */}
      {/* ========================================================================= */}
      <Modal
        visible={!!selectedCommunityId}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCommunityId(null)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setSelectedCommunityId(null)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200 max-h-[90%]"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-xl">
                Academy & Programs
              </Typography>
              <TouchableOpacity onPress={() => setSelectedCommunityId(null)} className="p-1">
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {isLoadingDetail ? (
              <View className="py-12 items-center">
                <ActivityIndicator size="large" color="#FF5100" />
                <Typography variant="body2" color="muted" className="mt-2 font-outfit">
                  Loading academy programs...
                </Typography>
              </View>
            ) : communityDetail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Academy Info Header */}
                <View className="mb-4 bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100">
                  <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold text-lg mb-1">
                    {communityDetail.name}
                  </Typography>
                  <Typography variant="caption" color="muted" className="font-outfit leading-4 mb-2">
                    {communityDetail.address}, {communityDetail.city}
                  </Typography>
                  <Typography variant="caption" color="primary" weight="semibold" className="font-outfit text-xs">
                    Timezone: {communityDetail.timeZone || 'Asia/Kolkata'}
                  </Typography>
                </View>

                {/* Available Programs */}
                <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold mb-3">
                  Training Batches ({communityDetail.programs?.length ?? 0})
                </Typography>

                {(!communityDetail.programs || communityDetail.programs.length === 0) ? (
                  <View className="p-6 bg-gray-50 rounded-2xl items-center border border-gray-200">
                    <Typography variant="body2" color="muted" align="center" className="font-outfit">
                      No active coaching batches currently available in this academy.
                    </Typography>
                  </View>
                ) : (
                  communityDetail.programs.map((prog: CommunityProgram) => {
                    const activePlans = (prog.plans || []).filter(p => p.isActive !== false);
                    const occupied = prog.activeSubscribers ?? 0;
                    const spotsLeft = Math.max(prog.capacity - occupied, 0);

                    return (
                      <View 
                        key={prog._id} 
                        className="bg-white rounded-2xl p-4 mb-4 border border-gray-200 shadow-xs"
                      >
                        {/* Program Header */}
                        <View className="flex-row items-center justify-between mb-2">
                          <View className="flex-1 mr-2">
                            <View className="flex-row items-center mb-1">
                              <View className="bg-primary/10 px-2.5 py-0.5 rounded-full mr-2">
                                <Typography variant="caption" color="primary" weight="bold" className="text-[10px]">
                                  {prog.sport}
                                </Typography>
                              </View>
                              <Typography variant="caption" color="muted" className="text-xs font-outfit">
                                {occupied} / {prog.capacity} Enrolled ({spotsLeft} spots left)
                              </Typography>
                            </View>
                            <Typography variant="subtitle1" color="secondary" weight="bold" className="font-outfit-bold text-base">
                              {prog.title}
                            </Typography>
                          </View>
                        </View>

                        {/* Schedule & Timing */}
                        <View className="bg-slate-50 p-2.5 rounded-xl mb-3 border border-slate-100">
                          <View className="flex-row items-center mb-1">
                            <Ionicons name="calendar-outline" size={13} color="#64748B" className="mr-1.5" />
                            <Typography variant="caption" color="secondary" weight="semibold" className="font-outfit-semibold text-xs">
                              {formatWeekdays(prog.sessionDays)}
                            </Typography>
                          </View>
                          <View className="flex-row items-center">
                            <Ionicons name="time-outline" size={13} color="#64748B" className="mr-1.5" />
                            <Typography variant="caption" color="muted" className="font-outfit text-xs">
                              {formatTimeHHmm(prog.sessionStartTime)} - {formatTimeHHmm(prog.sessionEndTime)} ({communityDetail.timeZone || 'Asia/Kolkata'})
                            </Typography>
                          </View>
                        </View>

                        {/* Assigned Coaches */}
                        {Array.isArray(prog.coaches) && prog.coaches.length > 0 && (
                          <View className="flex-row items-center mb-3">
                            <Ionicons name="ribbon-outline" size={14} color="#047857" className="mr-1.5" />
                            <Typography variant="caption" className="text-[#047857] font-outfit-bold text-xs">
                              Coach: {prog.coaches.map((c: any) => c.coachId?.name || 'Assigned Coach').join(', ')}
                            </Typography>
                          </View>
                        )}

                        {/* Subscription Plans */}
                        <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs mb-2">
                          Select Subscription Plan:
                        </Typography>

                        <View className="flex-row flex-wrap gap-2 mb-3">
                          {activePlans.map((plan: CommunityPlan) => {
                            const isSelected = selectedProgram?._id === prog._id && selectedPlanIndex === plan.planIndex;

                            return (
                              <TouchableOpacity
                                key={plan.planIndex}
                                onPress={() => {
                                  setSelectedProgram(prog);
                                  setSelectedPlanIndex(plan.planIndex);
                                }}
                                className={`px-3 py-2 rounded-xl border flex-1 min-w-[100px] items-center ${
                                  isSelected 
                                    ? 'bg-[#0F2C59] border-[#0F2C59]' 
                                    : 'bg-white border-gray-200'
                                }`}
                              >
                                <Typography variant="caption" color={isSelected ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-xs">
                                  {plan.label || `${plan.duration} ${plan.unit}`}
                                </Typography>
                                <Typography variant="caption" color={isSelected ? 'primary' : 'primary'} weight="bold" className="font-outfit-bold text-sm mt-0.5">
                                  ₹{plan.price}
                                </Typography>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {/* Subscribe Button */}
                        <Button
                          title={selectedProgram?._id === prog._id && selectedPlanIndex !== null ? "Proceed to Subscribe" : "Select a Plan Above"}
                          disabled={selectedProgram?._id !== prog._id || selectedPlanIndex === null}
                          onPress={() => setIsCheckoutModalVisible(true)}
                          className="mt-1"
                        />
                      </View>
                    );
                  })
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: CHECKOUT & PARTICIPANT SELECTION SHEET                           */}
      {/* ========================================================================= */}
      <Modal
        visible={isCheckoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCheckoutModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/60 justify-end"
        >
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setIsCheckoutModalVisible(false)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-xl">
                Confirm Subscription
              </Typography>
              <TouchableOpacity onPress={() => setIsCheckoutModalVisible(false)} className="p-1">
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {selectedProgram && selectedPlanIndex !== null && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Summary Box */}
                <View className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-200">
                  <Typography variant="h3" color="secondary" weight="bold" className="font-outfit-bold text-base mb-1">
                    {selectedProgram.title}
                  </Typography>
                  <Typography variant="caption" color="muted" className="font-outfit text-xs mb-2">
                    {communityDetail?.name} • {selectedProgram.sport}
                  </Typography>

                  <View className="pt-2 border-t border-gray-200 flex-row justify-between items-center">
                    <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">
                      Selected Plan: {selectedProgram.plans?.[selectedPlanIndex]?.label || 'Standard'}
                    </Typography>
                    <Typography variant="subtitle1" color="primary" weight="bold" className="font-outfit-bold text-lg">
                      ₹{selectedProgram.plans?.[selectedPlanIndex]?.price}
                    </Typography>
                  </View>
                </View>

                {/* PARENT SPECIFIC: CHILD SELECTOR */}
                {isParent ? (
                  <View className="mb-4">
                    <View className="flex-row justify-between items-center mb-2">
                      <Typography variant="subtitle2" color="secondary" weight="bold" className="font-outfit-bold">
                        Select Participant Child:
                      </Typography>
                      <TouchableOpacity 
                        onPress={() => setIsAddChildModalVisible(true)}
                        className="flex-row items-center"
                      >
                        <Ionicons name="add-circle-outline" size={16} color="#FF5100" className="mr-1" />
                        <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs">
                          Add Child
                        </Typography>
                      </TouchableOpacity>
                    </View>

                    {childrenList.length === 0 ? (
                      <View className="bg-orange-50 border border-orange-200 p-3 rounded-2xl mb-2 items-center">
                        <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs mb-1">
                          No child profiles found
                        </Typography>
                        <Typography variant="caption" color="muted" align="center" className="font-outfit text-xs mb-2">
                          Parents must link their participating child before checkout.
                        </Typography>
                        <Button 
                          title="Register Child Now" 
                          onPress={() => setIsAddChildModalVisible(true)}
                          fullWidth={false}
                          className="px-4 py-1.5"
                        />
                      </View>
                    ) : (
                      <View className="space-y-2">
                        {childrenList.map((ch: UserChild) => (
                          <TouchableOpacity
                            key={ch._id}
                            onPress={() => setSelectedChildId(ch._id)}
                            className={`p-3 rounded-2xl border flex-row items-center justify-between mb-2 ${
                              selectedChildId === ch._id 
                                ? 'bg-[#0F2C59] border-[#0F2C59]' 
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <View className="flex-row items-center">
                              <Ionicons 
                                name="person-circle-outline" 
                                size={22} 
                                color={selectedChildId === ch._id ? 'white' : '#64748B'} 
                                className="mr-2"
                              />
                              <View>
                                <Typography variant="caption" color={selectedChildId === ch._id ? 'white' : 'secondary'} weight="bold" className="font-outfit-bold text-sm">
                                  {ch.name}
                                </Typography>
                                <Typography variant="caption" color={selectedChildId === ch._id ? 'white' : 'muted'} className="font-outfit text-xs">
                                  {ch.age ? `${ch.age} yrs` : 'Child'} • {ch.sport || 'Sports'}
                                </Typography>
                              </View>
                            </View>

                            {selectedChildId === ch._id && (
                              <Ionicons name="checkmark-circle" size={20} color="#FF5100" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  /* PLAYER PARTICIPANT INFO */
                  <View className="bg-blue-50/60 p-3 rounded-2xl border border-blue-100 mb-4 flex-row items-center">
                    <Ionicons name="information-circle" size={20} color="#0F2C59" className="mr-2" />
                    <Typography variant="caption" color="secondary" className="font-outfit text-xs flex-1">
                      Subscribing as <Typography weight="bold">{user?.name || 'Self'}</Typography>. Your subscription pass grants direct access to all scheduled sessions.
                    </Typography>
                  </View>
                )}

                {/* Terms Notice */}
                <Typography variant="caption" color="muted" className="font-outfit text-[11px] leading-4 mb-4">
                  Note: Subscriptions are access passes for all recurring batch sessions during the paid period. No separate daily session bookings are needed.
                </Typography>

                {/* Checkout CTA */}
                <Button
                  title="Proceed to Razorpay Payment"
                  isLoading={createOrderMutation.isPending}
                  disabled={createOrderMutation.isPending || (isParent && !selectedChildId)}
                  onPress={() => {
                    createOrderMutation.mutate({
                      programId: selectedProgram._id,
                      planIndex: selectedPlanIndex,
                      childId: isParent ? selectedChildId! : undefined
                    });
                  }}
                />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: QUICK ADD CHILD (FOR PARENTS)                                    */}
      {/* ========================================================================= */}
      <Modal
        visible={isAddChildModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddChildModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/60 justify-end"
        >
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setIsAddChildModalVisible(false)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-xl">
                Add Child Profile
              </Typography>
              <TouchableOpacity onPress={() => setIsAddChildModalVisible(false)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Child Full Name *"
              placeholderTextColor="#94A3B8"
              value={newChildName}
              onChangeText={setNewChildName}
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-outfit text-secondary text-sm mb-3"
            />

            <TextInput
              placeholder="Age (e.g. 12)"
              placeholderTextColor="#94A3B8"
              value={newChildAge}
              onChangeText={setNewChildAge}
              keyboardType="numeric"
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-outfit text-secondary text-sm mb-3"
            />

            <TextInput
              placeholder="Sport (e.g. Badminton)"
              placeholderTextColor="#94A3B8"
              value={newChildSport}
              onChangeText={setNewChildSport}
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-outfit text-secondary text-sm mb-3"
            />

            <TextInput
              placeholder="School Name (Optional)"
              placeholderTextColor="#94A3B8"
              value={newChildSchool}
              onChangeText={setNewChildSchool}
              className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-outfit text-secondary text-sm mb-4"
            />

            <Button
              title="Save Child Profile"
              isLoading={addChildMutation.isPending}
              disabled={!newChildName.trim() || addChildMutation.isPending}
              onPress={() => {
                addChildMutation.mutate({
                  name: newChildName.trim(),
                  age: newChildAge ? parseInt(newChildAge, 10) : undefined,
                  sport: newChildSport.trim() || undefined,
                  school: newChildSchool.trim() || undefined
                });
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: RAZORPAY GATEWAY CHECKOUT MODAL                                  */}
      {/* ========================================================================= */}
      <Modal
        visible={isRazorpayModalVisible}
        animationType="slide"
        onRequestClose={() => {
          Alert.alert(
            'Cancel Payment?',
            'Are you sure you want to exit checkout? Uncompleted orders do not reserve spots.',
            [
              { text: 'Keep Paying', style: 'cancel' },
              { text: 'Exit', style: 'destructive', onPress: () => setIsRazorpayModalVisible(false) }
            ]
          );
        }}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="px-4 py-3 bg-[#0F2C59] flex-row items-center justify-between border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="shield-checkmark" size={20} color="#FF5100" className="mr-2" />
              <Typography variant="h3" color="white" weight="bold" className="font-outfit-bold text-base">
                Razorpay Secure Checkout
              </Typography>
            </View>
            <TouchableOpacity 
              onPress={() => setIsRazorpayModalVisible(false)}
              className="p-1"
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {razorpayOrder ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: generateRazorpayHtml() }}
              onMessage={handleRazorpayMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View className="absolute inset-0 items-center justify-center bg-gray-50 z-10">
                  <ActivityIndicator size="large" color="#FF5100" />
                  <Typography variant="body2" color="muted" className="mt-3 font-outfit">
                    Connecting to Razorpay...
                  </Typography>
                </View>
              )}
            />
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: SUCCESS ACTIVATED PASS MODAL                                     */}
      {/* ========================================================================= */}
      <Modal
        visible={!!activatedSubscription}
        transparent
        animationType="fade"
        onRequestClose={() => setActivatedSubscription(null)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm items-center shadow-2xl">
            <View className="w-16 h-16 rounded-full bg-emerald-100 items-center justify-center mb-4">
              <Ionicons name="checkmark-circle" size={44} color="#047857" />
            </View>

            <Typography variant="h2" color="secondary" weight="bold" align="center" className="font-outfit-bold text-xl mb-1">
              Subscription Active!
            </Typography>

            <Typography variant="body2" color="muted" align="center" className="font-outfit text-xs mb-4">
              Your community coaching access pass has been activated successfully.
            </Typography>

            {activatedSubscription?.invoice?.invoiceNumber && (
              <View className="bg-gray-50 px-3 py-2 rounded-xl mb-4 border border-gray-100 w-full items-center">
                <Typography variant="caption" color="muted" className="font-outfit text-[11px]">
                  Invoice Generated:
                </Typography>
                <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs">
                  {activatedSubscription.invoice.invoiceNumber}
                </Typography>
              </View>
            )}

            <Button
              title="View My Subscriptions"
              onPress={() => {
                setActivatedSubscription(null);
                setActiveTab('subscriptions');
              }}
              className="w-full"
            />
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 6: ACCESS PASS DETAIL MODAL                                         */}
      {/* ========================================================================= */}
      <Modal
        visible={!!viewingPass}
        transparent
        animationType="slide"
        onRequestClose={() => setViewingPass(null)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setViewingPass(null)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-xl">
                Community Access Pass
              </Typography>
              <TouchableOpacity onPress={() => setViewingPass(null)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {viewingPass && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Visual Pass Card */}
                <View className="bg-[#0F2C59] rounded-3xl p-5 mb-4 shadow-md relative overflow-hidden">
                  <View className="flex-row justify-between items-start mb-4">
                    <View>
                      <Typography variant="caption" color="white" className="opacity-80 text-[10px] uppercase font-outfit">
                        Official Access Pass
                      </Typography>
                      <Typography variant="h2" color="white" weight="bold" className="font-outfit-bold text-xl">
                        {viewingPass.participantName}
                      </Typography>
                    </View>
                    <Ionicons name="qr-code" size={32} color="#FF5100" />
                  </View>

                  <View className="mb-4">
                    <Typography variant="caption" color="white" className="opacity-80 text-xs font-outfit">
                      Batch / Program
                    </Typography>
                    <Typography variant="subtitle1" color="white" weight="bold" className="font-outfit-bold">
                      {viewingPass.programTitle || 'Coaching Program'}
                    </Typography>
                  </View>

                  <View className="pt-3 border-t border-white/20 flex-row justify-between">
                    <View>
                      <Typography variant="caption" color="white" className="opacity-80 text-[10px]">
                        Valid From
                      </Typography>
                      <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                        {formatDateOnly(viewingPass.plan?.startDate)}
                      </Typography>
                    </View>

                    <View>
                      <Typography variant="caption" color="white" className="opacity-80 text-[10px]">
                        Valid Until
                      </Typography>
                      <Typography variant="caption" color="white" weight="bold" className="font-outfit-bold text-xs">
                        {formatDateOnly(viewingPass.plan?.endDate)}
                      </Typography>
                    </View>

                    <View>
                      <Typography variant="caption" color="white" className="opacity-80 text-[10px]">
                        Pass Status
                      </Typography>
                      <Typography variant="caption" color="primary" weight="bold" className="font-outfit-bold text-xs">
                        {viewingPass.status?.toUpperCase()}
                      </Typography>
                    </View>
                  </View>
                </View>

                {/* Sub ID Details */}
                <Typography variant="caption" color="muted" align="center" className="font-outfit text-xs mb-4">
                  Pass ID: {viewingPass._id}
                </Typography>

                <Button title="Close" variant="white" onPress={() => setViewingPass(null)} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 7: REPORT PROGRAM COMPLAINT / ISSUE                                 */}
      {/* ========================================================================= */}
      <Modal
        visible={!!complaintSubscription}
        transparent
        animationType="slide"
        onRequestClose={() => setComplaintSubscription(null)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/60 justify-end"
        >
          <TouchableOpacity 
            className="flex-1" 
            activeOpacity={1} 
            onPress={() => setComplaintSubscription(null)} 
          />
          <View 
            className="bg-white rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl border-t border-gray-200"
            style={{ paddingBottom: Math.max(insets.bottom + 20, 32) }}
          >
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />

            <View className="flex-row justify-between items-center mb-4">
              <Typography variant="h2" color="secondary" weight="bold" className="font-outfit-bold text-xl">
                Report Program Issue
              </Typography>
              <TouchableOpacity onPress={() => setComplaintSubscription(null)}>
                <Ionicons name="close" size={24} color="#0F2C59" />
              </TouchableOpacity>
            </View>

            {complaintSubscription && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Typography variant="caption" color="muted" className="font-outfit text-xs mb-3">
                  Report a session issue for <Typography weight="bold">{complaintSubscription.programTitle || 'this program'}</Typography>.
                </Typography>

                {/* Issue Type Selector */}
                <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs mb-1.5">
                  Issue Type:
                </Typography>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {[
                    { id: 'COACH_ABSENCE', label: 'Coach Absence' },
                    { id: 'PROGRAM_NOT_CONDUCTED', label: 'Not Conducted' },
                    { id: 'REPEATED_MISSED_SESSIONS', label: 'Repeated Missed' },
                    { id: 'OTHER', label: 'Other Issue' }
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setComplaintType(item.id as any)}
                      className={`px-3 py-1.5 rounded-xl border ${
                        complaintType === item.id 
                          ? 'bg-primary border-primary' 
                          : 'bg-gray-100 border-gray-200'
                      }`}
                    >
                      <Typography variant="caption" color={complaintType === item.id ? 'white' : 'secondary'} weight="bold" className="font-outfit text-xs">
                        {item.label}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Session Date */}
                <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs mb-1.5">
                  Session Date (YYYY-MM-DD):
                </Typography>
                <TextInput
                  placeholder="2026-11-09"
                  placeholderTextColor="#94A3B8"
                  value={complaintSessionDate}
                  onChangeText={setComplaintSessionDate}
                  className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-outfit text-secondary text-sm mb-3"
                />

                {/* Reason description */}
                <Typography variant="caption" color="secondary" weight="bold" className="font-outfit-bold text-xs mb-1.5">
                  Detailed Reason:
                </Typography>
                <TextInput
                  placeholder="Describe the issue with the scheduled coaching session..."
                  placeholderTextColor="#94A3B8"
                  value={complaintReason}
                  onChangeText={setComplaintReason}
                  multiline
                  style={{ minHeight: 90, textAlignVertical: 'top' }}
                  className="bg-gray-50 border border-gray-200 rounded-2xl p-4 font-outfit text-secondary text-sm mb-4"
                />

                <Button
                  title="Submit Complaint"
                  isLoading={submitComplaintMutation.isPending}
                  disabled={!complaintReason.trim() || !complaintSessionDate.trim() || submitComplaintMutation.isPending}
                  onPress={() => {
                    const targetSubId = complaintSubscription._id || (complaintSubscription as any).id;
                    submitComplaintMutation.mutate({
                      subscriptionId: targetSubId,
                      payload: {
                        sessionDate: complaintSessionDate.trim(),
                        type: complaintType,
                        reason: complaintReason.trim()
                      }
                    });
                  }}
                />
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
