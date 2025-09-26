import { useThemeColor } from '@/hooks/useThemeColor';
import { AppLockMode, getBiometricSupport, getLockMode, hasMpin, setLockMode, setMpin } from '@/services/appLock';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function AppLockSettingsScreen() {
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  const [mode, setMode] = useState<AppLockMode>('off');
  const [biometricInfo, setBiometricInfo] = useState<{ available: boolean; enrolled: boolean; type?: string }>({ available: false, enrolled: false });
  const [mpin1, setMpin1] = useState('');
  const [mpin2, setMpin2] = useState('');
  const [hasExistingMpin, setHasExistingMpin] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setMode(await getLockMode());
      setHasExistingMpin(await hasMpin());
      const bio = await getBiometricSupport();
      setBiometricInfo(bio);
    })();
  }, []);

  const biometricLabel = useMemo(() => {
    if (!biometricInfo.available) return 'Biometrics unavailable';
    if (!biometricInfo.enrolled) return 'Biometrics not enrolled';
    return 'Biometrics available';
  }, [biometricInfo]);

  const OptionRow = ({ value, title, subtitle, disabled }: { value: AppLockMode; title: string; subtitle?: string; disabled?: boolean }) => {
    const selected = mode === value;
    return (
      <Pressable
        onPress={() => !disabled && setMode(value)}
        disabled={disabled}
        style={({ pressed }) => [styles.optionRow, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.radio, { borderColor: disabled ? '#777' : border }]}>
          {selected && <View style={[styles.radioDot]} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.optionTitle, { color: disabled ? muted : text }]}>{title}</Text>
          {!!subtitle && <Text style={[styles.optionSubtitle, { color: muted }]}>{subtitle}</Text>}
        </View>
      </Pressable>
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // If choosing mpin/both ensure MPIN is set or provided now
      const needsMpin = mode === 'mpin' || mode === 'both';
      if (needsMpin && !hasExistingMpin) {
        const a = (mpin1 || '').trim();
        const b = (mpin2 || '').trim();
        if (!/^\d{4,6}$/.test(a)) throw new Error('MPIN must be 4-6 digits');
        if (a !== b) throw new Error('MPIN entries do not match');
        await setMpin(a);
        setHasExistingMpin(true);
      }
      // If choosing biometric/both but biometrics not ready, warn
      const needsBio = mode === 'biometric' || mode === 'both';
      if (needsBio && (!biometricInfo.available || !biometricInfo.enrolled)) {
        Alert.alert('Biometrics not ready', 'Please enroll biometrics in device settings. Falling back to MPIN if available.');
      }
      await setLockMode(mode);
      Alert.alert('Saved', 'App Lock preferences updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Unable to save');
    } finally {
      setSaving(false);
      setMpin1('');
      setMpin2('');
    }
  };

  const showMpinSetup = (mode === 'mpin' || mode === 'both') && !hasExistingMpin;

  return (
    <View style={[styles.safe, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.header}>
          <View style={styles.headerIconWrap}><Feather name="lock" size={20} color={text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: text }]}>App Lock</Text>
            <Text style={[styles.subtitle, { color: muted }]}>Secure the app with biometrics and/or a 4-6 digit MPIN</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Lock Method</Text>
          <View style={styles.separator} />
          <OptionRow value="off" title="Off" subtitle="Don’t require unlock on open" />
          <View style={styles.divider} />
          <OptionRow value="biometric" title="Biometric only" subtitle={biometricLabel} disabled={!biometricInfo.available || !biometricInfo.enrolled} />
          <View style={styles.divider} />
          <OptionRow value="mpin" title="MPIN only" subtitle={hasExistingMpin ? 'MPIN set' : '4-6 digit code'} />
          <View style={styles.divider} />
          <OptionRow value="both" title="Biometric + MPIN" subtitle="Prefer biometric; fallback to MPIN" disabled={!biometricInfo.available} />
        </View>

        {showMpinSetup && (
          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <Text style={[styles.cardTitle, { color: text }]}>Set MPIN</Text>
            <Text style={[styles.help, { color: muted }]}>Enter the MPIN twice to confirm</Text>
            <TextInput
              value={mpin1}
              onChangeText={setMpin1}
              placeholder="Enter 4-6 digit MPIN"
              keyboardType="number-pad"
              secureTextEntry
              style={[styles.input, { borderColor: border, color: text }]}
              placeholderTextColor={muted}
              maxLength={6}
            />
            <TextInput
              value={mpin2}
              onChangeText={setMpin2}
              placeholder="Re-enter MPIN"
              keyboardType="number-pad"
              secureTextEntry
              style={[styles.input, { borderColor: border, color: text }]}
              placeholderTextColor={muted}
              maxLength={6}
            />
          </View>
        )}

        <Pressable onPress={handleSave} disabled={saving} style={({ pressed }) => [styles.saveBtn, { opacity: pressed || saving ? 0.8 : 1, backgroundColor: card, borderColor: border }]}>
          <Feather name="save" size={16} color={text} />
          <Text style={[styles.saveText, { color: text }]}>{saving ? 'Saving…' : 'Save Preferences'}</Text>
        </Pressable>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)', marginRight: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { marginTop: 2 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  optionSubtitle: { marginTop: 2, fontSize: 12 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)' },
  radio: { width: 20, height: 20, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: '#5a67d8' },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingVertical: 12 },
  saveText: { marginLeft: 8, fontWeight: '800' },
  help: { fontSize: 12, marginBottom: 8 },
});
