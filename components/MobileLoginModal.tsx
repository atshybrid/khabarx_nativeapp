import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createCitizenReporterMobile, getMpinStatus, loginWithMpin } from '../services/api';
import { gatherRegistrationContext } from '../services/contextGather';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (data: { jwt: string; refreshToken: string; user?: any }) => void;
}

// States: idle (typing mobile), mpin (existing user w/ mpin), register (needs creation)
type Status = 'idle' | 'mpin' | 'register';

export default function MobileLoginModal({ visible, onClose, onSuccess }: Props) {
  const [mobile, setMobile] = useState('');
  const [mpin, setMpin] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const lookedUpRef = useRef<string | null>(null);
  // React Native setTimeout returns NodeJS.Timeout; use appropriate type
  const lookupTimer = useRef<NodeJS.Timeout | null>(null);
  // Input refs and focus guards
  const mobileRef = useRef<TextInput>(null);
  const mpinRef = useRef<TextInput>(null);
  const fullNameRef = useRef<TextInput>(null);
  const mpinAutofocusedRef = useRef<boolean>(false);
  const didAutoBlurMpinRef = useRef<boolean>(false);

  const reset = () => {
    setMobile(''); setMpin(''); setFullName(''); setStatus('idle'); setError(null); setRoleName(null); setIsRegistered(null); lookedUpRef.current = null;
    mpinAutofocusedRef.current = false;
    didAutoBlurMpinRef.current = false;
  };

  // Debounced auto lookup when 10 digits entered OR when user presses Continue
  const triggerLookup = (force = false) => {
    console.log('[MOBILE_LOGIN] triggerLookup called', { mobile, force, length: mobile.length, alreadyLookedUp: lookedUpRef.current });
    
    if (lookupTimer.current) { 
      console.log('[MOBILE_LOGIN] Clearing existing timer');
      clearTimeout(lookupTimer.current); 
      lookupTimer.current = null; 
    }
    
    if (mobile.length !== 10) {
      console.log('[MOBILE_LOGIN] Mobile length not 10, skipping lookup');
      return;
    }
    
    if (!force && lookedUpRef.current === mobile) {
      console.log('[MOBILE_LOGIN] Already looked up this number, skipping');
      return; // already looked
    }
    
    console.log('[MOBILE_LOGIN] Setting timer for lookup', { delay: force ? 0 : 350 });
    lookupTimer.current = setTimeout(async () => {
      console.log('[MOBILE_LOGIN] Timer fired, starting API call');
      setError(null);
      setLoading(true);
      
      try {
        console.log('[MOBILE_LOGIN] Calling getMpinStatus API', { mobile });
        const res: any = await getMpinStatus(mobile);
        console.log('[MOBILE_LOGIN] getMpinStatus response', res);
        
        const registered = res.isRegistered !== undefined ? res.isRegistered : !!res.mpinStatus || !!res.roleName;
        console.log('[MOBILE_LOGIN] Determined registration status', { 
          registered, 
          isRegistered: res.isRegistered, 
          mpinStatus: res.mpinStatus, 
          roleName: res.roleName 
        });
        
        setIsRegistered(registered);
        setRoleName(res.roleName || null);
        
        if (registered && res.mpinStatus) {
          console.log('[MOBILE_LOGIN] Setting status to mpin');
          setStatus('mpin');
        } else {
          console.log('[MOBILE_LOGIN] Setting status to register');
          setStatus('register');
        }
        
        lookedUpRef.current = mobile;
        console.log('[MOBILE_LOGIN] Lookup completed successfully');
        
      } catch (e: any) {
        console.error('[MOBILE_LOGIN] Lookup failed', e);
        console.log('[MOBILE_LOGIN] Full error object', { 
          message: e?.message, 
          status: e?.status, 
          body: e?.body,
          stack: e?.stack 
        });
        setError(e?.message || 'Lookup failed');
        setStatus('idle');
      } finally { 
        console.log('[MOBILE_LOGIN] Setting loading to false');
        setLoading(false); 
      }
    }, force ? 0 : 350); // small debounce
  };

  // Auto lookup when 10 digits entered
  useEffect(() => {
    console.log('[MOBILE_LOGIN] useEffect triggered', { mobile, length: mobile.length });
    
    if (mobile.length === 10) {
      console.log('[MOBILE_LOGIN] Mobile is 10 digits, triggering lookup');
      triggerLookup(false);
    } else {
      console.log('[MOBILE_LOGIN] Mobile not 10 digits, resetting state');
      setStatus('idle'); 
      setIsRegistered(null); 
      setRoleName(null); 
      lookedUpRef.current = null;
    }
    // triggerLookup intentionally not added to deps to avoid recreating timers on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile]);

  // Manage initial focus when switching to sections, but avoid re-opening after auto-blur
  useEffect(() => {
    if (!visible) return;
    if (status === 'mpin') {
      // Focus MPIN only once when empty and not loading
      if (!mpin && !loading && !mpinAutofocusedRef.current) {
        mpinAutofocusedRef.current = true;
        setTimeout(() => mpinRef.current?.focus(), 150);
      }
    } else if (status === 'register') {
      // Focus full name first time
      if (!fullName && !loading) {
        setTimeout(() => fullNameRef.current?.focus(), 150);
      }
    }
  }, [status, visible, mpin, loading, fullName]);

  // When MPIN reaches 4 digits, blur and dismiss keyboard exactly once
  useEffect(() => {
    if (status === 'mpin' && mpin.length >= 4 && !didAutoBlurMpinRef.current) {
      didAutoBlurMpinRef.current = true;
      mpinRef.current?.blur();
      Keyboard.dismiss();
    }
    if (mpin.length < 4) {
      // Allow another auto-blur after corrections
      didAutoBlurMpinRef.current = false;
    }
  }, [mpin, status]);

  const doLogin = async () => {
    console.log('[MOBILE_LOGIN] doLogin called', { mobile, mpinLength: mpin.length, loading });
    
    if (loading) {
      console.log('[MOBILE_LOGIN] Already loading, preventing double tap');
      return; // prevent double tap
    }
    
    setError(null);
    // Close keyboard for clearer progress feedback
    Keyboard.dismiss();
    
    if (!/^\d{4}$/.test(mpin)) { 
      console.log('[MOBILE_LOGIN] Invalid MPIN format');
      setError('Enter 4 digit MPIN'); 
      return; 
    }
    
    console.log('[MOBILE_LOGIN] Starting login process');
    setLoading(true);
    
    try {
      console.log('[MOBILE_LOGIN] Calling loginWithMpin API');
      const data = await loginWithMpin({ mobileNumber: mobile, mpin });
      console.log('[MOBILE_LOGIN] Login successful', { hasJwt: !!data.jwt, hasUser: !!data.user });
      
      await AsyncStorage.setItem('jwt', data.jwt);
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
      if (data.user?.languageId) await AsyncStorage.setItem('languageId', data.user.languageId);
      
      console.log('[MOBILE_LOGIN] Calling onSuccess callback');
      onSuccess({ jwt: data.jwt, refreshToken: data.refreshToken, user: data.user });
      reset();
    } catch (e: any) {
      console.error('[MOBILE_LOGIN] Login failed', e);
      setError(e?.message || 'Login failed');
    } finally { 
      console.log('[MOBILE_LOGIN] Login process finished');
      setLoading(false); 
    }
  };

  const doRegister = async () => {
    console.log('[MOBILE_LOGIN] doRegister called', { mobile, fullName: fullName.trim(), mpinLength: mpin.length, loading });
    
    if (loading) {
      console.log('[MOBILE_LOGIN] Already loading, preventing double submission');
      return;
    }
    
    setError(null);
  Keyboard.dismiss();
    
    if (!fullName.trim()) { 
      console.log('[MOBILE_LOGIN] Full name missing');
      setError('Enter full name'); 
      return; 
    }
    
    if (!/^\d{4}$/.test(mpin)) { 
      console.log('[MOBILE_LOGIN] Invalid MPIN format');
      setError('Set a 4 digit MPIN'); 
      return; 
    }
    
    console.log('[MOBILE_LOGIN] Starting registration process');
    setLoading(true);
    
    try {
      console.log('[MOBILE_LOGIN] Gathering registration context');
      const ctx = await gatherRegistrationContext();
      console.log('[MOBILE_LOGIN] Registration context', { hasLanguageId: !!ctx.languageId, hasLocation: !!ctx.location, hasPushToken: !!ctx.pushToken });
      
      if (!ctx.languageId) {
        console.log('[MOBILE_LOGIN] No languageId in context, trying AsyncStorage fallback');
        // fallback read selectedLanguage object
        const raw = await AsyncStorage.getItem('selectedLanguage');
        if (raw) { 
          try { 
            ctx.languageId = JSON.parse(raw)?.id; 
            console.log('[MOBILE_LOGIN] Found languageId in AsyncStorage', ctx.languageId);
          } catch (e) {
            console.log('[MOBILE_LOGIN] Failed to parse selectedLanguage from AsyncStorage', e);
          }
        }
      }
      
      if (!ctx.languageId) {
        console.error('[MOBILE_LOGIN] No language ID available');
        throw new Error('Language not set');
      }
      
      const pseudoDeviceId = `dev_${Platform.OS}_${Math.random().toString(36).slice(2,10)}`;
      console.log('[MOBILE_LOGIN] Generated device ID', pseudoDeviceId);
      
      console.log('[MOBILE_LOGIN] Calling createCitizenReporterMobile API');
      const data = await createCitizenReporterMobile({
        mobileNumber: mobile,
        mpin,
        fullName: fullName.trim(),
        deviceId: pseudoDeviceId,
        pushToken: ctx.pushToken,
        languageId: ctx.languageId,
        location: ctx.location,
      });
      console.log('[MOBILE_LOGIN] Registration successful', { hasJwt: !!data.jwt, hasUser: !!data.user });
      
      await AsyncStorage.setItem('jwt', data.jwt);
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
      if (data.user?.languageId) await AsyncStorage.setItem('languageId', data.user.languageId);
      
      console.log('[MOBILE_LOGIN] Calling onSuccess callback');
      onSuccess({ jwt: data.jwt, refreshToken: data.refreshToken, user: data.user });
      reset();
    } catch (e: any) {
      console.error('[MOBILE_LOGIN] Registration failed', e);
      console.log('[MOBILE_LOGIN] Full registration error', { 
        message: e?.message, 
        status: e?.status, 
        body: e?.body 
      });
      setError(e?.message || 'Registration failed');
    } finally { 
      console.log('[MOBILE_LOGIN] Registration process finished');
      setLoading(false); 
    }
  };
  const renderBody = () => {
    return (
      <>
        <Text style={styles.label}>Mobile Number</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          maxLength={10}
          value={mobile}
          ref={mobileRef}
          onChangeText={(t: string) => {
            const cleaned = t.replace(/\D/g, '');
            console.log('[MOBILE_LOGIN] Mobile input changed', { original: t, cleaned, length: cleaned.length });
            setMobile(cleaned);
          }}
          placeholder="Enter 10 digit mobile"
          editable={!loading}
        />
        {mobile.length === 10 && status === 'idle' && !loading && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => triggerLookup(true)}>
            <Text style={styles.secondaryText}>Continue</Text>
          </TouchableOpacity>
        )}
        {loading && mobile.length === 10 && (
          <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" />
            <Text style={{ fontSize: 12, color: '#475569' }}>Checking…</Text>
          </View>
        )}
        {status !== 'idle' && (
          <>
            <Text style={styles.mobileHeading}>{mobile}</Text>
            {roleName && status === 'mpin' && <Text style={styles.roleTag}>{roleName}</Text>}
          </>
        )}
        {status === 'mpin' && (
          <>
            <Text style={styles.label}>MPIN</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={mpin}
              onChangeText={setMpin}
              placeholder="Enter MPIN"
              ref={mpinRef}
              editable={!loading}
              blurOnSubmit
              onSubmitEditing={doLogin}
            />
            <TouchableOpacity style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]} onPress={doLogin} disabled={loading}>
              {loading ? (
                <View style={styles.rowCenter}>
                  <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryText}>Logging in…</Text>
                </View>
              ) : (
                <Text style={styles.primaryText}>Login</Text>
              )}
            </TouchableOpacity>
          </>
        )}
        {status === 'register' && (
          <>
            {!isRegistered && <Text style={styles.subtle}>New user • Create account</Text>}
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              ref={fullNameRef}
              editable={!loading}
            />
            <Text style={styles.label}>Set MPIN</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
              value={mpin}
              onChangeText={setMpin}
              placeholder="4 digit MPIN"
              editable={!loading}
            />
            <TouchableOpacity style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]} onPress={doRegister} disabled={loading}>
              {loading ? (
                <View style={styles.rowCenter}>
                  <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryText}>Creating…</Text>
                </View>
              ) : (
                <Text style={styles.primaryText}>Create & Login</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Citizen Reporter</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {renderBody()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  close: { fontSize: 18 },
  label: { marginTop: 12, marginBottom: 4, fontWeight: '500', fontSize: 13, color: '#333' },
  input: { backgroundColor: '#f3f4f6', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, fontSize: 15 },
  primaryBtn: { backgroundColor: '#2563eb', paddingVertical: 12, alignItems: 'center', borderRadius: 8, marginTop: 20 },
  primaryBtnDisabled: { opacity: 0.8 },
  primaryText: { color: '#fff', fontWeight: '600' },
  error: { color: '#dc2626', marginTop: 8 },
  mobileHeading: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  roleTag: { backgroundColor: '#e0f2fe', color: '#075985', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6, alignSelf: 'flex-start', fontSize: 12 },
  subtle: { color: '#6b7280', marginTop: 4, fontSize: 12 },
  secondaryBtn: { backgroundColor: '#e2e8f0', paddingVertical: 10, alignItems: 'center', borderRadius: 8, marginTop: 12 },
  secondaryText: { color: '#1e293b', fontWeight: '600' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});

// (default export declared above)
