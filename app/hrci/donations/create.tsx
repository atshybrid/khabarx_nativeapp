import { confirmDonation, createDonationOrder, getDonationOrderStatus } from '@/services/donations';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';



export default function CreateDonationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string; eventId?: string }>();
  const [amount, setAmount] = useState<string>(() => (params?.amount ? String(params.amount) : ''));
  const [donorName, setDonorName] = useState('');
  const [donorAddress, setDonorAddress] = useState('');
  const [donorMobile, setDonorMobile] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorPan, setDonorPan] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [eventId, setEventId] = useState<string>(() => (params?.eventId ? String(params.eventId) : ''));
  const [shareCode, setShareCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [providerOrderId, setProviderOrderId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const amtNum = useMemo(() => Number(amount || 0), [amount]);
  const panRequired = amtNum > 1000 && !isAnonymous;
  const canSubmit = useMemo(() => {
    if (!amtNum || amtNum <= 0) return false;
    if (!donorName.trim()) return false;
    if (!donorMobile.trim()) return false;
    if (panRequired && !donorPan.trim()) return false;
    return true;
  }, [amtNum, donorName, donorMobile, panRequired, donorPan]);

  const startDonation = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      // Create donation order
      const order = await createDonationOrder({
        eventId: eventId || undefined,
        amount: amtNum,
        donorName,
        donorAddress,
        donorMobile,
        donorEmail,
        donorPan: donorPan || undefined,
        isAnonymous,
        shareCode: shareCode || undefined,
      });

      setProviderOrderId(order.providerOrderId || null);

      // If provider is Razorpay, open checkout
      if (order.provider === 'razorpay' && order.providerOrderId && order.providerKeyId) {
        if (Platform.OS === 'web') {
          Alert.alert('Not supported on web', 'Payment is not supported in web builds. Please use the mobile app.');
          return;
        }
        // Ensure SDK exists
        let checkoutAPI: any;
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const RazorpayCheckout = require('react-native-razorpay');
          checkoutAPI = RazorpayCheckout.default || RazorpayCheckout;
        } catch {
          Alert.alert('Payment Setup Required', 'Razorpay is not available in this build. Please rebuild the development client.');
          return;
        }
        const amountPaise = Math.round(order.amount * 100);
        const options: any = {
          key: order.providerKeyId,
          order_id: order.providerOrderId,
          amount: amountPaise,
          name: 'HRCI Donation',
          description: eventId ? `Event: ${eventId}` : 'Direct Donation',
          theme: { color: '#FE0002' },
          prefill: { name: donorName, contact: donorMobile, email: donorEmail },
          retry: { enabled: true, max_count: 1 },
        };
        try {
          const result = await checkoutAPI.open(options);
          // On success
          if (result && result.razorpay_order_id && result.razorpay_payment_id && result.razorpay_signature) {
            await confirmDonation({
              orderId: order.orderId,
              status: 'SUCCESS',
              provider: 'razorpay',
              providerRef: result.razorpay_payment_id,
              razorpay_order_id: result.razorpay_order_id,
              razorpay_payment_id: result.razorpay_payment_id,
              razorpay_signature: result.razorpay_signature,
            });
          }
        } catch (err: any) {
          // Cancel or failure
          const msg = String(err?.description || err?.error || err?.message || '').toLowerCase();
          const isCancelled = err?.code === 0 || msg.includes('cancel');
          try {
            await confirmDonation({
              orderId: order.orderId,
              status: isCancelled ? 'CANCELLED' : 'FAILED',
              provider: 'razorpay',
              providerRef: err?.metadata?.payment_id || undefined,
              razorpay_order_id: order.providerOrderId || undefined,
              razorpay_payment_id: err?.metadata?.payment_id || undefined,
              razorpay_signature: undefined,
            });
          } catch {}
          if (!isCancelled) {
            Alert.alert('Payment Failed', 'Could not complete the payment. Please try again.');
          }
        }
      } else {
        Alert.alert('Unsupported Provider', 'This payment provider is not supported.');
      }

      // Check order status and try to extract receipt URLs
      try {
        const st = await getDonationOrderStatus(order.providerOrderId!);
        if (st?.receiptPdfUrl || st?.receiptHtmlUrl) {
          setReceiptUrl((st.receiptPdfUrl || st.receiptHtmlUrl) || null);
        }
      } catch {}

      Alert.alert('Donation Recorded', 'We will update your receipt once the payment is confirmed.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not start donation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const refreshStatus = async () => {
    if (!providerOrderId) return;
    try {
      const st = await getDonationOrderStatus(providerOrderId);
      if (st?.receiptPdfUrl || st?.receiptHtmlUrl) {
        setReceiptUrl((st.receiptPdfUrl || st.receiptHtmlUrl) || null);
        Alert.alert('Receipt Ready', 'Your receipt link is available below.');
      } else {
        Alert.alert('Pending', `Status: ${st?.status || 'PENDING'}`);
      }
    } catch (e: any) {
      Alert.alert('Status Error', e?.message || 'Could not fetch donation status.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.heading}>New Donation</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: 'height' })}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Field label="Amount (INR)">
            <TextInput keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="500" style={styles.input} />
          </Field>
          <Field label="Donor Name">
            <TextInput value={donorName} onChangeText={setDonorName} placeholder="Full name" style={styles.input} />
          </Field>
          <Field label="Mobile">
            <TextInput keyboardType="phone-pad" value={donorMobile} onChangeText={setDonorMobile} placeholder="10-digit mobile" style={styles.input} />
          </Field>
          <Field label="Email (optional)">
            <TextInput value={donorEmail} onChangeText={setDonorEmail} placeholder="email@example.com" style={styles.input} />
          </Field>
          <Field label="Address (optional)">
            <TextInput value={donorAddress} onChangeText={setDonorAddress} placeholder="Address" style={styles.input} />
          </Field>
          <Field label={`PAN ${panRequired ? '(required)' : '(optional)'}`}>
            <TextInput autoCapitalize="characters" maxLength={10} value={donorPan} onChangeText={setDonorPan} placeholder="ABCDE1234F" style={styles.input} />
          </Field>
          <Field label="Anonymous">
            <View style={styles.switchRow}>
              <Switch value={isAnonymous} onValueChange={setIsAnonymous} />
              <Text style={{ marginLeft: 8, color: '#374151' }}>Hide my name on public lists</Text>
            </View>
          </Field>
          <Field label="Event ID (optional)">
            <TextInput value={eventId} onChangeText={setEventId} placeholder="Event ID" style={styles.input} />
          </Field>
          <Field label="Share Code (optional)">
            <TextInput value={shareCode} onChangeText={setShareCode} placeholder="Referral / share code" style={styles.input} />
          </Field>

          <TouchableOpacity disabled={!canSubmit || submitting} onPress={startDonation} style={[styles.cta, (!canSubmit || submitting) && styles.ctaDisabled]}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Donate</Text>}
          </TouchableOpacity>

          {providerOrderId && (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>Payment Status</Text>
              <Text style={styles.statusSub}>Order: {providerOrderId}</Text>
              <View style={{ height: 8 }} />
              <TouchableOpacity onPress={refreshStatus} style={[styles.smallBtn]}>
                <Text style={styles.smallBtnText}>Refresh Status</Text>
              </TouchableOpacity>
              {receiptUrl ? (
                <TouchableOpacity onPress={() => Alert.alert('Receipt', 'Open this URL in browser:\n' + receiptUrl)} style={[styles.smallBtn, { backgroundColor: '#16a34a' }]}>
                  <Text style={styles.smallBtnText}>View Receipt</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ marginBottom: 6, color: '#333', fontWeight: '600' }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
  heading: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#e6e6ef', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  cta: { backgroundColor: '#1D0DA1', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontWeight: '700' },
  statusCard: { marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  statusTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  statusSub: { fontSize: 12, color: '#64748b' },
  smallBtn: { backgroundColor: '#1D0DA1', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  smallBtnText: { color: '#fff', fontWeight: '700' },
});
