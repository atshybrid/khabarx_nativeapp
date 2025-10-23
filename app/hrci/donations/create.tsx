import { confirmDonation, createDonationOrder } from '@/services/donations';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';



export default function CreateDonationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ amount?: string; eventId?: string; shareCode?: string }>();
  const [amount, setAmount] = useState<string>(() => (params?.amount ? String(params.amount) : ''));
  const [donorName, setDonorName] = useState('');
  const [donorAddress, setDonorAddress] = useState('');
  const [donorMobile, setDonorMobile] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorPan, setDonorPan] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  // Event donations: accept eventId from route params (hidden from UI)
  const lockedEventId = useMemo(() => (params?.eventId ? String(params.eventId) : undefined), [params?.eventId]);
  // Hide share code in UI; accept via params if provided
  const lockedShareCode = useMemo(() => (params?.shareCode ? String(params.shareCode) : undefined), [params?.shareCode]);
  const [submitting, setSubmitting] = useState(false);
  const [overlayStep, setOverlayStep] = useState<'idle' | 'creating' | 'paying' | 'confirming' | 'success'>('idle');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const amtNum = useMemo(() => Number(amount || 0), [amount]);
  // PAN mandatory for non-anonymous donations above ₹10,000
  const panRequired = amtNum > 10000 && !isAnonymous;
  const canSubmit = useMemo(() => {
    if (!amtNum || amtNum <= 0) return false;
    if (isAnonymous) {
      // For anonymous donations, only amount is required
      return true;
    }
    // For identified donations, require basic info
    if (!donorName.trim()) return false;
    if (!donorMobile.trim()) return false;
    if (panRequired && !donorPan.trim()) return false;
    return true;
  }, [amtNum, isAnonymous, donorName, donorMobile, panRequired, donorPan]);

  const startDonation = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setOverlayStep('creating');
    try {
      // Create donation order
      const order = await createDonationOrder({
        eventId: lockedEventId || undefined,
        amount: amtNum,
        donorName: isAnonymous ? '' : donorName,
        donorAddress: isAnonymous ? undefined : donorAddress,
        donorMobile: isAnonymous ? '' : donorMobile,
        donorEmail: isAnonymous ? undefined : donorEmail,
        donorPan: isAnonymous ? undefined : (donorPan || undefined),
        isAnonymous,
        shareCode: lockedShareCode || undefined,
      });

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
          description: lockedEventId ? `Event Donation` : 'Direct Donation',
          theme: { color: '#FE0002' },
          prefill: isAnonymous ? undefined : { name: donorName, contact: donorMobile, email: donorEmail },
          retry: { enabled: true, max_count: 1 },
        };
        try {
          setOverlayStep('paying');
          const result = await checkoutAPI.open(options);
          // On success
          if (result && result.razorpay_order_id && result.razorpay_payment_id && result.razorpay_signature) {
            setOverlayStep('confirming');
            await confirmDonation({
              orderId: order.orderId,
              status: 'SUCCESS',
              provider: 'razorpay',
              providerRef: result.razorpay_payment_id,
              razorpay_order_id: result.razorpay_order_id,
              razorpay_payment_id: result.razorpay_payment_id,
              razorpay_signature: result.razorpay_signature,
            });
            // Show success overlay with message (no manual refresh UI)
            const lines: string[] = ['Thank you for your donation.'];
            if (!isAnonymous) {
              if (donorMobile?.trim()) lines.push(`You will receive your 80G receipt on WhatsApp at ${donorMobile}.`);
              if (donorEmail?.trim()) lines.push(`A copy will also be emailed to ${donorEmail}.`);
              if (!donorMobile?.trim() && !donorEmail?.trim()) lines.push('Your 80G receipt will be available shortly.');
            } else {
              // Anonymous: simple thanks
              lines.push('Your 80G receipt will be sent to your provided contact if available.');
            }
            setSuccessMessage(lines.join('\n'));
            setOverlayStep('success');
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

      // No manual status UI or polling; success handled above. If provider not razorpay, just show recorded message.
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not start donation. Please try again.');
    } finally {
      setSubmitting(false);
      setOverlayStep('idle');
    }
  };

  // No manual status refresh; handled server-side via WhatsApp/Email notifications.

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
          <Field label="Donate Anonymously">
            <View style={[styles.switchRow, { alignItems: 'center', justifyContent: 'space-between' }]}> 
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: '#374151', fontWeight: '700' }}>Hide my name on public lists</Text>
                <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>Your personal details won’t be shown. Receipt will still be issued.</Text>
              </View>
              <Switch value={isAnonymous} onValueChange={setIsAnonymous} />
            </View>
          </Field>
          <Field label="Amount (INR)">
            <TextInput keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="500" style={styles.input} />
          </Field>
          {!isAnonymous && (
            <>
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
              <Field label={`PAN ${panRequired ? '(required for > ₹10,000)' : '(optional)'}`}>
                <TextInput autoCapitalize="characters" maxLength={10} value={donorPan} onChangeText={setDonorPan} placeholder="ABCDE1234F" style={styles.input} />
              </Field>
            </>
          )}
          {/* Share code hidden; if provided via params, it will be passed silently */}

          <TouchableOpacity disabled={!canSubmit || submitting} onPress={startDonation} style={[styles.cta, (!canSubmit || submitting) && styles.ctaDisabled]}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Donate</Text>}
          </TouchableOpacity>

          {/* No status/refresh UI post-payment; we show a success message and navigate back. */}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Processing overlay */}
      {overlayStep !== 'idle' && (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.overlayCard}>
            {overlayStep === 'success' ? (
              <>
                <LottieView source={require('@/assets/lotti/congratulation.json')} autoPlay loop={false} style={{ width: 140, height: 140 }} />
                {!!successMessage && <Text style={[styles.overlayTxt, styles.overlayMsg]}>{successMessage}</Text>}
                <TouchableOpacity
                  onPress={() => {
                    // If launched from an event (eventId present), go back to that page.
                    // Otherwise, ensure we land on the main donations list.
                    if (lockedEventId) {
                      router.back();
                    } else {
                      router.replace('/hrci/donations');
                    }
                  }}
                  style={[styles.smallBtn, { marginTop: 10 }] }
                >
                  <Text style={styles.smallBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <LottieView source={require('@/assets/lotti/donate.json')} autoPlay loop style={{ width: 120, height: 120 }} />
                <Text style={styles.overlayTxt}>
                  {overlayStep === 'creating' && 'Creating donation...'}
                  {overlayStep === 'paying' && 'Opening payment...'}
                  {overlayStep === 'confirming' && 'Confirming payment...'}
                </Text>
              </>
            )}
          </View>
        </View>
      )}
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
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  overlayCard: { width: 220, alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 12, borderWidth: 1, borderColor: '#eef0f4' },
  overlayTxt: { color: '#111827', fontWeight: '800' },
  overlayMsg: { textAlign: 'center', marginTop: 6 },
});
