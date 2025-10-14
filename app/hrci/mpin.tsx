import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loginWithMpin } from '../../services/api';
import { saveTokens } from '../../services/auth';

export default function HrciMpinScreen() {
  const router = useRouter();
  const { mobile } = useLocalSearchParams<{ mobile?: string }>();
  const [digits, setDigits] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const refs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];
  const mpin = useMemo(() => digits.join(''), [digits]);

  const onChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setDigits(prev => {
      const next = [...prev];
      next[i] = d || '';
      return next;
    });
    if (d && i < 3) refs[i + 1].current?.focus();
  };

  const submit = async () => {
    if (!/^\d{4}$/.test(mpin) || !mobile || loading) return;
    setLoading(true);
    try {
      const data = await loginWithMpin({ mobileNumber: String(mobile), mpin });
      await saveTokens({ jwt: (data as any).jwt, refreshToken: (data as any).refreshToken, user: (data as any).user });
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Login failed', e?.message || 'Invalid MPIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={styles.card}>
        <Text style={styles.title}>Enter MPIN</Text>
        <Text style={styles.sub}>Mobile: {String(mobile || '')}</Text>
        <View style={styles.row}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={refs[i]}
              value={d}
              onChangeText={(v) => onChange(i, v)}
              keyboardType="number-pad"
              maxLength={1}
              secureTextEntry
              style={styles.box}
            />
          ))}
        </View>
        <TouchableOpacity style={[styles.cta, !(mobile && /^\d{4}$/.test(mpin)) && styles.ctaDisabled]} disabled={loading || !(mobile && /^\d{4}$/.test(mpin))} onPress={submit}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Login</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb', padding: 20, justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  title: { fontSize: 20, fontWeight: '700', color: '#0b132b' },
  sub: { fontSize: 12, color: '#6b7280' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  box: { width: 52, height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', textAlign: 'center', fontSize: 22, color: '#111827' },
  cta: { marginTop: 12, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontWeight: '700' },
});
