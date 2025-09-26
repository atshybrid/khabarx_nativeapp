import { useThemeColor } from '@/hooks/useThemeColor';
import { AppLockMode, getLockMode, promptBiometric, verifyMpin } from '@/services/appLock';
import { useEffect, useState } from 'react';
import { Alert, AppState, Modal, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = { visibleOverride?: boolean };

export default function AppLockGate(_props: Props) {
  const card = useThemeColor({}, 'card');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');

  const [mode, setMode] = useState<AppLockMode>('off');
  const [visible, setVisible] = useState(false);
  const [mpin, setMpin] = useState('');
  const [tries, setTries] = useState(0);

  const gateCheck = async () => {
    const m = await getLockMode();
    setMode(m);
    if (m === 'off') {
      setVisible(false);
      return;
    }
    // Try biometric first for biometric/both
    if (m === 'biometric' || m === 'both') {
      const ok = await promptBiometric('Unlock Khabarx');
      if (ok) { setVisible(false); return; }
      if (m === 'biometric') { setVisible(true); return; } // stay visible, show message
    }
    // Fallback to MPIN for mpin/both
    if (m === 'mpin' || m === 'both') {
      setVisible(true);
      return;
    }
    setVisible(false);
  };

  useEffect(() => {
    // initial
    gateCheck();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') gateCheck();
    });
    return () => { try { sub.remove(); } catch {} };
  }, []);

  const onSubmitMpin = async () => {
    const ok = await verifyMpin(mpin);
    if (ok) {
      setVisible(false);
      setMpin('');
      setTries(0);
    } else {
      setTries((t) => t + 1);
      setMpin('');
      if (tries + 1 >= 5) Alert.alert('Too many attempts', 'Please try again later.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.title, { color: text }]}>Unlock</Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            {mode === 'biometric' ? 'Biometric failed. Try again or use MPIN if enabled.' : 'Enter your MPIN to continue'}
          </Text>
          {(mode === 'mpin' || mode === 'both') && (
            <TextInput
              value={mpin}
              onChangeText={setMpin}
              placeholder="Enter MPIN"
              placeholderTextColor={muted}
              keyboardType="number-pad"
              secureTextEntry
              onSubmitEditing={onSubmitMpin}
              style={[styles.input, { borderColor: border, color: text }]}
              maxLength={6}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: '86%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 13, marginBottom: 12 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
});
