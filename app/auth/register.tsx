import { Colors } from '@/constants/Colors';
import { registerUser } from '@/services/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mobile?: string }>();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState(params.mobile || '');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [village, setVillage] = useState('');
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    if (!name.trim()) return Alert.alert('Enter name');
    if (!/^\d{10}$/.test(mobile)) return Alert.alert('Enter 10-digit mobile');
    if (!state.trim()) return Alert.alert('Select/enter state');
    setSaving(true);
    try {
      const res = await registerUser({ name, mobile, state, district, mandal, village });
      if (!res.ok) throw new Error('Failed');
      Alert.alert('Registered', 'Now login with MPIN');
      router.replace({ pathname: '/auth/login', params: { mobile } });
    } catch (e: any) {
      Alert.alert('Registration failed', e.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Register</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Full Name" style={styles.input} />
        <Text style={styles.label}>Mobile Number</Text>
        <TextInput value={mobile} onChangeText={setMobile} keyboardType="number-pad" maxLength={10} placeholder="10-digit number" style={styles.input} />
        <Text style={styles.label}>State (required)</Text>
        <TextInput value={state} onChangeText={setState} placeholder="State" style={styles.input} />
        <Text style={styles.label}>District (optional)</Text>
        <TextInput value={district} onChangeText={setDistrict} placeholder="District" style={styles.input} />
        <Text style={styles.label}>Mandal (optional)</Text>
        <TextInput value={mandal} onChangeText={setMandal} placeholder="Mandal" style={styles.input} />
        <Text style={styles.label}>Village (optional)</Text>
        <TextInput value={village} onChangeText={setVillage} placeholder="Village" style={styles.input} />
        <Pressable style={[styles.button, styles.primary, { marginTop: 14 }]} onPress={onSubmit} disabled={saving}>
          <Text style={[styles.buttonText, { color: '#fff' }]}>{saving ? 'Submitting...' : 'Register'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, gap: 10 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.light.primary },
  label: { fontSize: 14, color: '#555' },
  input: { borderWidth: 1, borderColor: '#e2e2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', color: '#111' },
  button: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: Colors.light.secondary },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
