import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Button, TextInput } from '@/components/ui';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAuthStore } from '@/store';

interface Transaction {
  id: string;
  type: 'payout' | 'withdrawal';
  title: string;
  subtitle: string;
  date: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed' | 'processing' | 'approved' | 'rejected';
  reason?: string;
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [withdrawTab, setWithdrawTab] = useState<'upi' | 'bank'>('upi');
  const [activityTab, setActivityTab] = useState<'all' | 'transactions' | 'withdrawals'>('all');

  // Strict Role Guard: Players and Parents cannot access coach wallet
  useEffect(() => {
    if (user && user.role !== 'coach') {
      Alert.alert(
        'Access Denied (Role Boundary)',
        'Coach Wallet is strictly reserved for registered coaching partners.'
      );
      const target = user.role === 'parent'
        ? '/(parent)/(parent-tabs)/parent-dashboard'
        : '/(individual)/(individual-tabs)/individual-dashboard';
      router.replace(target as any);
    }
  }, [user, router]);
  
  // Withdrawal Form States
  const [amount, setAmount] = useState('');
  const [upiId, setUpiId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 1. GET /api/wallet/summary - Fetch Coach Wallet Summary
  const { data: summaryResponse, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['walletSummary'],
    queryFn: async () => {
      const res = await api.get('/wallet/summary');
      return res.data;
    }
  });

  const summaryData = summaryResponse?.data || summaryResponse?.summary || summaryResponse || {};
  const availableBalance = Number(
    summaryData?.availableBalance ?? 
    summaryData?.currentBalance ?? 
    summaryData?.balance ?? 
    summaryData?.walletBalance ?? 
    0
  );
  const pendingBalance = Number(
    summaryData?.pendingBalance ?? 
    summaryData?.heldBalance ?? 
    summaryData?.escrowBalance ?? 
    0
  );
  const totalEarnings = Number(
    summaryData?.totalEarnings ?? 
    summaryData?.earnings ?? 
    summaryData?.lifetimeEarnings ?? 
    (availableBalance + pendingBalance)
  );
  const totalWithdrawn = Number(
    summaryData?.totalWithdrawn ?? 
    summaryData?.withdrawn ?? 
    0
  );
  const minWithdrawal = Number(summaryData?.minWithdrawal ?? summaryData?.minWithdrawalAmount ?? 100);
  const maxWithdrawal = Number(summaryData?.maxWithdrawal ?? summaryData?.maxWithdrawalAmount ?? 50000);

  // 2. GET /api/wallet/transactions - Fetch Wallet Transactions
  const { data: transactionsResponse, isLoading: isTransactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['walletTransactions'],
    queryFn: async () => {
      const res = await api.get('/wallet/transactions');
      return res.data;
    }
  });

  // 3. GET /api/wallet/withdrawals - Fetch Payout/Withdrawal History
  const { data: withdrawalsResponse, isLoading: isWithdrawalsLoading, refetch: refetchWithdrawals } = useQuery({
    queryKey: ['walletWithdrawals'],
    queryFn: async () => {
      const res = await api.get('/wallet/withdrawals');
      return res.data;
    }
  });

  // Auto-refetch all wallet queries when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refetchSummary();
      refetchTransactions();
      refetchWithdrawals();
    });
    return unsubscribe;
  }, [navigation, refetchSummary, refetchTransactions, refetchWithdrawals]);

  const rawTxList = Array.isArray(transactionsResponse?.data) 
    ? transactionsResponse.data 
    : (Array.isArray(transactionsResponse?.transactions) 
      ? transactionsResponse.transactions 
      : (Array.isArray(transactionsResponse) ? transactionsResponse : []));

  const rawWithdrawalsList = Array.isArray(withdrawalsResponse?.data) 
    ? withdrawalsResponse.data 
    : (Array.isArray(withdrawalsResponse?.withdrawals) 
      ? withdrawalsResponse.withdrawals 
      : (Array.isArray(withdrawalsResponse) ? withdrawalsResponse : []));

  const formatTxDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const mappedTx: Transaction[] = rawTxList.map((tx: any) => {
    const isCredit = tx.type === 'booking_credit' || tx.type === 'refund' || tx.type === 'credit' || tx.type === 'session_earning' || tx.amount > 0;
    let title = 'Session Earnings';
    if (tx.type === 'booking_credit' || tx.type === 'session_earning') title = 'Session Earnings';
    else if (tx.type === 'withdrawal' || tx.type === 'payout') title = 'Withdrawal Payout';
    else if (tx.type === 'refund') title = 'Session Refund';
    else if (tx.type === 'admin_adjustment') title = 'Admin Adjustment';
    else if (tx.title) title = tx.title;
    else if (tx.description) title = tx.description;

    return {
      id: tx._id || tx.id || Math.random().toString(),
      type: isCredit ? 'payout' : 'withdrawal',
      title,
      subtitle: tx.description || tx.note || (isCredit ? 'Credit added to wallet' : 'Transferred to account'),
      date: formatTxDate(tx.createdAt || tx.date),
      amount: Math.abs(tx.amount || 0),
      status: tx.status || 'completed'
    };
  });

  const mappedWithdrawals: Transaction[] = rawWithdrawalsList.map((w: any) => {
    return {
      id: w._id || w.id || Math.random().toString(),
      type: 'withdrawal',
      title: 'Withdrawal Request',
      subtitle: w.upiId ? `UPI: ${w.upiId}` : (w.bankAccount ? `Bank Account ending in ${w.bankAccount.slice(-4)}` : 'Bank Transfer'),
      date: formatTxDate(w.createdAt || w.date),
      amount: -Math.abs(w.amount || 0),
      status: w.status || 'pending',
      reason: w.reason || w.rejectionReason || w.adminNote
    };
  });

  const combinedMap = new Map<string, Transaction>();
  mappedTx.forEach(t => combinedMap.set(t.id, t));
  mappedWithdrawals.forEach(w => {
    const existing = combinedMap.get(w.id);
    if (!existing) {
      combinedMap.set(w.id, w);
    } else {
      combinedMap.set(w.id, { ...existing, status: w.status, reason: w.reason || existing.reason });
    }
  });

  const allActivityList = Array.from(combinedMap.values()).sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const displayedList = activityTab === 'all' 
    ? allActivityList 
    : activityTab === 'transactions' 
      ? mappedTx 
      : mappedWithdrawals;

  // 4. POST /api/wallet/withdraw - Request Withdrawal
  const requestWithdrawalMutation = useMutation({
    mutationFn: async (withdrawAmount: number) => {
      try {
        const payload: any = { amount: withdrawAmount };
        if (withdrawTab === 'upi' && upiId.trim()) {
          payload.upiId = upiId.trim();
        } else if (withdrawTab === 'bank' && accountNumber.trim()) {
          payload.bankAccount = accountNumber.trim();
          payload.ifsc = ifscCode.trim();
          payload.accountName = accountName.trim();
        }
        const res = await api.post('/wallet/withdraw', payload);
        return res.data;
      } catch (err: any) {
        // If server validator rejects extra fields, retry with strict { amount } payload as defined in Swagger
        if (err?.response?.status === 400) {
          const errMsg = err?.response?.data?.message || '';
          if (errMsg.includes('allowed') || errMsg.includes('extra') || errMsg.includes('property')) {
            const res2 = await api.post('/wallet/withdraw', { amount: withdrawAmount });
            return res2.data;
          }
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['walletSummary'] });
      queryClient.invalidateQueries({ queryKey: ['walletTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['walletWithdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['coachDashboard'] });
      setSubmitError(null);
      setAmount('');

      const msg = data?.message || `Your withdrawal request of ₹${amount} was successfully submitted to the server.`;
      Alert.alert(
        'Payout Requested',
        msg,
        [{ text: 'OK', onPress: () => {
          refetchSummary();
          refetchTransactions();
          refetchWithdrawals();
        }}]
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to request withdrawal. Try again.';
      setSubmitError(msg);
      Alert.alert('Withdrawal Request Failed', msg);
    }
  });

  const handleWithdrawal = () => {
    setSubmitError(null);
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setSubmitError('Please enter a valid withdrawal amount.');
      return;
    }
    if (withdrawAmount > availableBalance) {
      setSubmitError(`Withdrawal amount exceeds your available balance (₹${availableBalance}).`);
      return;
    }
    if (withdrawAmount < minWithdrawal) {
      setSubmitError(`Minimum withdrawal amount is ₹${minWithdrawal}.`);
      return;
    }

    if (withdrawTab === 'upi') {
      if (!upiId || !upiId.includes('@')) {
        setSubmitError('Please enter a valid UPI ID (e.g. coachname@upi).');
        return;
      }
    } else {
      if (!accountName || !accountNumber || !confirmAccountNumber || !ifscCode) {
        setSubmitError('Please fill in all bank details.');
        return;
      }
      if (accountNumber !== confirmAccountNumber) {
        setSubmitError('Account number and confirmation do not match.');
        return;
      }
    }

    requestWithdrawalMutation.mutate(withdrawAmount);
  };

  const isPageLoading = isSummaryLoading || isTransactionsLoading || isWithdrawalsLoading;

  return (
    <SafeAreaView className="flex-1 bg-[#EEF3F9]">
      {/* Header */}
      <View className="px-4 py-4 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#0F2C59" />
        </TouchableOpacity>
        <Typography variant="h2" color="secondary" weight="bold">
          My Wallet
        </Typography>
        <TouchableOpacity 
          onPress={() => {
            refetchSummary();
            refetchTransactions();
            refetchWithdrawals();
          }} 
          className="p-2 -mr-2"
        >
          <Ionicons name="refresh" size={22} color="#0F2C59" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {isPageLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#FF5100" />
            <Typography variant="body2" color="muted" className="mt-2">Loading wallet details...</Typography>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="flex-1 px-4 pt-6" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom + 60, 80) }}>
            {/* Balance Cards Summary */}
            <View className="bg-white rounded-3xl p-5 mb-6 shadow-sm border border-gray-100">
              <View className="bg-[#EBF7F0] border border-[#D5EFE0] p-5 rounded-2xl mb-4 flex-row justify-between items-center">
                <View>
                  <Typography variant="caption" className="text-[#2b7a43] font-bold mb-1">Available to Withdraw</Typography>
                  <Typography variant="h1" className="text-[#1e582e] text-3xl font-bold">₹{availableBalance}</Typography>
                </View>
                <View className="w-12 h-12 rounded-full bg-[#D5EFE0] items-center justify-center">
                  <Ionicons name="wallet" size={24} color="#2b7a43" />
                </View>
              </View>

              <View className="flex-row justify-between gap-3">
                <View className="flex-1 bg-amber-50 border border-amber-100 p-3.5 rounded-xl">
                  <Typography variant="caption" color="secondary" weight="semibold" className="mb-0.5 text-amber-800 text-[10px]">Pending Balance (Held)</Typography>
                  <Typography variant="subtitle1" className="text-amber-900 font-bold">₹{pendingBalance}</Typography>
                </View>
                <View className="flex-1 bg-blue-50 border border-blue-100 p-3.5 rounded-xl">
                  <Typography variant="caption" color="secondary" weight="semibold" className="mb-0.5 text-blue-800 text-[10px]">Lifetime Earnings</Typography>
                  <Typography variant="subtitle1" className="text-blue-900 font-bold">₹{totalEarnings}</Typography>
                </View>
              </View>
            </View>

            {/* Withdrawal Form Section */}
            <Typography variant="h3" color="secondary" weight="bold" className="mb-4">
              Request Payout
            </Typography>

            <View className="bg-white rounded-3xl p-5 mb-6 shadow-sm border border-gray-100">
              {submitError && (
                <View className="mb-5 bg-red-50 border border-red-200 rounded-2xl p-4 flex-row items-start shadow-sm">
                  <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2.5 mt-0.5" />
                  <View className="flex-1">
                    <Typography variant="subtitle2" weight="bold" className="font-outfit-bold text-red-800">
                      Request Failed
                    </Typography>
                    <Typography variant="caption" className="font-outfit text-red-600 mt-0.5">
                      {submitError}
                    </Typography>
                  </View>
                  <TouchableOpacity onPress={() => setSubmitError(null)} className="p-1 -mr-1 -mt-1">
                    <Ionicons name="close" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Payment Method Selector Tabs */}
              <View className="flex-row bg-[#EEF3F9] rounded-full p-1 mb-6">
                <TouchableOpacity 
                  onPress={() => setWithdrawTab('upi')} 
                  className="flex-1 py-2.5 rounded-full items-center"
                  style={withdrawTab === 'upi' ? {
                    backgroundColor: '#FF5100',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.15,
                    shadowRadius: 2,
                    elevation: 2
                  } : {}}
                >
                  <Typography variant="subtitle2" color={withdrawTab === 'upi' ? 'white' : 'secondary'} weight="bold">UPI Transfer</Typography>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setWithdrawTab('bank')} 
                  className="flex-1 py-2.5 rounded-full items-center"
                  style={withdrawTab === 'bank' ? {
                    backgroundColor: '#FF5100',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.15,
                    shadowRadius: 2,
                    elevation: 2
                  } : {}}
                >
                  <Typography variant="subtitle2" color={withdrawTab === 'bank' ? 'white' : 'secondary'} weight="bold">Bank Account</Typography>
                </TouchableOpacity>
              </View>

            {/* Common Amount Input */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-1 ml-1">
                <Typography variant="caption" color="secondary" weight="bold">Withdrawal Amount (₹)</Typography>
                <Typography variant="caption" color="muted" className="text-[10px]">Min ₹{minWithdrawal} • Max ₹{availableBalance}</Typography>
              </View>
              <TextInput 
                placeholder="Enter amount to withdraw" 
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

              {withdrawTab === 'upi' ? (
                /* UPI Form */
                <View className="mb-6">
                  <Typography variant="caption" color="secondary" weight="bold" className="mb-1 ml-1">UPI ID (VPA)</Typography>
                  <TextInput 
                    placeholder="e.g. coachname@upi" 
                    value={upiId}
                    onChangeText={setUpiId}
                    autoCapitalize="none"
                  />
                </View>
              ) : (
                /* Bank Account Form */
                <View className="space-y-4 mb-6">
                  <View>
                    <Typography variant="caption" color="secondary" weight="bold" className="mb-1 ml-1">Account Holder Name</Typography>
                    <TextInput 
                      placeholder="Enter full name" 
                      value={accountName}
                      onChangeText={setAccountName}
                    />
                  </View>
                  <View>
                    <Typography variant="caption" color="secondary" weight="bold" className="mb-1 ml-1">Account Number</Typography>
                    <TextInput 
                      placeholder="Enter bank account number" 
                      keyboardType="number-pad"
                      value={accountNumber}
                      onChangeText={setAccountNumber}
                    />
                  </View>
                  <View>
                    <Typography variant="caption" color="secondary" weight="bold" className="mb-1 ml-1">Confirm Account Number</Typography>
                    <TextInput 
                      placeholder="Re-enter bank account number" 
                      keyboardType="number-pad"
                      value={confirmAccountNumber}
                      onChangeText={setConfirmAccountNumber}
                    />
                  </View>
                  <View>
                    <Typography variant="caption" color="secondary" weight="bold" className="mb-1 ml-1">IFSC Code</Typography>
                    <TextInput 
                      placeholder="e.g. SBIN0001234" 
                      value={ifscCode}
                      onChangeText={setIfscCode}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              )}

              {/* Withdrawal Action Button */}
              <Button 
                title="Request Payout" 
                isLoading={requestWithdrawalMutation.isPending}
                disabled={requestWithdrawalMutation.isPending || !amount}
                onPress={handleWithdrawal}
              />
            </View>

            {/* Wallet Activity Header & Filter Tabs */}
            <View className="flex-row justify-between items-center mb-3">
              <Typography variant="h3" color="secondary" weight="bold">
                Wallet Activity
              </Typography>
              <Typography variant="caption" color="muted">
                {displayedList.length} items
              </Typography>
            </View>

            <View className="flex-row bg-[#EEF3F9] rounded-2xl p-1 mb-4">
              <TouchableOpacity 
                onPress={() => setActivityTab('all')}
                className={`flex-1 py-2 rounded-xl items-center ${activityTab === 'all' ? 'bg-white shadow-xs' : 'bg-transparent'}`}
              >
                <Typography 
                  variant="caption" 
                  color={activityTab === 'all' ? 'secondary' : 'muted'} 
                  weight="bold"
                  className="font-outfit-bold text-xs"
                >
                  All Activity
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActivityTab('transactions')}
                className={`flex-1 py-2 rounded-xl items-center ${activityTab === 'transactions' ? 'bg-white shadow-xs' : 'bg-transparent'}`}
              >
                <Typography 
                  variant="caption" 
                  color={activityTab === 'transactions' ? 'secondary' : 'muted'} 
                  weight="bold"
                  className="font-outfit-bold text-xs"
                >
                  Earnings
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActivityTab('withdrawals')}
                className={`flex-1 py-2 rounded-xl items-center ${activityTab === 'withdrawals' ? 'bg-white shadow-xs' : 'bg-transparent'}`}
              >
                <Typography 
                  variant="caption" 
                  color={activityTab === 'withdrawals' ? 'secondary' : 'muted'} 
                  weight="bold"
                  className="font-outfit-bold text-xs"
                >
                  Withdrawals
                </Typography>
              </TouchableOpacity>
            </View>

            <View className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100 mb-8">
              {displayedList.length === 0 ? (
                <View className="p-8 items-center justify-center">
                  <Ionicons name="receipt-outline" size={32} color="#9CA3AF" className="mb-2" />
                  <Typography variant="body2" color="muted">
                    {activityTab === 'all' ? 'No transactions or withdrawals found.' : activityTab === 'transactions' ? 'No session earnings recorded yet.' : 'No withdrawal requests found.'}
                  </Typography>
                </View>
              ) : (
                displayedList.map((tx, index) => (
                  <View 
                    key={tx.id} 
                    className={`flex-row justify-between items-center p-4 ${index !== displayedList.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <View className="flex-row items-center flex-1 mr-3">
                      <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${tx.type === 'payout' ? 'bg-[#EBF7F0]' : 'bg-red-50'}`}>
                        <Ionicons 
                          name={tx.type === 'payout' ? 'arrow-down-outline' : 'arrow-up-outline'} 
                          size={18} 
                          color={tx.type === 'payout' ? '#2b7a43' : '#EF4444'} 
                        />
                      </View>
                      <View className="flex-1">
                        <Typography variant="subtitle2" color="secondary" weight="bold" className="mb-0.5">
                          {tx.title}
                        </Typography>
                        <Typography variant="caption" color="muted">
                          {tx.subtitle} • {tx.date}
                        </Typography>
                        {tx.reason && (
                          <Typography variant="caption" className="text-red-500 font-outfit text-[11px] mt-0.5">
                            Note: {tx.reason}
                          </Typography>
                        )}
                      </View>
                    </View>
                    <View className="items-end">
                      <Typography variant="body1" className={tx.type === 'payout' ? 'text-[#2b7a43] font-bold' : 'text-red-600 font-bold'} weight="bold">
                        {tx.type === 'payout' ? `+₹${tx.amount}` : `-₹${Math.abs(tx.amount)}`}
                      </Typography>
                      
                      {/* Status Indicator */}
                      <View className={`px-1.5 py-0.5 rounded-md mt-1 ${
                        tx.status === 'completed' || tx.status === 'approved' ? 'bg-green-100' : 
                        tx.status === 'processing' || tx.status === 'pending' ? 'bg-orange-100' : 'bg-red-100'
                      }`}>
                        <Typography variant="overline" className={`text-[8px] font-bold ${
                          tx.status === 'completed' || tx.status === 'approved' ? 'text-green-700' : 
                          tx.status === 'processing' || tx.status === 'pending' ? 'text-orange-700' : 'text-red-700'
                        }`}>
                          {tx.status}
                        </Typography>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
