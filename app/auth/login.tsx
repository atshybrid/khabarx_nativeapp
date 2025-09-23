import { Colors } from '@/constants/Colors';
import { createCitizenReporterMobile, getMpinStatus, loginWithMpin, requestOtpForMpinReset, setNewMpin, verifyOtpForMpinReset } from '@/services/api';
import { getLastMobile, saveTokens } from '@/services/auth';
import { getDeviceIdentity } from '@/services/device';
import { requestAppPermissions } from '@/services/permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Keyboard, KeyboardAvoidingView, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mobile?: string; from?: string }>();
  const [mobile, setMobile] = useState(params.mobile || '');
  // Prefill last mobile if available and none provided via params (run only once)
  const didPrefillRef = useRef(false);
  useEffect(() => {
    if (didPrefillRef.current) return;
    didPrefillRef.current = true;
    (async () => {
      if (!params.mobile) {
        try { const last = await getLastMobile(); if (last) setMobile(m => (m ? m : last)); } catch {}
      }
    })();
  }, [params.mobile]);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{ mpinStatus: boolean; isRegistered: boolean; roleName: string | null } | null>(null);
  // MPIN as 4 digits (UI: 4 inputs) - reused for login or creation
  const [mpinDigits, setMpinDigits] = useState<string[]>(['', '', '', '']);
  // MPIN attempt tracking (max 3 tries before temporary lock / redirect)
  const MAX_ATTEMPTS = 3;
  const [attemptsLeft, setAttemptsLeft] = useState<number>(MAX_ATTEMPTS);
  const [mpinError, setMpinError] = useState<string | null>(null);
  const mpinShake = useRef(new Animated.Value(0)).current; // for shake animation on error
  const mpinRef1 = useRef<TextInput>(null);
  const mpinRef2 = useRef<TextInput>(null);
  const mpinRef3 = useRef<TextInput>(null);
  const mpinRef4 = useRef<TextInput>(null);
  const mpinRefs = useMemo(() => [mpinRef1, mpinRef2, mpinRef3, mpinRef4], []);
  const fullNameRef = useRef<TextInput>(null);
  const mobileRef = useRef<TextInput>(null);
  const scrollYAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<any>(null); // Animated.ScrollView ref
  // Dynamic layout + keyboard awareness
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [loginSuccessMsg, setLoginSuccessMsg] = useState<string | null>(null);
  // Track current scroll position for debugging
  const scrollYRef = useRef(0);
  // Track which field is focused for styling & scroll
  const [focusedField, setFocusedField] = useState<'mobile' | 'fullName' | 'mpin' | null>(null);
  const [focusedMpinIndex, setFocusedMpinIndex] = useState<number | null>(null);
  // Auto-clear transient success messages after a short delay
  useEffect(() => {
    if (!loginSuccessMsg) return;
    const t = setTimeout(() => {
      setLoginSuccessMsg(null);
    }, 3500);
    return () => clearTimeout(t);
  }, [loginSuccessMsg]);
  // Keyboard listeners
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow', (e:any) => {
      setKeyboardHeight(e?.endCoordinates?.height || 0);
    });
    const hide = Keyboard.addListener(Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // Inline register fields
  const [fullName, setFullName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const submittingRef = useRef(false);
  // Forgot MPIN multi-step modal state
  const [showReset, setShowReset] = useState(false);
  type ResetStage = 'request' | 'verify' | 'set';
  const [resetStage, setResetStage] = useState<ResetStage>('request');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCorrelationId, setResetCorrelationId] = useState<string | null>(null);
  // OTP
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const otpRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const otpTimerRef = useRef<NodeJS.Timeout | null>(null);
  // New MPIN
  const [resetNew, setResetNew] = useState(['', '', '', '']);
  const [resetConfirm, setResetConfirm] = useState(['', '', '', '']);
  const resetNewRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const resetConfirmRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const [settingMpin, setSettingMpin] = useState(false);
  // Congrats animation state
  const [showCongrats, setShowCongrats] = useState(false);
  // If user finishes entering MPIN before mpin-status completes, we stage it here
  const pendingAutoMpinRef = useRef<string | null>(null);

  // Centralize persistence so we fully replace any guest tokens with upgraded auth
  const persistAuthResponse = useCallback(async (data: any) => {
    try {
      const jwt = data.jwt || data.token;
      const refreshToken = data.refreshToken;
      const expiresIn = data.expiresIn || data.expiresInSec;
      const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
      const user = data.user;
      const languageId = user?.languageId || data.languageId;
      await saveTokens({ jwt, refreshToken, expiresAt, user, languageId });
  if (user?.role) await AsyncStorage.setItem('profile_role', user.role);
  // Persist authenticated session flag (replaces legacy is_guest_session logic)
  try { await AsyncStorage.setItem('is_authenticated', '1'); } catch {}
    } catch (e:any) {
      console.warn('persistAuthResponse failed', e.message);
    }
  }, []);

  // When mobile becomes 10 digits, fetch mpin status
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!/^\d{10}$/.test(mobile)) { setStatus(null); return; }
      setChecking(true);
      try {
  const res = await getMpinStatus(mobile);
  const r: any = res as any;
  // Backend might return isRegistered OR typo variants (isRegiter / isRegister / registered)
  const isRegisteredResolved = (r.isRegistered ?? r.isRegiter ?? r.isRegister ?? r.registered) ?? false;
  // Normalize: if backend omits isRegistered but mpinStatus true or roleName present, assume registered
  const normalizedIsRegistered = !!(isRegisteredResolved || r.mpinStatus || r.roleName);
  if (!cancelled) setStatus({ mpinStatus: !!r.mpinStatus, isRegistered: normalizedIsRegistered, roleName: r.roleName });
        try { console.log('[UI] mpin-status', { res }); } catch {}
      } catch (e:any) {
        if (!cancelled) setStatus(null);
        try { console.warn('[UI] mpin-status fail', e?.message); } catch {}
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mobile]);

  // Enhanced ensureVisible: multiple timed re-measures + final fallback scrollToEnd
  const ensureVisible = useCallback((ref: React.RefObject<any>, attempt: number = 0) => {
    if (!ref?.current) return;
    const delays = [30, 140, 260, 420]; // progressive delays to wait for keyboard animation
    const delay = delays[attempt] ?? 420;
    setTimeout(() => {
      (ref.current as any).measureInWindow?.((x: number, y: number, width: number, height: number) => {
        if (typeof y !== 'number' || typeof height !== 'number') return;
        const winH = Dimensions.get('window').height;
        const kb = keyboardHeight || 0;
        const bottomSpace = winH - (y + height);
        const neededPadding = 28; // a bit more breathing room
        if (bottomSpace < kb + neededPadding) {
          const delta = (kb + neededPadding) - bottomSpace;
          // Adjust for dynamic collapsing header: reduce scroll if header already collapsed
          let headerCurrentHeight = headerMaxHeight; // fallback
          try {
            // Extract current animated value (not always synchronous but good heuristic)
            // @ts-ignore private access
            headerCurrentHeight = headerHeight?._value ?? headerMaxHeight;
          } catch {}
          const headerReduction = headerMaxHeight - headerCurrentHeight;
          // Slightly increase scroll delta per attempt to push further if earlier tries under-shoot
          const target = Math.max(0, scrollYRef.current + delta + attempt * 8 - headerReduction * 0.4);
          scrollViewRef.current?.scrollTo({ y: target, animated: true });
        }
        if (attempt < 3) {
          ensureVisible(ref, attempt + 1);
        } else {
          // Final verification + fallback
          setTimeout(() => {
            (ref.current as any).measureInWindow?.((x2: number, y2: number, w2: number, h2: number) => {
              const bottomSpace2 = winH - (y2 + h2);
              if (bottomSpace2 < kb + neededPadding) {
                // Last resort: scroll to end (we add dynamic bottom padding so this lifts the field)
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }
            });
          }, 140);
        }
      });
    }, delay);
  // Note: headerHeight is an Animated interpolation; accessing _value is heuristic and not stable.
  // We intentionally exclude it from deps to avoid re-creating callback every frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardHeight]);

  // Auto-focus logic based on registration status
  useEffect(() => {
    if (!status || checking) return;
    const focusTimeout = setTimeout(() => {
      if (status.isRegistered === true) {
        mpinRefs[0].current?.focus();
        ensureVisible(mpinRefs[0]);
      } else if (status.isRegistered === false) {
        fullNameRef.current?.focus();
        ensureVisible(fullNameRef);
      }
    }, 220);
    return () => clearTimeout(focusTimeout);
  }, [status, checking, mpinRefs, /* ensureVisible dep added below */ ensureVisible]);

  const mpin = useMemo(() => mpinDigits.join(''), [mpinDigits]);
  // Derived user type flags
  const isExistingUser = !!(status && status.isRegistered === true);
  const isNewUser = !!(status && status.isRegistered === false);
  // Helper to retain focus on the currently focused MPIN field
  const refocusCurrentMpin = useCallback(() => {
    try {
      let focusedIndex = -1;
      for (let i = 0; i < mpinRefs.length; i++) {
        const r = mpinRefs[i].current;
        if (r?.isFocused && r.isFocused()) { focusedIndex = i; break; }
      }
      // Default to first if none
      const target = focusedIndex >= 0 ? focusedIndex : 0;
      // Refocus shortly after state update so cleared boxes are ready
      setTimeout(() => { mpinRefs[target].current?.focus(); }, 60);
    } catch {}
  }, [mpinRefs]);
  const onLogin = useCallback(async (overrideMpin?: string) => {
    if (submittingRef.current) return;
    if (!/^\d{10}$/.test(mobile)) return Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number');
    const effectiveMpin = overrideMpin ?? mpin;
    if (!/^\d{4}$/.test(effectiveMpin)) return Alert.alert('Validation Error', 'Please enter your 4-digit MPIN');
    if (attemptsLeft <= 0) return; // locked
    submittingRef.current = true;
    const t0 = Date.now();
    try { console.log('[UI] MPIN login start', { mobileMasked: mobile.replace(/^(\d{3})\d+(\d{2})$/, '$1***$2') }); } catch {}
    try {
      const res = await loginWithMpin({ mobileNumber: mobile, mpin: effectiveMpin });
      await persistAuthResponse(res);
      try { console.log('[UI] MPIN login success', { ms: Date.now() - t0, role: res?.user?.role }); } catch {}
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
      // Enforce Citizen Reporter role
      const userRole = res?.user?.role;
      if (userRole && userRole !== 'CITIZEN_REPORTER') {
        Alert.alert('Access Restricted', 'You must be a Citizen Reporter to continue.');
        router.replace('/news');
        return;
      }
  // Persist mobile for next fast login
  try { await AsyncStorage.setItem('profile_mobile', mobile); await AsyncStorage.setItem('last_login_mobile', mobile); } catch {}
      setAttemptsLeft(MAX_ATTEMPTS);
      setMpinError(null);
      setLoginSuccessMsg('Login success');
      setShowCongrats(true);
      setTimeout(() => {
        setShowCongrats(false);
        if (params.from === 'post') {
          router.replace('/explore');
        } else if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/news');
        }
      }, 2000);
    } catch (e:any) {
      try { console.warn('[UI] MPIN login fail', { ms: Date.now() - t0, err: e?.message, status: e?.status }); } catch {}
      if (e?.status === 401) {
        const remaining = attemptsLeft - 1;
        setAttemptsLeft(remaining);
        // Clear only MPIN digits but preserve focus
        setMpinDigits(['', '', '', '']);
        if (remaining > 0) {
          setMpinError(`Incorrect MPIN. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
          refocusCurrentMpin();
        } else {
          setMpinError('Too many incorrect attempts. Redirecting...');
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
          setTimeout(() => { router.replace('/news'); }, 1200);
        }
      } else if (e?.status === 501) {
        Alert.alert('Server Error', e?.message || 'Login not implemented (501).');
      } else {
        Alert.alert('Login Failed', e?.message || 'Unable to sign in. Please try again.');
      }
    }
    submittingRef.current = false;
  }, [mobile, mpin, attemptsLeft, MAX_ATTEMPTS, params.from, router, persistAuthResponse, refocusCurrentMpin]);

  const onCreateCitizen = async () => {
    if (submittingRef.current) return;
    if (!/^\d{10}$/.test(mobile)) return Alert.alert('Validation Error', 'Please enter a valid 10-digit mobile number');
    if (!fullName.trim()) return Alert.alert('Validation Error', 'Please enter your full name');
    if (!/^\d{4}$/.test(mpin)) return Alert.alert('Validation Error', 'Please set a 4-digit MPIN');
    if (creating) return;
    submittingRef.current = true;
    setCreating(true);
    const t0 = Date.now();
    try { console.log('[UI] create citizen start'); } catch {}
    try {
      setLoadingContext(true);
      let languageId: string | undefined;
      try { const raw = await AsyncStorage.getItem('selectedLanguage'); if (raw) languageId = JSON.parse(raw)?.id; } catch {}
      if (!languageId) languageId = 'en';
      const device = await getDeviceIdentity();
      let pushToken: string | undefined; let location: any;
      try {
        const perms = await requestAppPermissions();
        pushToken = perms.pushToken;
        if (perms.coordsDetailed) {
          const cd = perms.coordsDetailed;
            location = {
              latitude: cd.latitude,
              longitude: cd.longitude,
              accuracyMeters: cd.accuracy,
              provider: 'fused',
              timestampUtc: new Date(cd.timestamp || Date.now()).toISOString(),
              placeId: null,
              placeName: perms.place?.fullName || perms.place?.name || null,
              address: perms.place?.fullName || null,
              source: 'foreground'
            };
        }
      } catch {}
      setLoadingContext(false);
      const res = await createCitizenReporterMobile({
        mobileNumber: mobile,
        mpin,
        fullName: fullName.trim(),
        deviceId: device.deviceId,
        pushToken,
        languageId,
        location,
      });
      await persistAuthResponse(res);
      try { console.log('[UI] create citizen success', { ms: Date.now() - t0, role: res.user?.role }); } catch {}
  try { await AsyncStorage.setItem('profile_mobile', mobile); await AsyncStorage.setItem('last_login_mobile', mobile); } catch {}
      setLoginSuccessMsg('Account created successfully');
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      setShowCongrats(true);
      setTimeout(() => {
        setShowCongrats(false);
        if (params.from === 'post') {
          router.replace('/explore');
        } else if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/news');
        }
      }, 2000);
    } catch (e:any) {
      try { console.warn('[UI] create citizen fail', { ms: Date.now() - t0, err: e?.message, status: e?.status }); } catch {}
      if (e?.status === 401) {
        // Treat as incorrect MPIN attempt for creation flow
        const remaining = attemptsLeft - 1;
        setAttemptsLeft(remaining);
        setMpinDigits(['', '', '', '']);
        if (remaining > 0) {
          Alert.alert('Incorrect MPIN', `MPIN incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, [
            { text: 'OK', onPress: () => refocusCurrentMpin() }
          ]);
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
        } else {
          Alert.alert('Too Many Attempts', 'Too many incorrect attempts. Returning to news.');
          try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
          setTimeout(() => { router.replace('/news'); }, 1200);
        }
      } else if (e?.status === 501) {
        Alert.alert('Server Error', e?.message || 'Registration not implemented (501).');
      } else {
        Alert.alert('Registration Failed', e?.message || 'Could not create account. Please try again.');
      }
    } finally {
      setCreating(false);
      submittingRef.current = false;
    }
  };

  const tryAutoSubmit = (nextDigits: string[]) => {
    const code = nextDigits.join('');
    if (!/^\d{4}$/.test(code)) return;
    // If mpin-status still loading or not yet resolved, stage and wait
    if (checking || !status) {
      pendingAutoMpinRef.current = code;
      return;
    }
    if (status.isRegistered === true) {
      onLogin(code);
    } else if (status.isRegistered === false && fullName.trim()) {
      onCreateCitizen();
    } else {
      // For new user without name yet, just wait (no alert)
      pendingAutoMpinRef.current = code;
    }
  };

  // When status completes (or user enters name later), process any pending auto MPIN
  useEffect(() => {
    if (checking) return;
    const code = pendingAutoMpinRef.current;
    if (!code || !/^\d{4}$/.test(code)) return;
    if (!status) return; // still no status
    if (status.isRegistered === true) {
      pendingAutoMpinRef.current = null;
      onLogin(code);
    } else if (status.isRegistered === false && fullName.trim()) {
      pendingAutoMpinRef.current = null;
      onCreateCitizen();
    }
    // Intentionally excluding onLogin/onCreateCitizen from deps to avoid replays; they are stable enough in this component scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, status, fullName]);

  // Stable press handler for login button (uses current mpin state)
  const handleLoginPress = useCallback(() => { onLogin(); }, [onLogin]);

  const handleDigitChange = (idx: number, val: string) => {
    const c = val.replace(/\D/g, '').slice(-1);
    const next = [...mpinDigits];
    next[idx] = c;
    setMpinDigits(next);
    if (mpinError) setMpinError(null);
    if (loginSuccessMsg) setLoginSuccessMsg(null);
    
    // Smart navigation between MPIN inputs - but keep keyboard stable
    if (c && idx < 3) {
      // Move to next input with minimal delay to prevent keyboard flicker
      setTimeout(() => {
        mpinRefs[idx + 1].current?.focus();
      }, 30);
    }
    // On last digit entered dismiss keyboard (after slight delay)
    if (idx === 3 && c) {
      const code = next.join('');
      if (/^\d{4}$/.test(code)) {
        setTimeout(() => {
          Keyboard.dismiss();
          tryAutoSubmit(next);
        }, 80);
      }
    }
  };

  const handleKeyPress = (idx: number, key: string) => {
    if (key === 'Backspace') {
      if (!mpinDigits[idx] && idx > 0) {
        // If current field is empty and backspace is pressed, go to previous field
        setTimeout(() => {
          mpinRefs[idx - 1].current?.focus();
        }, 30);
      }
      // Don't manually clear - let onChangeText handle it naturally
    }
  };

  // Shake animation when mpinError changes
  useEffect(() => {
    if (mpinError) {
      mpinShake.setValue(0);
      Animated.sequence([
        Animated.timing(mpinShake, { toValue: 1, duration: 40, useNativeDriver: true }),
        Animated.timing(mpinShake, { toValue: -1, duration: 40, useNativeDriver: true }),
        Animated.timing(mpinShake, { toValue: 0.7, duration: 40, useNativeDriver: true }),
        Animated.timing(mpinShake, { toValue: -0.7, duration: 40, useNativeDriver: true }),
        Animated.timing(mpinShake, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start();
    }
  }, [mpinError, mpinShake]);

  const shakeStyle = useMemo(() => ({
    transform: [{ translateX: mpinShake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }]
  }), [mpinShake]);

  // Forgot MPIN support (local-only placeholder)
  const handleResetDigit = (
    arr: string[],
    setArr: (v: string[]) => void,
    index: number,
    val: string,
    refs: (React.RefObject<TextInput | null>)[]
  ) => {
    const c = val.replace(/\D/g, '').slice(-1);
    const next = [...arr];
    next[index] = c;
    setArr(next);
    if (c && index < 3) setTimeout(() => refs[index + 1].current?.focus(), 30);
    // Auto submit OTP when all digits filled
    if (refs === otpRefs && index === 3 && c) {
      const code = next.join('');
      if (/^\d{4}$/.test(code)) {
        setTimeout(() => { verifyOtp(); }, 80);
      }
    }
  };

  const handleResetKeyPress = (
    arr: string[],
    setArr: (v: string[]) => void,
    index: number,
    key: string,
    refs: (React.RefObject<TextInput | null>)[]
  ) => {
    if (key === 'Backspace') {
      if (!arr[index] && index > 0) {
        setTimeout(() => refs[index - 1].current?.focus(), 30);
      }
    }
  };
  // Derived codes & state helpers for reset
  const otpCode = otpDigits.join('');
  const resetNewCode = resetNew.join('');
  const resetConfirmCode = resetConfirm.join('');
  const canSetMpin = /^\d{4}$/.test(resetNewCode) && resetNewCode === resetConfirmCode && !settingMpin;

  useEffect(() => {
    if (otpResendCooldown <= 0) { if (otpTimerRef.current) { clearInterval(otpTimerRef.current); otpTimerRef.current = null; } return; }
    if (!otpTimerRef.current) {
      otpTimerRef.current = setInterval(() => { setOtpResendCooldown(v => (v > 0 ? v - 1 : 0)); }, 1000);
    }
    return () => { if (otpResendCooldown <= 0 && otpTimerRef.current) { clearInterval(otpTimerRef.current); otpTimerRef.current = null; } };
  }, [otpResendCooldown]);

  const startOtpRequest = async () => {
    if (resetLoading) return; setResetError(null); setResetLoading(true);
    try {
      const res = await requestOtpForMpinReset(mobile);
      setResetCorrelationId(res.id);
      setResetStage('verify');
      setOtpDigits(['', '', '', '']);
      setOtpResendCooldown(45);
      setTimeout(() => otpRefs[0].current?.focus(), 120);
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    } catch (e:any) {
      setResetError(e?.message || 'Failed to send OTP');
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
    } finally { setResetLoading(false); }
  };

  const resendOtp = async () => {
    if (otpResendCooldown > 0) return;
    try {
      const res = await requestOtpForMpinReset(mobile);
      setResetCorrelationId(res.id);
      setOtpDigits(['', '', '', '']);
      setOtpResendCooldown(45);
      setResetError(null);
      try { Haptics.selectionAsync(); } catch {}
    } catch (e:any) {
      setResetError(e?.message || 'Resend failed');
    }
  };

  const mapOtpError = (e:any): string => {
    const msg = (e?.message || '').toLowerCase();
    if (e?.status === 429) return 'Too many attempts. Please wait and try again.';
    if (e?.status === 410 || msg.includes('expired')) return 'OTP expired. Please resend.';
    if (e?.status === 400 && msg.includes('invalid')) return 'Invalid OTP. Check and try again.';
    return e?.message || 'OTP verification failed';
  };

  const verifyOtp = async () => {
    if (resetLoading) return; if (!/^\d{4}$/.test(otpCode) || !resetCorrelationId) return;
    setResetLoading(true); setResetError(null);
    try {
      await verifyOtpForMpinReset({ id: resetCorrelationId, otp: otpCode });
      setResetStage('set');
      setTimeout(() => resetNewRefs[0].current?.focus(), 140);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    } catch (e:any) {
      setResetError(mapOtpError(e));
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
    } finally { setResetLoading(false); }
  };

  const submitNewMpin = async () => {
    if (!canSetMpin || !resetCorrelationId) return;
    if (resetNewCode !== resetConfirmCode) { setResetError('Codes do not match'); return; }
    setSettingMpin(true); setResetError(null);
    try {
      await setNewMpin({ id: resetCorrelationId, mobileNumber: mobile, mpin: resetNewCode });
      setMpinDigits(resetConfirm);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      try { await AsyncStorage.setItem('profile_mobile', mobile); await AsyncStorage.setItem('last_login_mobile', mobile); } catch {}
      // Show congrats then close modal & focus
      setShowCongrats(true);
      setTimeout(() => {
        setShowCongrats(false);
        setShowReset(false);
        setResetStage('request');
        setResetCorrelationId(null);
        setResetNew(['', '', '', '']);
        setResetConfirm(['', '', '', '']);
        setOtpDigits(['', '', '', '']);
        setTimeout(() => mpinRefs[0].current?.focus(), 120);
      }, 2000);
    } catch (e:any) {
      setResetError(e?.message || 'Failed to set MPIN');
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
    } finally { setSettingMpin(false); }
  };

  const closeReset = () => {
    setShowReset(false); setResetStage('request'); setResetCorrelationId(null); setOtpDigits(['', '', '', '']); setResetNew(['', '', '', '']); setResetConfirm(['', '', '', '']); setResetError(null); setResetLoading(false); setSettingMpin(false);
  };

  // Handle mobile number input with better formatting
  const handleMobileChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 10);
    setMobile(cleaned);
    setStatus(null);
    setMpinDigits(['', '', '', '']);
    setAttemptsLeft(MAX_ATTEMPTS);
    setMpinError(null);
    // Clear any lingering success message when user edits mobile number
    if (loginSuccessMsg) setLoginSuccessMsg(null);
    
    // If 10 digits entered, prepare for auto-focus transition
    if (cleaned.length === 10) {
      // Blur mobile input after a short delay to prepare for next field focus
      setTimeout(() => {
        mobileRef.current?.blur();
      }, 200);
    }
  };

  // Handle full name input with proper validation
  const handleNameChange = (text: string) => {
    // Allow letters, spaces, and common name characters
    const cleaned = text.replace(/[^a-zA-Z\s.-]/g, '').slice(0, 50);
    setFullName(cleaned);
  };


  // Removed detailed location prefill; location gathered only when creating account.

  // Collapsing header interpolations
  const headerMaxHeight = 180;
  const headerMinHeight = 72;
  const logoMax = 64;
  const logoMin = 36;
  const headerHeight = scrollYAnim.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [headerMaxHeight, headerMinHeight],
    extrapolate: 'clamp'
  });
  const logoSize = scrollYAnim.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [logoMax, logoMin],
    extrapolate: 'clamp'
  });
  const logoRadius = Animated.divide(logoSize, new Animated.Value(2));
  const brandFont = scrollYAnim.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [24, 18],
    extrapolate: 'clamp'
  });
  const subtitleOpacity = scrollYAnim.interpolate({
    inputRange: [0, 40, 100],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp'
  });
  const headerElevation = scrollYAnim.interpolate({
    inputRange: [0, headerMaxHeight - headerMinHeight],
    outputRange: [0, 4],
    extrapolate: 'clamp'
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Animated Header overlays top */}
        <Animated.View style={[styles.animatedHeader, { height: headerHeight, elevation: headerElevation, shadowOpacity: headerElevation.interpolate({inputRange:[0,4], outputRange:[0,0.15]}) }]}>          
          <View style={styles.headerInner}>            
            <Animated.View style={[styles.logoCircle, { width: logoSize, height: logoSize, borderRadius: logoRadius, marginBottom: 8 }]}>              
              <Text style={styles.logoText}>K</Text>
            </Animated.View>
            <Animated.Text style={[styles.brandName, { fontSize: brandFont }]}>KhabarX</Animated.Text>
            <Animated.Text style={[styles.welcomeText, { opacity: subtitleOpacity }]}>Welcome to Citizen Journalism</Animated.Text>
            <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>Enter your mobile number to continue</Animated.Text>
          </View>
        </Animated.View>

        <Animated.ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={[styles.scrollContainer, { paddingTop: headerMaxHeight + 12 }, keyboardHeight ? { paddingBottom: keyboardHeight + 64 } : null]} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          nestedScrollEnabled={true}
          scrollEventThrottle={16}
          onScroll={Animated.event([
            { nativeEvent: { contentOffset: { y: scrollYAnim } } }
          ], { useNativeDriver: false, listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => { scrollYRef.current = e.nativeEvent.contentOffset.y; } })}
        >
  {/* Main Card */}
        <View style={styles.card}>
          {/* Mobile Number Section (hidden once we know user is registered) */}
          {(!status || isNewUser) && (
            <View style={styles.inputSection}>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.phoneInputContainer}>
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  ref={mobileRef}
                  value={mobile}
                  onChangeText={handleMobileChange}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  style={[styles.phoneInput, focusedField === 'mobile' && styles.focusedInput]}
                  placeholderTextColor="#9CA3AF"
                  autoFocus={!params.mobile}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  textContentType="telephoneNumber"
                  selectTextOnFocus
                  onFocus={() => { setFocusedField('mobile'); ensureVisible(mobileRef); }}
                />
              </View>
              {checking && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={Colors.light.secondary} />
                  <Text style={styles.loadingText}>Verifying mobile number...</Text>
                </View>
              )}
            </View>
          )}

          {/* Existing User Login */}
          {isExistingUser && (
            <View style={styles.loginSection}>
              {/* Masked mobile + change action */}
              <View style={styles.maskedMobileRow}>
                <Text style={styles.maskedMobileText}>+91 {mobile.replace(/^(\d{3})\d{4}(\d{3})$/, '$1****$2')}</Text>
                <Pressable onPress={() => {
                  // Reset state to allow editing mobile again
                  setStatus(null);
                  setMpinDigits(['', '', '', '']);
                  setAttemptsLeft(MAX_ATTEMPTS);
                  setFocusedField('mobile');
                  setTimeout(() => { mobileRef.current?.focus(); ensureVisible(mobileRef); }, 60);
                }}>
                  <Text style={styles.changeNumberText}>Change Number</Text>
                </Pressable>
              </View>
              <View style={styles.sectionHeader}>
                <View style={styles.checkIcon}>
                  <Text style={styles.checkIconText}>✓</Text>
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Welcome Back!</Text>
                  <Text style={styles.sectionSubtitle}>Enter your MPIN to continue</Text>
                </View>
              </View>
              
              <Text style={styles.label}>4-Digit MPIN</Text>
              <Animated.View style={[styles.mpinContainer, mpinError ? shakeStyle : null]}>
                {mpinRefs.map((ref, i) => (
                  <View key={i} style={styles.mpinBoxContainer}>
                    <TextInput
                      ref={ref}
                      value={mpinDigits[i]}
                      onChangeText={(v) => handleDigitChange(i, v)}
                      onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={1}
                      secureTextEntry
                      blurOnSubmit={false}
                      returnKeyType={i === 3 ? 'done' : 'next'}
                      selectTextOnFocus
                      textContentType="oneTimeCode"
                      caretHidden={false}
                      contextMenuHidden={true}
                      autoFocus={false}
                      onFocus={() => { setFocusedField('mpin'); setFocusedMpinIndex(i); ensureVisible(ref); }}
                      onSubmitEditing={() => {
                        if (i < 3) {
                          mpinRefs[i + 1].current?.focus();
                        }
                      }}
                      style={[styles.mpinBox, mpinDigits[i] && styles.mpinBoxFilled, focusedField === 'mpin' && focusedMpinIndex === i && styles.focusedMpinBox]}
                    />
                  </View>
                ))}
              </Animated.View>
              {mpinError && (
                <Text style={styles.mpinErrorText}>{mpinError}</Text>
              )}
              {!mpinError && loginSuccessMsg && (
                <Text style={styles.loginSuccessText}>{loginSuccessMsg}</Text>
              )}
              {!mpinError && !loginSuccessMsg && (
                <Pressable onPress={() => { setShowReset(true); setResetStage('request'); setResetError(null); }} style={{ alignSelf: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: Colors.light.secondary, fontWeight: '600' }}>Forgot MPIN?</Text>
                </Pressable>
              )}
              {!mpinError && !loginSuccessMsg && (
                <Pressable onPress={() => Alert.alert('MPIN Tips', 'Choose a 4-digit number that is easy for you and hard for others.')} style={{ alignSelf: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: Colors.light.secondary, fontWeight: '600' }}>Need help choosing?</Text>
                </Pressable>
              )}
              
              <Pressable 
                style={[styles.primaryButton, (checking || !mpin || mpin.length !== 4 || attemptsLeft <= 0) && styles.disabledButton]} 
                onPress={handleLoginPress} 
                disabled={checking || !mpin || mpin.length !== 4 || attemptsLeft <= 0}
              >
                <Text style={styles.primaryButtonText}>
                  {attemptsLeft <= 0 ? 'Locked' : (checking ? 'Signing In...' : 'Sign In')}
                </Text>
              </Pressable>
            </View>
          )}

          {/* New User Registration */}
          {isNewUser && (
            <View style={styles.registerSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.newUserIcon}>
                  <Text style={styles.newUserIconText}>+</Text>
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Create Account</Text>
                  <Text style={styles.sectionSubtitle}>Join as a Citizen Reporter</Text>
                </View>
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput 
                  ref={fullNameRef}
                  value={fullName} 
                  onChangeText={handleNameChange} 
                  placeholder="Enter your full name" 
                  style={[styles.textInput, focusedField === 'fullName' && styles.focusedInput]}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  autoComplete="name"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  textContentType="name"
                  selectTextOnFocus
                  onFocus={() => { setFocusedField('fullName'); ensureVisible(fullNameRef); }}
                  onSubmitEditing={() => {
                    setTimeout(() => {
                      mpinRefs[0].current?.focus();
                      ensureVisible(mpinRefs[0]);
                      setTimeout(() => ensureVisible(mpinRefs[0]), 160);
                    }, 60);
                  }}
                />
              </View>

              <View style={styles.inputSection}>
                <Text style={styles.label}>Create 4-Digit MPIN</Text>
                <Animated.View style={[styles.mpinContainer, mpinError ? shakeStyle : null]}>
                  {mpinRefs.map((ref, i) => (
                    <View key={i} style={styles.mpinBoxContainer}>
                      <TextInput
                        ref={ref}
                        value={mpinDigits[i]}
                        onChangeText={(v) => handleDigitChange(i, v)}
                        onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                        keyboardType="number-pad"
                        maxLength={1}
                        secureTextEntry
                        blurOnSubmit={false}
                        returnKeyType={i === 3 ? 'done' : 'next'}
                        selectTextOnFocus
                        textContentType="oneTimeCode"
                        caretHidden={false}
                        contextMenuHidden={true}
                        autoFocus={false}
                        onFocus={() => { setFocusedField('mpin'); setFocusedMpinIndex(i); ensureVisible(ref); }}
                        onSubmitEditing={() => {
                          if (i < 3) {
                            mpinRefs[i + 1].current?.focus();
                          }
                        }}
                        style={[styles.mpinBox, mpinDigits[i] && styles.mpinBoxFilled, focusedField === 'mpin' && focusedMpinIndex === i && styles.focusedMpinBox]}
                      />
                    </View>
                  ))}
                </Animated.View>
              </View>

              <Pressable 
                style={[styles.primaryButton, (creating || loadingContext || !fullName.trim() || mpin.length !== 4) && styles.disabledButton]} 
                onPress={onCreateCitizen} 
                disabled={creating || loadingContext || !fullName.trim() || mpin.length !== 4}
              >
                <Text style={styles.primaryButtonText}>
                  {creating ? 'Creating Account...' : 'Create Account'}
                </Text>
              </Pressable>
              
              {loadingContext && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={Colors.light.secondary} />
                  <Text style={styles.loadingText}>Setting up your account...</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </Animated.ScrollView>
      {/* Forgot MPIN Modal */}
      <Modal visible={showReset} transparent animationType="fade" onRequestClose={closeReset}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset MPIN</Text>
            {resetStage === 'request' && (
              <>
                <Text style={styles.modalSubtitle}>We will send a 4-digit OTP to +91 {mobile}</Text>
                <Pressable disabled={resetLoading || !/^\d{10}$/.test(mobile)} onPress={startOtpRequest} style={[styles.primaryButton, (!/^\d{10}$/.test(mobile) || resetLoading) && styles.disabledButton, { marginTop: 12 }]}> 
                  <Text style={styles.primaryButtonText}>{resetLoading ? 'Sending...' : 'Send OTP'}</Text>
                </Pressable>
              </>
            )}
            {resetStage === 'verify' && (
              <>
                <Text style={styles.modalSubtitle}>Enter OTP sent to +91 {mobile}</Text>
                <View style={styles.resetRow}>
                  {otpRefs.map((r, i) => (
                    <TextInput
                      key={i}
                      ref={r}
                      value={otpDigits[i]}
                      onChangeText={(v)=> handleResetDigit(otpDigits, setOtpDigits, i, v, otpRefs)}
                      onKeyPress={({ nativeEvent }) => handleResetKeyPress(otpDigits, setOtpDigits, i, nativeEvent.key, otpRefs)}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={[styles.resetBox, otpDigits[i] && styles.resetBoxFilled]}
                      onSubmitEditing={()=> { if (i<3) otpRefs[i+1].current?.focus(); else verifyOtp(); }}
                    />
                  ))}
                </View>
                <Pressable disabled={resetLoading || !/^\d{4}$/.test(otpCode)} onPress={verifyOtp} style={[styles.primaryButton, (!/^\d{4}$/.test(otpCode) || resetLoading) && styles.disabledButton]}> 
                  <Text style={styles.primaryButtonText}>{resetLoading ? 'Verifying...' : 'Verify OTP'}</Text>
                </Pressable>
                <Pressable disabled={otpResendCooldown>0 || resetLoading} onPress={resendOtp} style={{ alignSelf: 'center', marginTop: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: otpResendCooldown>0 ? '#9CA3AF' : Colors.light.secondary }}>
                    {otpResendCooldown>0 ? `Resend in ${otpResendCooldown}s` : 'Resend OTP'}
                  </Text>
                </Pressable>
                {!resetError && otpResendCooldown>0 && (
                  <Text style={{ fontSize: 11, textAlign: 'center', color: '#6B7280', marginTop: 6 }}>Waiting helps protect your account.</Text>
                )}
              </>
            )}
            {resetStage === 'set' && (
              <>
                <Text style={styles.modalSubtitle}>Create and confirm your new MPIN</Text>
                <Text style={styles.modalLabel}>New MPIN</Text>
                <View style={styles.resetRow}>
                  {resetNewRefs.map((r, i) => (
                    <TextInput
                      key={i}
                      ref={r}
                      value={resetNew[i]}
                      onChangeText={(v)=> handleResetDigit(resetNew, setResetNew, i, v, resetNewRefs)}
                      onKeyPress={({ nativeEvent }) => handleResetKeyPress(resetNew, setResetNew, i, nativeEvent.key, resetNewRefs)}
                      keyboardType="number-pad"
                      maxLength={1}
                      secureTextEntry
                      style={[styles.resetBox, resetNew[i] && styles.resetBoxFilled]}
                      onSubmitEditing={()=> { if (i<3) resetNewRefs[i+1].current?.focus(); }}
                    />
                  ))}
                </View>
                <Text style={styles.modalLabel}>Confirm MPIN</Text>
                <View style={styles.resetRow}>
                  {resetConfirmRefs.map((r, i) => (
                    <TextInput
                      key={i}
                      ref={r}
                      value={resetConfirm[i]}
                      onChangeText={(v)=> handleResetDigit(resetConfirm, setResetConfirm, i, v, resetConfirmRefs)}
                      onKeyPress={({ nativeEvent }) => handleResetKeyPress(resetConfirm, setResetConfirm, i, nativeEvent.key, resetConfirmRefs)}
                      keyboardType="number-pad"
                      maxLength={1}
                      secureTextEntry
                      style={[styles.resetBox, resetConfirm[i] && styles.resetBoxFilled]}
                      onSubmitEditing={()=> { if (i<3) resetConfirmRefs[i+1].current?.focus(); }}
                    />
                  ))}
                </View>
                <Pressable disabled={!canSetMpin || settingMpin} onPress={submitNewMpin} style={[styles.primaryButton, (!canSetMpin || settingMpin) && styles.disabledButton]}> 
                  <Text style={styles.primaryButtonText}>{settingMpin ? 'Saving...' : 'Save New MPIN'}</Text>
                </Pressable>
              </>
            )}
            {resetError && <Text style={styles.resetError}>{resetError}</Text>}
            <View style={styles.resetActions}>
              <Pressable onPress={closeReset} style={[styles.resetButton, styles.resetCancel]}> 
                <Text style={styles.resetCancelText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
      {/* Congrats Overlay */}
      {showCongrats && (
        <View style={styles.congratsOverlay} pointerEvents="none">
          <View style={styles.congratsInner}>
            <LottieView source={require('@/assets/lotti/congratulation.json')} autoPlay loop={false} style={{ width: 240, height: 240 }} />
            <Text style={styles.congratsText}>Success!</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  animatedHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000'
  },
  headerInner: {
    alignItems: 'center'
  },
  safe: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
  },
  scrollContainer: { 
    flexGrow: 1, 
    padding: 16,
    paddingTop: 8
  },
  backButtonContainer: {
    marginBottom: 16
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(3, 37, 87, 0.1)'
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary
  },
  header: {
    alignItems: 'center',
    marginBottom: 32
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  logoText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff'
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.light.primary,
    letterSpacing: 0.5
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6
  },
  inputSection: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 4
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
    marginRight: 12,
    paddingVertical: 12
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 12,
    fontWeight: '500'
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    fontSize: 16,
    color: '#111827',
    fontWeight: '500'
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500'
  },
  loginSection: {
    marginTop: 16
  },
  maskedMobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  maskedMobileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937'
  },
  changeNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.secondary
  },
  registerSection: {
    marginTop: 16
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  checkIconText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff'
  },
  newUserIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  newUserIconText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff'
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827'
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2
  },
  mpinContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 20
  },
  mpinBoxContainer: {
    flex: 1,
    marginHorizontal: 4
  },
  mpinBox: {
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 16,
    fontSize: 24,
    fontWeight: '700',
    backgroundColor: '#F9FAFB',
    color: '#111827'
  },
  mpinBoxFilled: {
    borderColor: Colors.light.primary,
    backgroundColor: '#EFF6FF'
  },
  mpinErrorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 12,
    textAlign: 'center'
  },
  loginSuccessText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 12,
    textAlign: 'center'
  },
  focusedInput: {
    borderColor: Colors.light.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3
  },
  focusedMpinBox: {
    borderColor: Colors.light.secondary,
    backgroundColor: '#FFF',
    transform: [{ scale: 1.03 }]
  },
  primaryButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5
  },
  footer: {
    paddingHorizontal: 8,
    marginBottom: 20
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 20
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8
  },
  resetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  resetBox: {
    flex: 1,
    marginHorizontal: 4,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '700',
    backgroundColor: '#F9FAFB',
    color: '#111827'
  },
  resetBoxFilled: {
    borderColor: Colors.light.primary,
    backgroundColor: '#EFF6FF'
  },
  resetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginLeft: 12
  },
  resetCancel: {
    backgroundColor: '#E5E7EB'
  },
  resetPrimary: {
    backgroundColor: Colors.light.primary
  },
  resetDisabled: {
    backgroundColor: '#9CA3AF'
  },
  resetCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151'
  },
  resetPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff'
  },
  resetError: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 4
  },
  congratsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  congratsInner: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  congratsText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.primary,
    marginTop: -12
  }
});
