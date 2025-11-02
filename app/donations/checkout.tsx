import { Colors } from '@/constants/Colors';
import { confirmDonation, createDonationOrder } from '@/services/hrciDonations';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PublicDonationCheckout() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ amount?: string; eventId?: string }>();
  const [amount, setAmount] = useState<string>(() => (params?.amount ? String(params.amount) : ''));
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pan, setPan] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const amtNum = useMemo(() => Number(amount || 0), [amount]);
  const canPay = useMemo(() => amtNum > 0 && !submitting, [amtNum, submitting]);
  const requiresDetails = useMemo(() => amtNum > 10000, [amtNum]);
  const showDonorFields = useMemo(() => !isAnonymous || requiresDetails, [isAnonymous, requiresDetails]);

  // Ensure only the native header shows (no in-page header) and set correct title
  useLayoutEffect(() => {
    // Set the stack header title to "Donate" and hide the back title text
    navigation.setOptions?.({
      headerTitle: 'Donate',
      headerBackTitleVisible: false,
    } as any);
  }, [navigation]);

  const startPayment = async () => {
    if (!canPay) return;
    setSubmitting(true);
    try {
      // Validation: if above 10,000 require details and disallow anonymous
      if (requiresDetails) {
        if (isAnonymous) {
          Alert.alert('Details Required', 'Donations above ₹10,000 require your name, 10-digit mobile number, and PAN. Anonymous donations are not allowed.');
          return;
        }
        const mobileDigits = (mobile || '').replace(/\D/g, '');
        const panUpper = (pan || '').trim().toUpperCase();
        const panValid = /^[A-Z]{5}\d{4}[A-Z]$/.test(panUpper);
        if (!name?.trim()) {
          Alert.alert('Enter Name', 'Please enter your full name.');
          return;
        }
        if (mobileDigits.length !== 10) {
          Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number.');
          return;
        }
        if (!panValid) {
          Alert.alert('Invalid PAN', 'Please enter a valid PAN (e.g., ABCDE1234F).');
          return;
        }
      } else {
        // <= 10,000: if not anonymous, require name and 10-digit mobile; PAN optional
        if (!isAnonymous) {
          const mobileDigits = (mobile || '').replace(/\D/g, '');
          if (!name?.trim()) {
            Alert.alert('Enter Name', 'Please enter your full name.');
            return;
          }
          if (mobileDigits.length !== 10) {
            Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number.');
            return;
          }
        }
      }

      const order = await createDonationOrder({
        amount: amtNum,
        donorName: isAnonymous ? undefined : (name?.trim() || undefined),
        donorMobile: isAnonymous ? undefined : (mobile?.replace(/\D/g, '').slice(0,10) || undefined),
        donorEmail: isAnonymous ? undefined : (email?.trim() || undefined),
        donorAddress: isAnonymous ? undefined : (address?.trim() || undefined),
        donorPan: isAnonymous ? undefined : ((pan?.trim()?.toUpperCase()) || undefined),
        isAnonymous: requiresDetails ? false : (isAnonymous || undefined),
        eventId: params?.eventId ? String(params.eventId) : undefined,
      });
      const keyId = order.providerKeyId || String(process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '');
      if (!keyId) {
        Alert.alert('Payment Unavailable', 'Razorpay key is not configured.');
        return;
      }
      const options: any = {
        key: keyId,
        order_id: order.providerOrderId,
        currency: order.currency || 'INR',
        amount: Math.round(Number(order.amount || amtNum) * 100), // paise
        name: 'HRCI',
        description: 'Donation',
        prefill: {
          name: name || undefined,
          contact: mobile || undefined,
          email: email || undefined,
        },
        theme: { color: Colors.light.primary },
        retry: { enabled: true, max_count: 1 },
      };
      const result: any = await RazorpayCheckout.open(options);
      const paymentId = result?.razorpay_payment_id;
      const providerOrderId = result?.razorpay_order_id || order.providerOrderId;
      const signature = result?.razorpay_signature;

      if (paymentId && providerOrderId) {
        try {
          const confirm = await confirmDonation({
            orderId: order.orderId,
            status: 'SUCCESS',
            provider: 'razorpay',
            providerRef: 'razorpay',
            razorpay_order_id: providerOrderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
          });
          const htmlUrl = confirm?.data?.receipt?.verify?.htmlUrl;
          if (htmlUrl) {
            try {
              await WebBrowser.openBrowserAsync(htmlUrl);
              // After browser closes, return to main donations page
              router.replace('/donations');
            } catch {
              // Fallback to external browser
              Linking.openURL(htmlUrl).catch(() => {});
              router.replace('/donations');
            }
          }
        } catch {
          // If confirm fails, still show a friendly note
          Alert.alert('Payment Successful', 'If you were charged, your receipt will be available shortly.', [
            { text: 'OK', onPress: () => router.replace('/donations') },
          ]);
        }
      } else {
        Alert.alert('Payment Incomplete', 'Could not confirm payment. If you were charged, the receipt will be sent shortly.');
      }
    } catch (e: any) {
      const msg = String(e?.description || e?.message || '').toLowerCase();
      if (msg.includes('cancelled')) {
        // user cancelled
      } else {
        Alert.alert('Payment Failed', e?.description || e?.message || 'Could not start payment.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: 'height' })}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Field label="Amount (INR)">
            <TextInput keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="500" style={styles.input} />
          </Field>
          <Field label="Donate anonymously?">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#374151', fontWeight: '700' }}>Not interested to share donor details</Text>
              <Switch
                value={isAnonymous}
                onValueChange={(val) => {
                  if (amtNum <= 0) {
                    Alert.alert('Enter amount', 'Please enter the donation amount first.');
                    return;
                  }
                  if (requiresDetails && val) {
                    Alert.alert('Not allowed', 'For donations above ₹10,000, donor details are required.');
                    return;
                  }
                  setIsAnonymous(val);
                }}
                trackColor={{ false: '#e5e7eb', true: Colors.light.primary }}
                thumbColor={'#fff'}
              />
            </View>
            {requiresDetails ? (
              <Text style={{ color: '#dc2626', marginTop: 6, fontWeight: '700' }}>
                Above ₹10,000, donor details are mandatory.
              </Text>
            ) : null}
          </Field>

          {showDonorFields ? (
            <>
              <Field label={`Name${requiresDetails ? ' (required for > ₹10,000)' : ' (optional)'}`}>
                <TextInput editable value={name} onChangeText={setName} placeholder="Your name" style={styles.input} />
              </Field>
              <Field label={requiresDetails || !isAnonymous ? 'Mobile (required)' : 'Mobile (optional)'}>
                <TextInput keyboardType="phone-pad" value={mobile} onChangeText={(t) => setMobile(t.replace(/\D/g, '').slice(0,10))} placeholder="10-digit mobile" style={styles.input} maxLength={10} />
              </Field>
              <Field label="Email (optional)">
                <TextInput value={email} onChangeText={setEmail} placeholder="email@example.com" style={styles.input} />
              </Field>
              <Field label="Address (optional)">
                <TextInput value={address} onChangeText={setAddress} placeholder="Address" style={styles.input} />
              </Field>
              <Field label={`PAN${requiresDetails ? ' (required for > ₹10,000)' : ' (optional)'}`}>
                <TextInput autoCapitalize="characters" value={pan} onChangeText={setPan} placeholder="ABCDE1234F" style={styles.input} />
                {requiresDetails ? (
                  <Text style={{ color: '#6b7280', marginTop: 6 }}>PAN format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)</Text>
                ) : null}
              </Field>
            </>
          ) : null}

          <TouchableOpacity disabled={!canPay} onPress={startPayment} style={[styles.cta, !canPay && styles.ctaDisabled]}>
            <Text style={styles.ctaText}>{submitting ? 'Processing…' : 'Pay with Razorpay'}</Text>
          </TouchableOpacity>
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
  // header removed per request
  input: { borderWidth: 1, borderColor: '#e6e6ef', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff' },
  cta: { backgroundColor: Colors.light.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontWeight: '700' },
});
