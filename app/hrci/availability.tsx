import { Loader } from '@/components/ui/Loader';
import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHrciOnboarding } from '../../context/HrciOnboardingContext';
import { persistPayOrder } from '../../services/hrciPayment';
import { request } from '../../services/http';

type AvailRes = { 
  success?: boolean; 
  data?: { 
    designation?: { capacity: number; used: number; remaining: number; fee?: number; validityDays?: number };
    // Direct properties (new API structure)
    capacity?: number;
    used?: number;
    remaining?: number; 
    fee?: number;
    validityDays?: number;
    aggregate?: any;
    levelAggregate?: any;
  } 
};
type OrderRes = { 
  success?: boolean; 
  data?: { 
    order: { 
      orderId: string; 
      amount: number; 
      currency: string; 
      provider: string | null; 
      providerOrderId?: string | null; 
      providerKeyId?: string | null;
      breakdown?: {
        baseAmount: number;
        discountAmount: number;
        discountPercent: number | null;
        appliedType: string | null;
        finalAmount: number;
        note: string | null;
      } | null;
    } 
  } 
};

export default function HrciAvailabilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mobileNumber, level, cellId, cellName, cellCode, designationCode, designationName, geo } = useHrciOnboarding();
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [validityDays, setValidityDays] = useState<number | null>(null);
  const { setPayOrder, setRazorpayResult } = useHrciOnboarding();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        console.log('[HRCI Availability] Starting availability check...');
        console.log('[HRCI Availability] Input params:', {
          cellId,
          designationCode, 
          level,
          geo
        });

        const q = new URLSearchParams({
          cell: String(cellId),
          designationCode: String(designationCode),
          level: String(level),
        });
        if (geo.zone) q.set('zone', String(geo.zone));
        if (geo.hrcCountryId) q.set('hrcCountryId', String(geo.hrcCountryId));
        if (geo.hrcStateId) q.set('hrcStateId', String(geo.hrcStateId));
        if (geo.hrcDistrictId) q.set('hrcDistrictId', String(geo.hrcDistrictId));
        if (geo.hrcMandalId) q.set('hrcMandalId', String(geo.hrcMandalId));
        
        // Add includeAggregate parameter that was missing
        q.set('includeAggregate', 'true');
        
        const apiUrl = `/memberships/public/availability?${q.toString()}`;
        console.log('[HRCI Availability] API URL:', apiUrl);
        
        const apiStartTime = Date.now();
        const res = await request<AvailRes>(`/memberships/public/availability?${q.toString()}`);
        const apiDuration = Date.now() - apiStartTime;
        
        console.log('[HRCI Availability] API completed in', apiDuration + 'ms');
        console.log('[HRCI Availability] Raw API response:', res);

        // Check both possible response structures
        const remainingSeats = res?.data?.designation?.remaining ?? res?.data?.remaining ?? null;
        const feeAmount = res?.data?.designation?.fee ?? res?.data?.fee ?? null;
        const validity = res?.data?.designation?.validityDays ?? res?.data?.validityDays ?? null;
        
        console.log('[HRCI Availability] Processed data:', {
          remainingSeats,
          feeAmount,
          validity,
          dataStructure: res?.data ? Object.keys(res.data) : 'no data'
        });

        setRemaining(remainingSeats);
        setFee(feeAmount);
        setValidityDays(validity);
      } catch (e: any) {
        console.error('[HRCI Availability] API call failed:', {
          message: e?.message,
          status: e?.status,
          stack: e?.stack
        });
        setError(e?.message || 'Failed to check availability');
      } finally {
        setLoading(false);
        console.log('[HRCI Availability] Check completed');
      }
    })();
  }, [level, cellId, designationCode, geo]);

  const canProceed = useMemo(() => {
    const result = !loading && !error && (remaining ?? 0) > 0;
    console.log('[HRCI Availability] canProceed calculation:', {
      loading,
      error,
      remaining,
      result
    });
    return result;
  }, [loading, error, remaining]);

  // Log state changes for debugging
  useEffect(() => {
    console.log('[HRCI Availability] State updated:', {
      loading,
      remaining,
      error,
      fee,
      validityDays,
      canProceed
    });
  }, [loading, remaining, error, fee, validityDays, canProceed]);

  const createOrder = async () => {
    try {
      // Build body based on level as per API specification
      const body: any = {
        mobileNumber: String(mobileNumber || ''),
        cell: cellCode || cellId, // Use cellCode (like "GENERAL_BODY") if available, fallback to cell ID
        designationCode,
        level
      };
      
      // Add location fields based on level
      if (level === 'ZONE' && geo.zone) {
        body.zone = geo.zone;
      } else if (level === 'STATE' && geo.hrcStateId) {
        body.hrcStateId = geo.hrcStateId;
      } else if (level === 'DISTRICT' && geo.hrcDistrictId) {
        body.hrcDistrictId = geo.hrcDistrictId;
      } else if (level === 'MANDAL' && geo.hrcMandalId) {
        body.hrcMandalId = geo.hrcMandalId;
      }
      const res = await request<OrderRes>(`/memberships/payfirst/orders`, { method: 'POST', body });
      const order = res?.data?.order as any;
      if (!order?.orderId) throw new Error('Order not created');
      // Prefer finalAmount from breakdown when present
      const effectiveAmount: number = Number(order?.breakdown?.finalAmount ?? order?.amount ?? 0);
      // Build a human-readable price breakdown (if available)
      const breakdown = order?.breakdown ?? null;
      const fmtINR = (amt: number) => `₹ ${(amt / 100).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
      const payOrderObj = {
        orderId: order.orderId,
        amount: effectiveAmount,
        currency: order.currency || 'INR',
        provider: order.provider || null,
        providerOrderId: order.providerOrderId || null,
        providerKeyId: order.providerKeyId || null,
        breakdown,
        createdAt: Date.now()
      };
      setPayOrder(payOrderObj);
  try { await persistPayOrder(payOrderObj); } catch {}
  if (order.provider === 'razorpay' && order.providerOrderId && order.providerKeyId) {
        // If we have a breakdown, show a quick confirmation with discount details before opening checkout
        if (breakdown && typeof breakdown.finalAmount === 'number') {
          try {
            await new Promise<void>((resolve, reject) => {
              const baseTxt = typeof breakdown.baseAmount === 'number' ? fmtINR(breakdown.baseAmount) : null;
              const discPct = breakdown.discountPercent != null ? `${breakdown.discountPercent}%` : null;
              const discAmt = typeof breakdown.discountAmount === 'number' ? fmtINR(breakdown.discountAmount) : null;
              const finalTxt = fmtINR(breakdown.finalAmount);
              const lines = [
                baseTxt ? `Base amount: ${baseTxt}` : null,
                discPct || discAmt ? `Discount: ${[discPct, discAmt].filter(Boolean).join(' • ')}` : null,
                `You pay: ${finalTxt}`,
              ].filter(Boolean).join('\n');
              Alert.alert(
                'Price breakdown',
                lines,
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => reject(new Error('Payment cancelled')) },
                  { text: 'Pay now', style: 'default', onPress: () => resolve() },
                ],
                { cancelable: true }
              );
            });
          } catch {
            // User cancelled from breakdown dialog; stop here
            return;
          }
        }
        // Open Razorpay Checkout (guarded dynamic require so build doesn't break if SDK isn't installed)
        if (Platform.OS !== 'web') {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const RazorpayCheckout = require('react-native-razorpay');
            console.log('[Razorpay] Module loaded:', !!RazorpayCheckout, 'default export:', typeof RazorpayCheckout.default, 'open method:', typeof RazorpayCheckout?.open);
            
            // Try both default export and direct export
            const checkoutAPI = RazorpayCheckout.default || RazorpayCheckout;
            if (checkoutAPI && typeof checkoutAPI.open === 'function') {
              const options: any = {
                key: order.providerKeyId,
                order_id: order.providerOrderId,
                // IMPORTANT: Pass only the final amount (in paise) to Razorpay
                amount: effectiveAmount,
                name: 'Membership Contribution',
                description: `${designationName || String(designationCode)} • ${cellName || ''} • ${String(level)}`.replace(/\s+•\s+/g, ' • ').trim(),
                theme: { color: '#FE0002' },
                prefill: {},
                retry: { enabled: true, max_count: 1 },
              };
              console.log('[Razorpay] Opening checkout with options:', { ...options, key: '***', order_id: options.order_id });
              const result = await checkoutAPI.open(options);
              console.log('[Razorpay] Payment result:', result);
              
              // result has: razorpay_order_id, razorpay_payment_id, razorpay_signature
              if (result && result.razorpay_order_id && result.razorpay_payment_id && result.razorpay_signature) {
                setRazorpayResult({
                  razorpay_order_id: result.razorpay_order_id,
                  razorpay_payment_id: result.razorpay_payment_id,
                  razorpay_signature: result.razorpay_signature,
                });
                // Confirm success immediately
                setConfirming(true);
                try {
                  await request<any>(`/memberships/payfirst/confirm`, {
                    method: 'POST',
                    body: {
                      orderId: order.orderId,
                      status: 'SUCCESS',
                      provider: order.provider,
                      razorpay_order_id: result.razorpay_order_id,
                      razorpay_payment_id: result.razorpay_payment_id,
                      razorpay_signature: result.razorpay_signature,
                    },
                  });
                } catch (e:any) {
                  console.warn('[Payfirst] confirm success failed', e?.message);
                } finally {
                  setConfirming(false);
                }
              }
            } else {
              console.warn('[Razorpay] Module found but open method unavailable. Module:', RazorpayCheckout);
              Alert.alert('Razorpay Setup Issue', 'The Razorpay module is not properly configured. Please rebuild the development client with the correct native modules.');
            }
          } catch (err: any) {
            console.warn('[Razorpay] SDK not available or failed to open checkout:', err);
            // Attempt to confirm failed/cancelled attempts as FAILED
            setConfirming(true);
            try {
              await request<any>(`/memberships/payfirst/confirm`, {
                method: 'POST',
                body: {
                  orderId: order.orderId,
                  status: 'FAILED',
                  provider: order.provider,
                },
              });
            } catch (e:any) {
              console.warn('[Payfirst] confirm failed (FAILED status)', e?.message);
            } finally {
              setConfirming(false);
            }
            Alert.alert('Payment Setup Required', 'Razorpay is not available in this build. Please rebuild the development client to enable payments.');
          }
        } else {
          // Web: skip opening checkout and continue to details
          Alert.alert('Not supported on web', 'Payment is not supported in web builds. Please use the mobile app.');
        }
      }
      // Proceed to registration after confirming payment status
      router.replace('/hrci/register' as any);
    } catch (e: any) {
      Alert.alert('Order Failed', e?.message || 'Could not create order. Please try again.');
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.loadingContainer} edges={['top','left','right','bottom']}>
      <StatusBar style="dark" backgroundColor="#f8fafc" />
      <View style={styles.loadingContent}>
  <Loader size={96} />
        <Text style={styles.loadingText}>Checking availability...</Text>
      </View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={styles.errorContainer} edges={['top','left','right','bottom']}>
      <StatusBar style="dark" backgroundColor="#fef2f2" />
      <View style={styles.errorContent}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.mainContainer} edges={['top','left','right','bottom']}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.heading}>Seat Availability</Text>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {/* Membership Details Card */}
        <View style={styles.membershipCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="card-account-details" size={24} color="#FE0002" />
            <Text style={styles.cardTitle}>Membership Details</Text>
          </View>
          
          <View style={styles.detailsGrid}>
            <DetailItem label="Level" value={String(level || '')} />
            <DetailItem label="Cell" value={cellName || String(cellId || '')} />
            <DetailItem label="Designation" value={designationName || String(designationCode || '')} />
            {level === 'ZONE' && geo.zone && <DetailItem label="Zone" value={String(geo.zone)} />}
            {level === 'STATE' && geo.hrcStateName && <DetailItem label="State" value={geo.hrcStateName} />}
            {level === 'DISTRICT' && geo.hrcDistrictName && <DetailItem label="District" value={geo.hrcDistrictName} />}
            {level === 'MANDAL' && geo.hrcMandalName && <DetailItem label="Mandal" value={geo.hrcMandalName} />}
          </View>
        </View>

        {/* Availability Status Card */}
        <View style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="account-group" size={24} color="#FE0002" />
            <Text style={styles.cardTitle}>Availability Status</Text>
          </View>
          
          {(remaining ?? 0) > 0 ? (
            <View style={styles.successBanner}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#1D0DA1" />
              <Text style={styles.successText}>You can join membership! Seats are available.</Text>
            </View>
          ) : (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#dc2626" />
              <Text style={styles.errorBannerText}>No seats available for the selected location.</Text>
            </View>
          )}

          <View style={styles.statsRow}>
            {typeof fee === 'number' && (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Contribution Amount</Text>
                <Text style={styles.statValue}>₹ {fee.toLocaleString()}</Text>
              </View>
            )}
            
            {typeof validityDays === 'number' && (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Validity</Text>
                <Text style={styles.statValue}>{validityDays} days</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Fixed Bottom Action */}
      <View style={[styles.actionBar, { paddingBottom: 16 + (insets?.bottom || 0) }]}>
        <LinearGradient
          colors={["rgba(255,255,255,0)", "#ffffff"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.fadeTop, { pointerEvents: 'none' }]}
        />
        {canProceed ? (
          <TouchableOpacity style={styles.proceedBtn} onPress={createOrder}>
            <MaterialCommunityIcons name="credit-card-outline" size={20} color="#ffffff" />
            <Text style={styles.proceedBtnText}>Proceed to Contribution</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.changeBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={20} color="#ffffff" />
            <Text style={styles.changeBtnText}>Change Selection</Text>
          </TouchableOpacity>
        )}
      </View>
      {confirming && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <Loader size={56} />
            <Text style={{ marginTop: 12, color: '#ffffff', fontWeight: '700' }}>Confirming payment…</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Loading state
  loadingContainer: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#64748b', fontWeight: '600' },

  // Error state
  errorContainer: { flex: 1, backgroundColor: '#fef2f2' },
  errorContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { marginTop: 16, fontSize: 16, color: '#dc2626', textAlign: 'center', fontWeight: '600' },
  retryBtn: { marginTop: 24, backgroundColor: '#dc2626', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  retryBtnText: { color: '#ffffff', fontWeight: '700' },

  // Main container
  mainContainer: { flex: 1, backgroundColor: '#f8fafc' },
  
  // Header
  header: { 
    paddingHorizontal: 16, 
    paddingVertical: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  heading: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1e293b' },

  // Content
  contentContainer: { flex: 1, padding: 16 },
  summaryCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 20, 
    ...makeShadow(4, { opacity: 0.1, blur: 16, y: 2 })
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  
  statsRow: { gap: 16 },
  statItem: { marginBottom: 16 },
  statLabel: { fontSize: 14, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#1e293b' },

  // Banners
  successBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    backgroundColor: '#f0fdf4', 
    padding: 16, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#bbf7d0',
    marginTop: 16
  },
  successText: { flex: 1, fontSize: 14, color: '#166534', fontWeight: '600' },
  
  errorBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    backgroundColor: '#fef2f2', 
    padding: 16, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#fecaca',
    marginTop: 16
  },
  errorBannerText: { flex: 1, fontSize: 14, color: '#dc2626', fontWeight: '600' },

  // Action bar
  actionBar: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: 0, 
    paddingHorizontal: 16, 
    paddingTop: 16, 
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0'
  },
  fadeTop: { position: 'absolute', left: 0, right: 0, top: -20, height: 20 },
  
  proceedBtn: { 
    backgroundColor: '#1D0DA1', 
    paddingVertical: 14, 
    paddingHorizontal: 20, 
    borderRadius: 12, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...makeShadow(8, { color: '29,13,161', opacity: 0.3, blur: 16, y: 4 })
  },
  proceedBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  
  changeBtn: { 
    backgroundColor: '#64748b', 
    paddingVertical: 14, 
    paddingHorizontal: 20, 
    borderRadius: 12, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  changeBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  
  // Membership card
  membershipCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 16,
    ...makeShadow(4, { opacity: 0.1, blur: 16, y: 2 })
  },
  detailsGrid: { gap: 12 },
  detailItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  detailLabel: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  detailValue: { fontSize: 14, color: '#1e293b', fontWeight: '700', flex: 1, textAlign: 'right' },
});

// Helper component for detail items
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}
