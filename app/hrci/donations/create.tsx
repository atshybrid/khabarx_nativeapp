import { Colors } from '@/constants/Colors';
import { createDonationPaymentLink, getDonationEvents } from '@/services/hrciDonations';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateDonationPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);

  const [isAnonymousDonor, setIsAnonymousDonor] = useState<boolean>(true);
  const [amount, setAmount] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [pan, setPan] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const presetAmounts = [500, 1000, 2000, 5000, 10000];

  const loadEvents = useCallback(async () => {
    try { const list = await getDonationEvents(50); setEvents(list); } catch {}
  }, []);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const validate = useCallback(() => {
    setError('');
    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return false; }
    if (isAnonymousDonor) {
      if (amt >= 10000) { setError('Anonymous donations must be less than ₹10,000'); return false; }
    } else {
      if (!name.trim()) { setError('Donor name is required'); return false; }
      const ms = mobile.replace(/\D/g, '');
      if (ms.length < 10) { setError('Enter a valid 10-digit mobile number'); return false; }
      if (email.trim()) {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(email.trim())) { setError('Enter a valid email address'); return false; }
      }
      if (amt > 10000) {
        const p = pan.trim().toUpperCase();
        const panRe = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
        if (!panRe.test(p)) { setError('PAN is required and must be valid for amounts > ₹10,000'); return false; }
      }
    }
    return true;
  }, [amount, isAnonymousDonor, name, mobile, pan, email]);

  const submit = useCallback(async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      const amt = Number(amount);
      const payload: any = { amount: amt, eventId: eventId || '', isAnonymous: isAnonymousDonor, shareCode: '' };
      if (!isAnonymousDonor) {
        payload.donorName = name.trim();
        payload.donorMobile = mobile.replace(/\D/g, '');
        if (email.trim()) payload.donorEmail = email.trim();
        if (address.trim()) payload.donorAddress = address.trim();
        if (amt > 10000 && pan.trim()) payload.donorPan = pan.trim().toUpperCase();
      }
      await createDonationPaymentLink(payload);
      // Do not open payment page; simply go back to the list
      router.back();
    } catch (e: any) {
      setError(e?.message || 'Failed to create donation link');
    } finally {
      setSubmitting(false);
    }
  }, [amount, eventId, isAnonymousDonor, name, mobile, email, address, pan, validate]);

  const fillAddressFromLocation = useCallback(async () => {
    try {
      setLocating(true);
      const Location: any = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Location permission denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const rev = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (rev && rev[0]) {
        const r = rev[0];
        const parts = [r.name, r.street, r.subLocality, r.locality, r.region, r.postalCode, r.country].filter(Boolean);
        setAddress(parts.join(', '));
      }
    } catch {
      setError('Failed to capture address from location');
    } finally {
      setLocating(false);
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView>
        <View style={styles.appBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#111" />
          </Pressable>
          <Text style={styles.appTitle}>Create Donation Link</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLbl}>Donor Type</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <Pressable onPress={() => setIsAnonymousDonor(true)} style={[styles.selChip, isAnonymousDonor && styles.selChipActive]}>
              <Text style={[styles.selChipTxt, isAnonymousDonor && styles.selChipTxtActive]}>Anonymous</Text>
            </Pressable>
            <Pressable onPress={() => setIsAnonymousDonor(false)} style={[styles.selChip, !isAnonymousDonor && styles.selChipActive]}>
              <Text style={[styles.selChipTxt, !isAnonymousDonor && styles.selChipTxtActive]}>Named</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLbl}>Event (optional)</Text>
          <Pressable onPress={() => setEventPickerOpen(true)} style={styles.selectField}>
            <Text style={styles.selectValue}>{eventId ? (events.find(e => e.id === eventId)?.title || 'Select event') : 'All Events'}</Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color="#6b7280" />
          </Pressable>

          <View style={{ gap: 10 }}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLbl}>Amount (₹)</Text>
              <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="500" placeholderTextColor="#9CA3AF" style={styles.input} />
              {isAnonymousDonor ? <Text style={styles.hint}>Anonymous donations must be less than ₹10,000</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {presetAmounts.map(v => (
                  <Pressable key={v} onPress={() => setAmount(String(v))} style={[styles.presetBtn, Number(amount)===v && styles.presetBtnActive]}>
                    <Text style={[styles.presetBtnTxt, Number(amount)===v && styles.presetBtnTxtActive]}>₹{v.toLocaleString('en-IN')}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {!isAnonymousDonor && (
              <>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLbl}>Donor Name</Text>
                  <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#9CA3AF" style={styles.input} />
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLbl}>Mobile</Text>
                  <TextInput value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="10-digit mobile" placeholderTextColor="#9CA3AF" style={styles.input} />
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLbl}>Email (optional)</Text>
                  <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="name@example.com" placeholderTextColor="#9CA3AF" style={styles.input} />
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLbl}>Address (optional)</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput value={address} onChangeText={setAddress} placeholder="Address" placeholderTextColor="#9CA3AF" style={[styles.input, { flex: 1 }]} />
                    <Pressable onPress={fillAddressFromLocation} disabled={locating} style={styles.locBtn}>
                      {locating ? <ActivityIndicator size="small" color="#111" /> : <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#111" />}
                    </Pressable>
                  </View>
                </View>
                {Number(amount) > 10000 ? (
                  <View style={styles.inputRow}>
                    <Text style={styles.inputLbl}>PAN (required for {'>'} ₹10,000)</Text>
                    <TextInput autoCapitalize="characters" value={pan} onChangeText={setPan} placeholder="ABCDE1234F" placeholderTextColor="#9CA3AF" style={styles.input} />
                  </View>
                ) : null}
              </>
            )}

            {error ? <Text style={{ color: '#b91c1c', fontWeight: '700' }}>{error}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {submitting && (
        <View style={styles.overlay}>
          <LottieView source={require('@/assets/lotti/hrci_loader_svg.json')} autoPlay loop style={{ width: 140, height: 140 }} />
          <Text style={{ color: '#111', fontWeight: '800', marginTop: 8 }}>Creating link…</Text>
        </View>
      )}

      {/* Fixed bottom action bar */}
      <View style={styles.bottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' }}>Amount</Text>
          <Text style={{ color: '#111', fontSize: 16, fontWeight: '900' }}>₹{Number(amount || 0).toLocaleString('en-IN')}</Text>
        </View>
        <Pressable onPress={() => router.back()} style={[styles.actionBtn, { minWidth: 100 }]}><Text style={styles.actionTxt}>Cancel</Text></Pressable>
        <Pressable disabled={submitting} onPress={submit} style={[styles.actionBtnPrimary, { minWidth: 120 }]}>
          <Text style={styles.actionTxtPrimary}>Create</Text>
        </Pressable>
      </View>

      {eventPickerOpen && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontWeight: '800', color: '#111' }}>Select Event</Text>
              <Pressable onPress={() => setEventPickerOpen(false)} style={{ padding: 6 }}><MaterialCommunityIcons name="close" size={18} color="#111" /></Pressable>
            </View>
            <FlatList
              data={[{ id: '', title: 'All Events' }, ...events]}
              keyExtractor={(e: any) => e.id ?? ''}
              renderItem={({ item }: any) => (
                <Pressable onPress={() => { setEventId(item.id || undefined); setEventPickerOpen(false); }} style={styles.eventRow}>
                  <Text style={{ color: '#111', fontWeight: (!item.id && !eventId) || (item.id && item.id===eventId) ? '800' : '600' }}>{item.title}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={{ color: '#6b7280' }}>No events</Text>}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, backgroundColor: '#fff' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appTitle: { color: '#111', fontWeight: '800', fontSize: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#FE0002', borderColor: '#FE0002' },
  chipTxt: { color: '#6b7280', fontWeight: '700' },
  chipTxtActive: { color: '#fff' },
  selChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  selChipActive: { backgroundColor: '#FE0002', borderColor: '#FE0002' },
  selChipTxt: { color: '#6b7280', fontWeight: '700' },
  selChipTxtActive: { color: '#fff' },
  sectionLbl: { color: '#6b7280', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8 },
  inputRow: { gap: 6 },
  inputLbl: { color: '#6b7280', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111' },
  hint: { color: '#9CA3AF', fontSize: 12 },
  actionBtn: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eef0f4', backgroundColor: '#fff' },
  actionBtnPrimary: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: Colors.light.primary },
  actionTxt: { color: '#111', fontWeight: '700', fontSize: 14 },
  actionTxtPrimary: { color: '#fff', fontWeight: '800', fontSize: 14 },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  presetBtnActive: { backgroundColor: '#111', borderColor: '#111' },
  presetBtnTxt: { color: '#111', fontWeight: '800' },
  presetBtnTxtActive: { color: '#fff' },
  selectField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10 },
  selectValue: { color: '#111', fontWeight: '700' },
  modalBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', width: '100%', maxHeight: '60%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  eventRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#eef0f4' },
  locBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.8)' },
});
