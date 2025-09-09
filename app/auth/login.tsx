import { Colors } from '@/constants/Colors';
import { checkUserByMobile, loginWithMPIN, registerUser } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mobile?: string }>();
  const [mobile, setMobile] = useState(params.mobile || '');
  const [checking, setChecking] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);
  // MPIN as 4 digits (UI: 4 inputs)
  const [mpinDigits, setMpinDigits] = useState<string[]>(['', '', '', '']);
  const mpinRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  // Inline register fields
  const [name, setName] = useState('');
  const [stateName, setStateName] = useState('');
  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [village, setVillage] = useState('');
  const [prefilling, setPrefilling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // When mobile becomes 10 digits, auto-check
  useEffect(() => {
    let aborted = false;
    const run = async () => {
      if (!/^\d{10}$/.test(mobile)) {
        setExists(null);
        return;
      }
      setChecking(true);
      try {
        const res = await checkUserByMobile(mobile);
        if (aborted) return;
        setExists(res.exists);
        // If new user, attempt prefill via current location
        if (!res.exists) prefillFromLocation();
  } catch {
        if (!aborted) setExists(null);
      } finally {
        if (!aborted) setChecking(false);
      }
    };
    run();
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile]);

  const mpin = useMemo(() => mpinDigits.join(''), [mpinDigits]);
  const onLogin = async () => {
    if (!/^\d{10}$/.test(mobile)) return Alert.alert('Enter 10-digit mobile');
    if (!/^\d{4}$/.test(mpin)) return Alert.alert('Enter 4-digit MPIN');
    try {
      const res = await loginWithMPIN(mobile, mpin);
      await AsyncStorage.setItem('jwt', res.token);
      if (res.name) await AsyncStorage.setItem('profile_name', res.name);
      if (res.role) await AsyncStorage.setItem('profile_role', res.role);
      router.replace('/tech');
    } catch (e: any) {
      Alert.alert('Login failed', e.message || 'Invalid MPIN');
    }
  };

  const onRegister = async () => {
    if (!/^\d{10}$/.test(mobile)) return Alert.alert('Enter 10-digit mobile');
    if (!name.trim()) return Alert.alert('Enter name');
    if (!stateName.trim()) return Alert.alert('Enter state');
    setSubmitting(true);
    try {
      const res = await registerUser({ name, mobile, state: stateName, district, mandal, village });
      if (!res.ok) throw new Error('Failed');
      Alert.alert('Registered', 'Now login with MPIN');
      setExists(true);
    } catch (e: any) {
      Alert.alert('Registration failed', e.message || 'Try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDigitChange = (idx: number, val: string) => {
    const c = val.replace(/\D/g, '').slice(-1);
    const next = [...mpinDigits];
    next[idx] = c;
    setMpinDigits(next);
    if (c && idx < 3) mpinRefs[idx + 1].current?.focus();
    if (!c && idx > 0) mpinRefs[idx - 1].current?.focus();
  };

  const prefillFromLocation = async () => {
    try {
      setPrefilling(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setPrefilling(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      // Expo reverse geocode first
      try {
        const geos = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const g = geos[0];
        if (g) {
          if (!stateName) setStateName(g.region || '');
          if (!district) setDistrict(g.subregion || g.city || '');
          if (!village) setVillage(g.city || g.district || '');
        }
      } catch {}
      // Try Nominatim for mandal/village specificity
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`, { headers: { 'Accept-Language': 'en' } });
        const j = await r.json();
        const a = j.address || {};
        if (!stateName && a.state) setStateName(a.state);
        // state_district or county often maps to district
        if (!district && (a.state_district || a.county)) setDistrict(a.state_district || a.county);
        if (!mandal && (a.subdistrict || a.suburb || a.town || a.city_district)) setMandal(a.subdistrict || a.suburb || a.town || a.city_district);
        if (!village && (a.village || a.hamlet || a.town || a.city)) setVillage(a.village || a.hamlet || a.town || a.city);
      } catch {}
    } finally {
      setPrefilling(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.label}>Mobile Number</Text>
        <TextInput
          value={mobile}
          onChangeText={(t) => { setMobile(t.replace(/\D/g, '').slice(0, 10)); setExists(null); setMpinDigits(['', '', '', '']); }}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="10-digit number"
          style={styles.input}
        />
        {checking && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <ActivityIndicator size="small" color={Colors.light.secondary} />
            <Text style={{ color: '#666' }}>Checking…</Text>
          </View>
        )}

        {/* If user exists, show MPIN row and Login button */}
        {exists === true && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.label}>Enter 4-digit MPIN</Text>
            <View style={styles.mpinRow}>
              {mpinRefs.map((ref, i) => (
                <TextInput
                  key={i}
                  ref={ref}
                  value={mpinDigits[i]}
                  onChangeText={(v) => handleDigitChange(i, v)}
                  keyboardType="number-pad"
                  maxLength={1}
                  secureTextEntry
                  style={styles.mpinBox}
                />
              ))}
            </View>
            <Pressable style={[styles.button, styles.primary, { marginTop: 14 }]} onPress={onLogin}>
              <Text style={[styles.buttonText, { color: '#fff' }]}>Login</Text>
            </Pressable>
          </View>
        )}

        {/* If not registered, show inline registration */}
        {exists === false && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.subTitle}>Create your account</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Full Name" style={styles.input} />
            <Text style={styles.label}>State (required)</Text>
            <TextInput value={stateName} onChangeText={setStateName} placeholder="State" style={styles.input} />
            <Text style={styles.label}>District</Text>
            <TextInput value={district} onChangeText={setDistrict} placeholder="District" style={styles.input} />
            <Text style={styles.label}>Mandal</Text>
            <TextInput value={mandal} onChangeText={setMandal} placeholder="Mandal" style={styles.input} />
            <Text style={styles.label}>Village</Text>
            <TextInput value={village} onChangeText={setVillage} placeholder="Village" style={styles.input} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable onPress={prefillFromLocation} style={[styles.button, styles.secondary, { flex: 1 }]}>
                <Text style={[styles.buttonText, { color: Colors.light.primary }]}>{prefilling ? 'Prefilling…' : 'Use current location'}</Text>
              </Pressable>
              <Pressable onPress={onRegister} style={[styles.button, styles.primary, { flex: 1 }]} disabled={submitting}>
                <Text style={[styles.buttonText, { color: '#fff' }]}>{submitting ? 'Submitting…' : 'Register'}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.light.primary },
  subTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.primary, marginBottom: 6 },
  label: { fontSize: 14, color: '#555' },
  input: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', color: '#111' },
  button: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: Colors.light.secondary },
  secondary: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  mpinRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  mpinBox: { flex: 1, textAlign: 'center', borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, paddingVertical: 12, fontSize: 20, letterSpacing: 4, backgroundColor: '#fff' },
});
