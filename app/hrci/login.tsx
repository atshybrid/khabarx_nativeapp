import { makeShadow } from '@/utils/shadow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HrciLevel, useHrciOnboarding } from '../../context/HrciOnboardingContext';
import { loginWithMpin } from '../../services/api';
import { loadTokens, saveTokens } from '../../services/auth';
import { persistPayOrder } from '../../services/hrciPayment';
import { HttpError, request } from '../../services/http';

type CheckMobileResponse = {
  success?: boolean;
  data?: {
    mobileNumber: string;
    isRegistered: boolean;
    roleName: string | null;
    hasPendingSeats: boolean;
    pendingRegistrations?: {
      orderId: string;
      amount: number;
      paidAt?: string;
      seatDetails?: {
        cell?: { id: string; name?: string | null; code?: string | null };
        designation?: { id?: string | null; name?: string | null; code: string };
        level: HrciLevel;
        location?: { type: 'zone' | 'state' | 'district' | 'mandal'; id?: string; name?: string };
      };
    }[];
    message?: string;
  };
};

export default function HrciLoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    mobileNumber,
    setMobileNumber,
    setLevel,
    setCell,
    setDesignation,
    updateGeo,
    setPayOrder,
  } = useHrciOnboarding() as any;
  const [mobile, setMobile] = useState(mobileNumber || '');
  const [loading, setLoading] = useState(false);
  const valid = useMemo(() => /^\d{10}$/.test(mobile), [mobile]);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [mpinDigits, setMpinDigits] = useState<string[]>(['', '', '', '']);
  const [mpinError, setMpinError] = useState(false);
  const [footerBottom, setFooterBottom] = useState(0);
  const didRouteRef = useRef(false);
  const mpinRef1 = useRef<TextInput>(null);
  const mpinRef2 = useRef<TextInput>(null);
  const mpinRef3 = useRef<TextInput>(null);
  const mpinRef4 = useRef<TextInput>(null);
  const mpinRefs = useMemo(() => [mpinRef1, mpinRef2, mpinRef3, mpinRef4], []);
  const mpin = useMemo(() => mpinDigits.join(''), [mpinDigits]);
  const lastRoutedMobileRef = useRef<string | null>(null);
  const mobileRef = useRef<TextInput>(null);
  // Guards to avoid repeated check-mobile calls
  const lastCheckedMobileRef = useRef<string | null>(null);
  const checkInFlightRef = useRef(false);
  const checkStatusRef = useRef<null | (() => Promise<void>)>(null);

  useEffect(() => {
    setMobileNumber?.(mobile);
    // Reset one-shot route guard when mobile changes
    didRouteRef.current = false;
  }, [mobile, setMobileNumber]);

  const checkStatus = useCallback(async () => {
    if (checkInFlightRef.current) {
      console.log('[HRCI Login] checkStatus skipped - request already in flight');
      return;
    }
    console.log('[HRCI Login] checkStatus called - Form state:', {
      valid,
      loading,
      checking,
      mobile: mobile?.length || 0
    });

    if (!valid || loading || checking) {
      console.log('[HRCI Login] Check blocked - valid:', valid, 'loading:', loading, 'checking:', checking);
      return;
    }

    // Guard: don't re-check if same mobile already checked and no state change
    if (lastCheckedMobileRef.current === mobile) {
      console.log('[HRCI Login] Skipping check - mobile already checked:', mobile);
      return;
    }

    checkInFlightRef.current = true;

    setChecking(true);
    let apiStartTime = 0;
    
    try {
      console.log('[HRCI Login] Starting mobile check API call...');
      console.log('[HRCI Login] Check payload:', { mobileNumber: mobile });

      // New pay-first check-mobile endpoint
      apiStartTime = Date.now();
      const resp = await request<CheckMobileResponse>(
        `/memberships/payfirst/check-mobile`,
        { method: 'POST', noAuth: true, body: { mobileNumber: mobile } }
      );
      const apiDuration = Date.now() - apiStartTime;
      
      console.log('[HRCI Login] Check API completed in', apiDuration + 'ms');
      console.log('[HRCI Login] Check response:', resp);

      const data = resp?.data as NonNullable<CheckMobileResponse['data']>;
      const isRegistered = !!data?.isRegistered;
      const roleUpper = (data?.roleName || '').toString().trim().toUpperCase();
      const hasPending = !!data?.hasPendingSeats;

      console.log('[HRCI Login] Processed response data:', {
        isRegistered,
        roleUpper,
        hasPending,
        pendingCount: data?.pendingRegistrations?.length || 0
      });
      // Always set UI flag for MPIN when already registered (admin or member)
      if (isRegistered) {
        console.log('[HRCI Login] User is registered, checking role permissions...');
        
        // Only allow HRCI_ADMIN and MEMBER to login with MPIN
        const allowed = roleUpper === 'HRCI_ADMIN' || roleUpper === 'MEMBER';
        console.log('[HRCI Login] Role check result:', { roleUpper, allowed });
        
        if (!allowed) {
          console.log('[HRCI Login] Role not allowed, showing alert and resetting form');
          try {
            Alert.alert('Not allowed', 'This role is not allowed to login.');
          } catch (alertError) {
            console.warn('[HRCI Login] Alert failed:', alertError);
          }
          
          // Reset input so user can re-enter a different number
          console.log('[HRCI Login] Resetting form state for disallowed role');
          setRegistered(false);
          setMobile('');
          try { setMobileNumber?.(''); } catch {}
          setMpinDigits(['', '', '', '']);
          if (mpinError) setMpinError(false);
          didRouteRef.current = false;
          lastRoutedMobileRef.current = null;
          
          setTimeout(() => {
            mobileRef.current?.focus();
            console.log('[HRCI Login] Focus restored to mobile input after role rejection');
          }, 150);
          return;
        }
        
        console.log('[HRCI Login] Role allowed, setting registered state for MPIN entry');
        setRegistered(true);
        return; // stay on screen for MPIN login
      }
      // Not registered: handle pending seats fast-path
      if (!isRegistered && hasPending) {
        console.log('[HRCI Login] User not registered but has pending seats, processing fast-path...');
        
        const first = data?.pendingRegistrations?.[0];
        if (first) {
          console.log('[HRCI Login] Processing first pending registration:', {
            orderId: first.orderId,
            amount: first.amount,
            paidAt: first.paidAt,
            hasSeatDetails: !!first.seatDetails
          });
          
          // Prefill onboarding state from seat details
          const sd = first.seatDetails;
          if (sd?.level) {
            console.log('[HRCI Login] Setting level from seat details:', sd.level);
            try { setLevel?.(sd.level); } catch (e) { console.warn('[HRCI Login] Failed to set level:', e); }
          }
          if (sd?.cell?.id) {
            console.log('[HRCI Login] Setting cell from seat details:', { id: sd.cell.id, name: sd.cell.name, code: sd.cell.code });
            try { setCell?.(sd.cell.id, sd.cell.name || undefined, sd.cell.code || undefined); } catch (e) { console.warn('[HRCI Login] Failed to set cell:', e); }
          }
          if (sd?.designation?.code) {
            const desigId = sd.designation.id || sd.designation.code;
            console.log('[HRCI Login] Setting designation from seat details:', { id: desigId, code: sd.designation.code, name: sd.designation.name });
            try { setDesignation?.(desigId, sd.designation.code, sd.designation.name || undefined); } catch (e) { console.warn('[HRCI Login] Failed to set designation:', e); }
          }
          // Map location
          const loc = sd?.location;
          if (loc?.type) {
            console.log('[HRCI Login] Processing location from seat details:', { type: loc.type, id: loc.id, name: loc.name });
            const patch: any = {};
            if (loc.type === 'zone') {
              patch.zone = loc.name || undefined;
            } else if (loc.type === 'state') {
              patch.hrcStateId = loc.id || undefined; patch.hrcStateName = loc.name || undefined;
            } else if (loc.type === 'district') {
              patch.hrcDistrictId = loc.id || undefined; patch.hrcDistrictName = loc.name || undefined;
            } else if (loc.type === 'mandal') {
              patch.hrcMandalId = loc.id || undefined; patch.hrcMandalName = loc.name || undefined;
            }
            console.log('[HRCI Login] Applying geo patch:', patch);
            try { updateGeo?.(patch); } catch (e) { console.warn('[HRCI Login] Failed to update geo:', e); }
          }
          
          // Seed pay-order so register confirms without Razorpay
          const payOrderData = { orderId: first.orderId, amount: Number(first.amount), currency: 'INR', provider: null, restoredFrom: 'pendingRegistration', paidAt: first.paidAt || null };
          console.log('[HRCI Login] Setting pay order for registration (pending seat):', payOrderData);
          try { setPayOrder?.(payOrderData); } catch (e) { console.warn('[HRCI Login] Failed to set pay order:', e); }
          // Persist so register screen can recover even if context lost
          try { await persistPayOrder(payOrderData); } catch (e) { console.warn('[HRCI Login] Failed to persist pay order:', e); }
        }
        
        // Navigate directly to registration
        if (!didRouteRef.current) {
          console.log('[HRCI Login] Navigating to registration (first navigation)');
          didRouteRef.current = true;
          try { Keyboard.dismiss(); } catch (e) { console.warn('[HRCI Login] Failed to dismiss keyboard:', e); }
          
          if (lastRoutedMobileRef.current !== mobile) {
            lastRoutedMobileRef.current = mobile;
            try { 
              await AsyncStorage.setItem('HRCI_LAST_UNREG_MOBILE', mobile); 
              console.log('[HRCI Login] Saved last unregistered mobile to storage');
            } catch (e) { 
              console.warn('[HRCI Login] Failed to save mobile to storage:', e); 
            }
            
            console.log('[HRCI Login] Replacing route to /hrci/register');
            router.replace('/hrci/register' as any);
          } else {
            console.log('[HRCI Login] Skipping navigation - already routed for this mobile');
          }
        } else {
          console.log('[HRCI Login] Skipping navigation - already routed once');
        }
        return;
      }
      // Not registered and no pending seats: proceed with old flow to choose level
      console.log('[HRCI Login] User not registered and no pending seats, proceeding to level selection');
      setRegistered(false);
      
      if (!didRouteRef.current) {
        console.log('[HRCI Login] Navigating to level selection (first navigation)');
        didRouteRef.current = true;
        try { Keyboard.dismiss(); } catch (e) { console.warn('[HRCI Login] Failed to dismiss keyboard:', e); }
        
        if (lastRoutedMobileRef.current !== mobile) {
          lastRoutedMobileRef.current = mobile;
          try { 
            await AsyncStorage.setItem('HRCI_LAST_UNREG_MOBILE', mobile); 
            console.log('[HRCI Login] Saved last unregistered mobile to storage');
          } catch (e) { 
            console.warn('[HRCI Login] Failed to save mobile to storage:', e); 
          }
          
          console.log('[HRCI Login] Replacing route to /hrci/level');
          router.replace('/hrci/level' as any);
        } else {
          console.log('[HRCI Login] Skipping navigation - already routed for this mobile');
        }
      } else {
        console.log('[HRCI Login] Skipping navigation - already routed once');
      }
      
    } catch (e: any) {
      const checkDuration = Date.now() - apiStartTime;
      console.error('[HRCI Login] Check mobile failed after', checkDuration + 'ms');
      console.error('[HRCI Login] Check error details:', {
        message: e?.message,
        status: e?.status,
        stack: e?.stack
      });
      setRegistered(null);
    } finally {
      setChecking(false);
      checkInFlightRef.current = false;
      lastCheckedMobileRef.current = mobile;
      console.log('[HRCI Login] Check status completed, checking state cleared');
    }
  }, [valid, loading, checking, mobile, router, setLevel, setCell, setDesignation, updateGeo, setPayOrder, setMobileNumber, mpinError]);

  // Keep latest checkStatus in a ref to avoid stale closure in effects
  useEffect(() => { checkStatusRef.current = checkStatus; }, [checkStatus]);

  // Auto-check when 10 digits entered
  // Auto-check when 10 digits entered, once per mobile value
  useEffect(() => {
    if (!valid) return;
    // debounce a bit to avoid firing during rapid typing
    const t = setTimeout(() => {
      if (checkStatusRef.current) checkStatusRef.current();
    }, 100);
    return () => clearTimeout(t);
  }, [valid, mobile]);

  // Check if user is already authenticated and redirect
  useEffect(() => {
    const checkExistingAuth = async () => {
      console.log('[HRCI Login] Checking existing authentication on screen load');
      
      try {
        const tokens = await loadTokens();
        const hasValidToken = !!(tokens?.jwt);
        const userRole = tokens?.user?.role;
        const isExpired = tokens?.expiresAt ? Date.now() >= tokens.expiresAt : false;
        
        console.log('[HRCI Login] Auth status check:', {
          hasValidToken,
          userRole,
          isExpired,
          shouldRedirect: hasValidToken && !isExpired && (userRole === 'MEMBER' || userRole === 'HRCI_ADMIN')
        });
        
        if (hasValidToken && !isExpired && (userRole === 'MEMBER' || userRole === 'HRCI_ADMIN')) {
          console.log('[HRCI Login] Valid auth found, redirecting to dashboard');
          router.replace('/hrci' as any);
        } else if (hasValidToken && !isExpired) {
          console.log('[HRCI Login] Valid auth but not HRCI role:', userRole);
        } else {
          console.log('[HRCI Login] No valid auth or expired, staying on login');
        }
      } catch (error) {
        console.warn('[HRCI Login] Error checking existing auth:', error);
      }
    };
    
    checkExistingAuth();
  }, [router]); // Run only once on mount

  // Keyboard-aware footer positioning
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub1 = Keyboard.addListener(show, (e) => {
      const h = e?.endCoordinates?.height || 0;
      setFooterBottom(h);
    });
    const sub2 = Keyboard.addListener(hide, () => setFooterBottom(0));
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  const onMpinChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setMpinDigits(prev => {
      const next = [...prev];
      next[i] = d || '';
      return next;
    });
    // Reset error state on any change
    if (mpinError) setMpinError(false);
    // Move focus forward; if last digit filled, dismiss keyboard
    if (d) {
      if (i < 3) {
        mpinRefs[i + 1].current?.focus();
      } else {
        // close keyboard by blurring last field
        mpinRefs[3].current?.blur();
      }
    }
  };

  const doLogin = useCallback(async () => {
    console.log('[HRCI Login] doLogin called - Form state:', {
      registered,
      mpinLength: mpin?.length || 0,
      mpinValid: /^\d{4}$/.test(mpin),
      mobile: mobile?.length || 0,
      loading
    });

    if (!(registered && /^\d{4}$/.test(mpin))) {
      console.log('[HRCI Login] Login blocked - registered:', registered, 'mpin valid:', /^\d{4}$/.test(mpin));
      return;
    }

    const startTime = Date.now();
    setLoading(true);
    
    try {
      console.log('[HRCI Login] Starting login API call...');
      console.log('[HRCI Login] Login payload:', {
        mobileNumber: mobile,
        mpin: '****' // Hide sensitive data
      });

      const apiStartTime = Date.now();
      const data = await loginWithMpin({ mobileNumber: mobile, mpin });
      const apiDuration = Date.now() - apiStartTime;
      
      console.log('[HRCI Login] Login API completed successfully in', apiDuration + 'ms');
      console.log('[HRCI Login] Login response received:', {
        hasJwt: !!(data as any).jwt || !!(data as any).token,
        hasRefreshToken: !!(data as any).refreshToken,
        hasUser: !!(data as any).user,
        expiresIn: (data as any).expiresInSec || (data as any).expiresIn
      });

      // Persist tokens similar to auth/login flow
      try {
        console.log('[HRCI Login] Saving tokens to storage...');
        const jwt = (data as any).jwt || (data as any).token;
        const refreshToken = (data as any).refreshToken;
        const expiresIn = (data as any).expiresInSec || (data as any).expiresIn;
        const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
        let user = (data as any).user;

        // If user not present in login response, fetch profile
        if (!user) {
          console.log('[HRCI Login] No user in login response. Fetching /profiles/me ...');
          try {
            const profStart = Date.now();
            const profRes = await request<any>('/profiles/me', { method: 'GET' });
            const profDur = Date.now() - profStart;
            console.log('[HRCI Login] /profiles/me success in', profDur + 'ms');
            user = (profRes as any)?.data || profRes || null;
          } catch (profErr) {
            console.warn('[HRCI Login] Failed to fetch profile after login:', profErr);
          }
        }

        await saveTokens({ jwt, refreshToken, expiresAt, user });
        console.log('[HRCI Login] Tokens saved successfully');
      } catch (tokenError) {
        console.error('[HRCI Login] Failed to save tokens:', tokenError);
      }

      // Role-based navigation: HRCI_ADMIN -> admin area, otherwise dashboard
      try {
        const userRole = (data as any)?.user?.role || undefined;
        console.log('[HRCI Login] Determining navigation target. Role:', userRole);
        if (userRole === 'HRCI_ADMIN') {
          console.log('[HRCI Login] Navigating to HRCI Admin home');
          // If admin route exists, navigate there; else fallback to dashboard
          router.replace('/hrci' as any);
        } else {
          console.log('[HRCI Login] Navigating to HRCI dashboard');
          router.replace('/hrci' as any);
        }
      } catch (navErr) {
        console.warn('[HRCI Login] Navigation after login failed, fallback to /hrci', navErr);
        router.replace('/hrci' as any);
      }
      
    } catch (e: any) {
      const loginDuration = Date.now() - startTime;
      console.error('[HRCI Login] Login failed after', loginDuration + 'ms');
      console.error('[HRCI Login] Login error details:', {
        message: e?.message,
        status: e?.status,
        stack: e?.stack
      });

      // Mark MPIN error on unauthorized
      const unauthorized = (e instanceof HttpError && (e.status === 401 || e.status === 403))
        || (typeof e?.message === 'string' && /unauthor|invalid|wrong/i.test(e.message));
      
      if (unauthorized) {
        console.log('[HRCI Login] Unauthorized error detected - setting MPIN error state');
        setMpinError(true);
        try { 
          console.log('[HRCI Login] Vibrating for error feedback');
          Vibration.vibrate(50); 
        } catch (vibError) {
          console.warn('[HRCI Login] Vibration failed:', vibError);
        }
        
        // Optionally clear for retry after a short delay
        console.log('[HRCI Login] Clearing MPIN for retry in 300ms');
        setTimeout(() => {
          setMpinDigits(['', '', '', '']);
          mpinRefs[0].current?.focus();
          console.log('[HRCI Login] MPIN cleared and focus restored');
        }, 300);
      } else {
        console.log('[HRCI Login] Non-authorization error - not clearing MPIN');
      }
    } finally {
      setLoading(false);
      console.log('[HRCI Login] Login attempt completed, loading state cleared');
    }
  }, [registered, mpin, mobile, router, mpinRefs, loading]);

  // Focus MPIN when registered flips to true
  useEffect(() => {
    if (registered === true) {
      const t = setTimeout(() => mpinRefs[0].current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [registered, mpinRefs]);

  const screen = Dimensions.get('window');
  const isSmall = screen.height < 700;
  const ctaLabel = registered === true ? (loading ? 'Logging in…' : 'Login') : 'Continue';
  const ctaDisabled = registered === true ? !/^\d{4}$/.test(mpin) || loading : (!valid || checking || loading);
  const ctaOnPress = registered === true ? doLogin : checkStatus;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={[styles.top, isSmall && { marginTop: 8 }]}>
        <Image
          source={require('../../assets/images/hrci_logo.png')}
          style={[styles.logo, { width: Math.min(screen.width - 40, 320), height: Math.round(Math.min(screen.width - 40, 320) * 0.33) }]}
        />
        <Text style={[styles.h1, isSmall && { fontSize: 16 }]}>
          Human Rights Council for India (HRCI)
        </Text>
        <Text style={[styles.h2, isSmall && { fontSize: 11, lineHeight: 14 }]} numberOfLines={isSmall ? 3 : undefined}>
          REGISTERED BY NCT, NEW DELHI, GOVT OF INDIA REGISTERED NO: 4396/2022 (UNDER TRUST ACT 1882){'\n'}TO PROTECT & PROMOTE THE HUMAN RIGHTS
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          keyboardType="number-pad"
          maxLength={10}
          placeholder="10-digit mobile"
          placeholderTextColor="#9aa0a6"
          value={mobile}
          onChangeText={setMobile}
          style={[styles.input, isSmall && { height: 44, paddingHorizontal: 10 }]}
        />
        {!valid && <Text style={styles.helper}>Auto-check runs after 10 digits.</Text>}

        {registered === true && (
          <View style={styles.mpinBlock}>
            <Text style={styles.mpinLabel}>MPIN</Text>
            <View style={styles.mpinRow}>
              {mpinDigits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={mpinRefs[i]}
                  value={d}
                  onChangeText={(v) => onMpinChange(i, v)}
                  keyboardType="number-pad"
                  maxLength={1}
                  secureTextEntry
                  style={[
                    styles.mpinBox,
                    isSmall && { width: 40, height: 44, fontSize: 18 },
                    mpinError ? styles.mpinBoxError : (d ? styles.mpinBoxFilled : undefined),
                  ]}
                />
              ))}
            </View>
            {mpinError && <Text style={styles.mpinErrorText}>Incorrect MPIN. Try again.</Text>}
          </View>
        )}
      </View>
      {/* Bottom CTA */}
      <View style={[
        styles.footer,
        {
          paddingBottom: insets.bottom + 10,
          bottom: footerBottom,
        },
      ]}>
        <TouchableOpacity
          style={[styles.footerBtn, ctaDisabled && styles.disabled]}
          disabled={ctaDisabled}
          onPress={ctaOnPress}
        >
          {(loading || checking) ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.footerBtnText}>{ctaLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 18, paddingTop: 40 },
  top: { alignItems: 'center', marginBottom: 16 },
  logo: { resizeMode: 'contain' },
  h1: { marginTop: 10, fontSize: 18, fontWeight: '800', color: '#1D0DA1', textAlign: 'center' },
  h2: { marginTop: 6, fontSize: 12, lineHeight: 16, color: '#6b7280', textAlign: 'center' },
  form: { marginTop: 18 },
  input: { borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#ffffff', borderRadius: 12, paddingHorizontal: 12, height: 48, fontSize: 16, color: '#111827' },
  helper: { marginTop: 8, fontSize: 12, color: '#6b7280', textAlign: 'left' },
  primary: { marginTop: 14, backgroundColor: '#FE0002', height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
  mpinBlock: { marginTop: 16 },
  mpinLabel: { fontSize: 12, color: '#1D0DA1', marginBottom: 6, fontWeight: '700' },
  mpinRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 4 },
  mpinBox: { width: 44, height: 48, borderRadius: 0, borderWidth: 0, borderBottomWidth: 2, borderColor: '#e5e7eb', backgroundColor: 'transparent', textAlign: 'center', fontSize: 20, color: '#111827' },
  mpinBoxFilled: { borderColor: '#1D0DA1' },
  mpinBoxError: { borderColor: '#ef4444' },
  mpinErrorText: { marginTop: 8, color: '#ef4444', fontSize: 12, textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 18,
    paddingTop: 10,
    ...makeShadow(8, { opacity: 0.06, blur: 20, y: -2 })
  },
  footerBtn: {
    backgroundColor: '#FE0002',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
