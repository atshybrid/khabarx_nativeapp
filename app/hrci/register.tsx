import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHrciOnboarding } from '../../context/HrciOnboardingContext';
import { loadFreshPayOrder } from '../../services/hrciPayment';
import { request } from '../../services/http';

export default function HrciRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = 16 + 72 + (insets?.bottom || 0);
  const { mobileNumber, level, cellId, cellName, designationCode, designationName, geo, payOrder, setPayOrder } = useHrciOnboarding();
  // Attempt to restore payOrder if missing (e.g., app refresh or navigation loss)
  useEffect(() => {
    (async () => {
      if (!payOrder) {
        try {
          const restored = await loadFreshPayOrder();
          if (restored?.orderId) {
            console.log('[Register] Restored fresh payOrder from helper:', restored.orderId);
            setPayOrder(restored);
          }
        } catch { /* ignore */ }
      }
    })();
  }, [payOrder, setPayOrder]);
  const [fullName, setFullName] = useState('');
  const [mpin, setMpin] = useState('');
  const [mpin2, setMpin2] = useState('');
  const [showMpin, setShowMpin] = useState(false);
  const [showMpin2, setShowMpin2] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mpinValid = /^\d{4}$/.test(mpin);
  const mpinMatch = mpin.length > 0 && mpin === mpin2;
  // Status checking removed for cleaner UI - only summary card needed

  const canSubmit = useMemo(() => {
    return !!(
      mobileNumber &&
      level &&
      cellId &&
      designationCode &&
      fullName.trim().length > 1 &&
      mpinValid &&
      mpinMatch
    );
  }, [mobileNumber, level, cellId, designationCode, fullName, mpinValid, mpinMatch]);

  const onSubmit = async () => {
    console.log('[Register] onSubmit called - Form state:', {
      canSubmit,
      submitting,
      fullName: fullName?.length || 0,
      mpin: mpin?.length || 0,
      mpin2: mpin2?.length || 0,
      mpinValid,
      mpinMatch,
      hasPayOrder: !!payOrder?.orderId
    });

    if (!canSubmit || submitting) {
      console.log('[Register] Submit blocked - canSubmit:', canSubmit, 'submitting:', submitting);
      return;
    }
    
    setSubmitting(true);
    let apiStartTime = 0;
    
    try {
      console.log('[Register] Starting validation checks...');
      
      // Validate required fields before API call
      if (!payOrder?.orderId) {
        console.error('[Register] Validation failed: Missing payOrder.orderId');
        // Try one last restore attempt synchronously
        try {
          const restored = await loadFreshPayOrder();
          if (restored?.orderId) {
            setPayOrder(restored);
            console.log('[Register] Late restored payOrder (fresh) – retrying submit');
            setSubmitting(false);
            setTimeout(onSubmit, 50);
            return;
          }
        } catch {}
        throw new Error('Missing order. Please go back to Availability.');
      }
      if (!mobileNumber) {
        console.error('[Register] Validation failed: Missing mobileNumber');
        throw new Error('Mobile number is required.');
      }
      if (!fullName.trim()) {
        console.error('[Register] Validation failed: Missing fullName');
        throw new Error('Full name is required.');
      }
      if (!mpinValid) {
        console.error('[Register] Validation failed: Invalid MPIN');
        throw new Error('MPIN must be 4 digits.');
      }
      if (!mpinMatch) {
        console.error('[Register] Validation failed: MPIN mismatch');
        throw new Error('MPINs do not match.');
      }

      console.log('[Register] All validations passed, preparing API call...');

      // Prepare payload with proper types and validation
      const payload = {
        orderId: String(payOrder.orderId).trim(),
        mobileNumber: String(mobileNumber).trim(),
        mpin: String(mpin).trim(),
        fullName: String(fullName).trim(),
      };

      console.log('[Register] API payload prepared:', {
        ...payload,
        mpin: '****', // Hide sensitive data in logs
      });

      apiStartTime = Date.now();
      console.log('[Register] Calling /memberships/payfirst/register API...');

      const response = await request<any>(`/memberships/payfirst/register`, { 
        method: 'POST', 
        body: payload,
        noAuth: true,
      });

      const apiDuration = Date.now() - apiStartTime;
      console.log('[Register] API call completed successfully in', apiDuration + 'ms');
      console.log('[Register] Registration response:', response);
      
      console.log('[Register] Showing success alert and navigating to login...');
      Alert.alert('Success', 'Registration completed. You can now login.');
      
      console.log('[Register] Navigating to /hrci/login with mobile prefill...');
      router.replace('/hrci/login' as any);
    } catch (e: any) {
      const errorDuration = Date.now() - apiStartTime;
      console.error('[Register] Registration failed after', errorDuration + 'ms');
      console.error('[Register] Error details:', {
        message: e?.message,
        status: e?.status,
        stack: e?.stack,
        body: e?.body
      });
      
      // Enhanced error handling with specific messages
      if (e?.status === 400) {
        console.log('[Register] Showing 400 error alert - Invalid Data');
        Alert.alert('Invalid Data', e?.message || 'Please check your information and try again.');
      } else if (e?.status === 409) {
        const msg = String(e?.message || '').toLowerCase();
        if (msg.includes('already') && msg.includes('register')) {
          console.log('[Register] 409 indicates already registered – treating as success');
          Alert.alert('Already Registered', 'Your registration is already complete. You can now login.');
          router.replace('/hrci/login' as any);
        } else {
          console.log('[Register] Showing 409 error alert - Capacity/Conflict');
          Alert.alert('Capacity Full', 'Please adjust your selection and check availability again.');
        }
      } else if (e?.status === 404) {
        console.log('[Register] Showing 404 error alert - Order Not Found');
        Alert.alert('Order Not Found', 'Your order has expired. Please start the process again.');
      } else if (e?.status === 422) {
        console.log('[Register] Showing 422 error alert - Validation Error');
        Alert.alert('Validation Error', e?.message || 'Please verify all required fields.');
      } else if (e?.status >= 500) {
        console.log('[Register] Showing 500+ error alert - Server Error');
        Alert.alert('Server Error', 'Our servers are experiencing issues. Please try again later.');
      } else {
        console.log('[Register] Showing generic error alert');
        Alert.alert('Registration Failed', e?.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top','left','right','bottom']}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.heading}>Membership Registration</Text>
      </View>

      {/* Summary card */}
      <View style={styles.summaryCard}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="card-account-details" size={22} color="#FE0002" />
          <Text style={styles.cardTitle}>Registration Summary</Text>
          {((payOrder as any)?.restoredFrom === 'pendingRegistration') || (payOrder as any)?.paidAt ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{(payOrder as any)?.paidAt ? 'PAID' : 'RECOVERED'}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.summaryGrid}>
          <SummaryRow label="Mobile" value={String(mobileNumber || '')} />
          <SummaryRow label="Level" value={String(level || '')} />
          <SummaryRow label="Cell" value={cellName || String(cellId || '')} />
          <SummaryRow label="Designation" value={designationName || String(designationCode || '')} />
          {level === 'ZONE' && geo.zone && <SummaryRow label="Zone" value={String(geo.zone)} />}
          {level === 'STATE' && geo.hrcStateName && <SummaryRow label="State" value={geo.hrcStateName} />}
          {level === 'DISTRICT' && geo.hrcDistrictName && <SummaryRow label="District" value={geo.hrcDistrictName} />}
          {level === 'MANDAL' && geo.hrcMandalName && <SummaryRow label="Mandal" value={geo.hrcMandalName} />}
          {typeof payOrder?.amount === 'number' && (
            <SummaryRow label="Contribution" value={(payOrder?.currency || 'INR') === 'INR' ? `₹ ${payOrder.amount}` : `${payOrder?.currency || ''} ${payOrder.amount}`} />
          )}
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }} keyboardShouldPersistTaps="handled">
            <Field label="Full Name">
              <TextInput value={fullName} onChangeText={setFullName} placeholder="Enter your full name" style={styles.input} />
              {fullName.trim().length === 0 ? (
                <Text style={styles.hint}>Enter your full name</Text>
              ) : null}
            </Field>


            <Field label="MPIN (4 digits)">
              <View style={styles.inputRow}>
                <TextInput
                  value={mpin}
                  onChangeText={setMpin}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="****"
                  style={styles.inputField}
                  secureTextEntry={!showMpin}
                />
                <TouchableOpacity onPress={() => setShowMpin((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.iconBtn}>
                  <MaterialCommunityIcons name={showMpin ? 'eye-off' : 'eye'} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {!mpinValid && mpin.length > 0 ? <Text style={styles.error}>MPIN must be 4 digits</Text> : null}
            </Field>
            <Field label="Confirm MPIN">
              <View style={styles.inputRow}>
                <TextInput
                  value={mpin2}
                  onChangeText={setMpin2}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="****"
                  style={styles.inputField}
                  secureTextEntry={!showMpin2}
                />
                <TouchableOpacity onPress={() => setShowMpin2((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.iconBtn}>
                  <MaterialCommunityIcons name={showMpin2 ? 'eye-off' : 'eye'} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {mpin2.length > 0 && !mpinMatch ? <Text style={styles.error}>MPINs do not match</Text> : null}
            </Field>


          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Bottom fixed CTA (with fade) */}
      <View style={[styles.actionBar, { paddingBottom: 12 + (insets?.bottom || 0) }]}>
        <LinearGradient
          colors={["rgba(255,255,255,0)", "#ffffff"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.fadeTop, { pointerEvents: 'none' }]}
        />
        <TouchableOpacity disabled={!canSubmit || submitting} onPress={onSubmit} style={[styles.cta, (!canSubmit || submitting) && styles.ctaDisabled]}>
          <Text style={styles.ctaText}>{submitting ? 'Submitting…' : (payOrder?.orderId ? 'Confirm & Submit' : 'Register')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff' },
  heading: { fontSize: 18, fontWeight: '800', color: '#111827' },
  summaryCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: '#eef0f4' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  badge: { marginLeft: 8, backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  summaryGrid: { gap: 8 },
  field: { marginBottom: 12 },
  fieldLabel: { marginBottom: 6, color: '#333', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e6e6ef', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff' },
  inputRow: { borderWidth: 1, borderColor: '#e6e6ef', borderRadius: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' },
  inputField: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  iconBtn: { paddingHorizontal: 12, paddingVertical: 10, borderLeftWidth: 1, borderLeftColor: '#e6e6ef' },
  hint: { marginTop: 6, color: '#6B7280', fontSize: 12 },
  error: { marginTop: 6, color: '#ef4444', fontSize: 12, fontWeight: '700' },
  cta: { backgroundColor: '#1D0DA1', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontWeight: '700' },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 12, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#eef0f4', ...makeShadow(8, { opacity: 0.06, blur: 20, y: -2 }) },
  fadeTop: { position: 'absolute', left: 0, right: 0, top: -20, height: 20 },
});

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: '#64748b', fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: '#111827', fontWeight: '800' }}>{value}</Text>
    </View>
  );
}
