import { Colors } from '@/constants/Colors';
import { createAdminMeeting, HrciAdminCreateMeetingPayload } from '@/services/hrciMeet';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useHrciOnboarding } from '../../../context/HrciOnboardingContext';

// Levels are chosen on the onboarding Level screen; keep here for reference only if needed later
// const LEVELS = ['NATIONAL', 'STATE', 'DISTRICT', 'MANDAL'] as const;

export default function HrciAdminMeetingsCreate() {
  // Steps: 0 Level -> 1 Cell -> 2 Designation -> 3 Location -> 4 Details
  const [step, setStep] = useState<number>(0);

  // Reuse onboarding selections
  const onboarding = useHrciOnboarding();
  const level = (onboarding.level || 'STATE').toUpperCase();
  const cellId = onboarding.cellId || '';
  const designationId = onboarding.designationId || '';
  const geo = onboarding.geo || {};

  // Meeting details
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState<string>(new Date(Date.now() + 30 * 60 * 1000).toISOString());
  const [endsAt, setEndsAt] = useState<string>(new Date(Date.now() + 90 * 60 * 1000).toISOString());
  const [showStartPicker, setShowStartPicker] = useState<boolean>(false);
  const [showEndPicker, setShowEndPicker] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const onQuickSetTimes = useCallback((minsFromNow: number, durationMins: number) => {
    const start = new Date(Date.now() + minsFromNow * 60 * 1000);
    const end = new Date(start.getTime() + durationMins * 60 * 1000);
    setScheduledAt(start.toISOString());
    setEndsAt(end.toISOString());
  }, []);

  const needsGeo = useMemo(() => {
    const lvl = (level || '').toUpperCase();
    return {
      country: lvl === 'NATIONAL' || lvl === 'STATE' || lvl === 'DISTRICT' || lvl === 'MANDAL',
      state: lvl === 'STATE' || lvl === 'DISTRICT' || lvl === 'MANDAL',
      district: lvl === 'DISTRICT' || lvl === 'MANDAL',
      mandal: lvl === 'MANDAL',
    };
  }, [level]);

  const validate = useCallback((): string | null => {
    if (!level) return 'Please pick a level';
    if (!cellId) return 'Please select a cell';
    if (!designationId) return 'Please select a designation';
    if (needsGeo.country && !geo.hrcCountryId) return 'Please select a country';
    if (needsGeo.state && !geo.hrcStateId) return 'Please select a state';
    if (needsGeo.district && !geo.hrcDistrictId) return 'Please select a district';
    if (needsGeo.mandal && !geo.hrcMandalId) return 'Please select a mandal';
    if (!title.trim()) return 'Please enter a meeting title';
    const start = new Date(scheduledAt).getTime();
    const end = new Date(endsAt).getTime();
    if (!isFinite(start)) return 'Please set a valid meeting time';
    if (!isFinite(end)) return 'Please set a valid end time';
    if (end <= start) return 'End time must be after meeting time';
    return null;
  }, [title, level, cellId, designationId, needsGeo, geo.hrcCountryId, geo.hrcStateId, geo.hrcDistrictId, geo.hrcMandalId, scheduledAt, endsAt]);

  const onSubmit = useCallback(async () => {
    const err = validate();
    if (err) { Alert.alert('Meetings', err); return; }
    try {
      setSubmitting(true);
      const payload: HrciAdminCreateMeetingPayload = {
        title: title.trim(),
        level: level.toUpperCase(),
        includeChildren: false,
        zone: null,
        cellId: cellId || null,
        hrcCountryId: geo.hrcCountryId || null,
        hrcStateId: geo.hrcStateId || null,
        hrcDistrictId: geo.hrcDistrictId || null,
        hrcMandalId: geo.hrcMandalId || null,
        scheduledAt,
        endsAt,
        password: password || null,
      };
  await createAdminMeeting(payload);
      Alert.alert('Meetings', 'Meeting created successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Meetings', e?.message || 'Failed to create meeting');
    } finally {
      setSubmitting(false);
    }
  }, [title, level, cellId, geo.hrcCountryId, geo.hrcStateId, geo.hrcDistrictId, geo.hrcMandalId, scheduledAt, endsAt, password, validate]);

  // Navigation helpers to reuse onboarding pages
  const gotoLevel = useCallback(() => router.push('/hrci/level' as any), []);
  const gotoCells = useCallback(() => router.push('/hrci/cells' as any), []);
  const gotoDesignations = useCallback(() => router.push('/hrci/designations' as any), []);
  const gotoGeo = useCallback(() => router.push('/hrci/geo' as any), []);

  const goNext = useCallback(async () => {
    const next = step + 1;
    setStep(next);
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 0) setStep(step - 1); else router.back();
  }, [step]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appBar}>
        <Pressable onPress={goBack} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}>
          <Feather name="arrow-left" size={18} color={Colors.light.primary} />
        </Pressable>
        <Text style={styles.appTitle}>Create Meeting</Text>
        <View style={{ width: 36 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Stepper */}
          <View style={styles.stepper}>
            {[0,1,2,3,4].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.stepDot, step === i && styles.stepDotActive]}>
                  <Text style={[styles.stepNum, step === i && styles.stepNumActive]}>{i+1}</Text>
                </View>
                {i < 4 && <View style={styles.stepLine} />}
              </View>
            ))}
          </View>

          {step === 0 && (
            <>
              {/* Step 1: Level */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Select Level</Text>
                <Text style={styles.helper}>Choose National, State, District or Mandal</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: '#0f172a', fontWeight: '800' }}>{level || 'Not selected'}</Text>
                  <Pressable onPress={gotoLevel} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.smallBtnText}>Select</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {step === 1 && (
            <>
              {/* Step 2: Cells */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Select Cell</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: '#0f172a', fontWeight: '800' }}>{onboarding.cellName || cellId || 'Not selected'}</Text>
                  <Pressable onPress={gotoCells} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.smallBtnText}>Select</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              {/* Step 3: Designations */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Select Designation</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <Text style={{ color: '#0f172a', fontWeight: '800' }}>{onboarding.designationName || onboarding.designationCode || designationId || 'Not selected'}</Text>
                  <Pressable onPress={gotoDesignations} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.smallBtnText}>Select</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              {/* Step 4: Location based on level */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Select Location</Text>
                <View style={{ gap: 8, marginTop: 6 }}>
                  {needsGeo.country && (
                    <Text style={styles.helper}>Country: {onboarding.geo.hrcCountryName || onboarding.geo.hrcCountryId || 'Not selected'}</Text>
                  )}
                  {needsGeo.state && (
                    <Text style={styles.helper}>State: {onboarding.geo.hrcStateName || onboarding.geo.hrcStateId || 'Not selected'}</Text>
                  )}
                  {needsGeo.district && (
                    <Text style={styles.helper}>District: {onboarding.geo.hrcDistrictName || onboarding.geo.hrcDistrictId || 'Not selected'}</Text>
                  )}
                  {needsGeo.mandal && (
                    <Text style={styles.helper}>Mandal: {onboarding.geo.hrcMandalName || onboarding.geo.hrcMandalId || 'Not selected'}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                  <Pressable onPress={gotoGeo} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.smallBtnText}>Select</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {step === 4 && (
            <>
              {/* Step 5: Details */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Details</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Title</Text>
                  <TextInput value={title} onChangeText={setTitle} placeholder="Meeting title" placeholderTextColor="#94a3b8" style={styles.fieldInput} />
                </View>
                <Text style={styles.helper}>Give a short descriptive title (e.g., &quot;State leadership sync&quot;).</Text>
              </View>

              {/* Schedule */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Schedule</Text>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Starts</Text>
                  <Pressable onPress={() => setShowStartPicker(true)} style={({ pressed }) => [styles.fieldInput, styles.inputButton, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.inputButtonText}>{new Date(scheduledAt).toLocaleString()}</Text>
                  </Pressable>
                </View>
                <View style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>Ends</Text>
                  <Pressable onPress={() => setShowEndPicker(true)} style={({ pressed }) => [styles.fieldInput, styles.inputButton, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.inputButtonText}>{new Date(endsAt).toLocaleString()}</Text>
                  </Pressable>
                </View>
                {showStartPicker && (
                  <DateTimePicker
                    value={new Date(scheduledAt)}
                    mode="datetime"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(e, d) => { setShowStartPicker(false); if (d) setScheduledAt(d.toISOString()); }}
                  />
                )}
                {showEndPicker && (
                  <DateTimePicker
                    value={new Date(endsAt)}
                    mode="datetime"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={(e, d) => { setShowEndPicker(false); if (d) setEndsAt(d.toISOString()); }}
                  />
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Pressable onPress={() => onQuickSetTimes(30, 60)} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.smallBtnText}>In 30m · 1h</Text>
                  </Pressable>
                  <Pressable onPress={() => onQuickSetTimes(60, 60)} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.smallBtnText}>In 1h · 1h</Text>
                  </Pressable>
                  <Pressable onPress={() => onQuickSetTimes(120, 90)} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.smallBtnText}>In 2h · 1.5h</Text>
                  </Pressable>
                </View>
              </View>

              {/* Security */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Security</Text>
                <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Password</Text><TextInput value={password} onChangeText={setPassword} placeholder="Optional password" placeholderTextColor="#94a3b8" style={styles.fieldInput} secureTextEntry /></View>
              </View>

              <View style={{ height: 72 }} />
            </>
          )}
        </ScrollView>
        {/* Footer */}
        <View style={styles.footer}>
          {step < 4 ? (
            <Pressable onPress={goNext} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.95 }]}>
              <Text style={styles.primaryBtnText}>Next</Text>
            </Pressable>
          ) : (
            <Pressable disabled={submitting} onPress={onSubmit} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.95 }, submitting && { opacity: 0.7 }]}>
              <Text style={styles.primaryBtnText}>{submitting ? 'Creating…' : 'Create meeting'}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  appTitle: { fontSize: 18, fontWeight: '900', color: Colors.light.primary },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7' },
  content: { padding: 12, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#eef2f7' },
  sectionTitle: { color: '#0f172a', fontWeight: '900', fontSize: 14, marginBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginVertical: 4 },
  stepDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.light.primary },
  stepNum: { color: '#334155', fontWeight: '900' },
  stepNumActive: { color: '#fff' },
  stepLine: { height: 2, flex: 1, backgroundColor: '#e5e7eb' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  fieldLabel: { width: 86, color: '#64748b', fontWeight: '800' },
  fieldInput: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 10, backgroundColor: '#f8fafc', color: '#0f172a' },
  inputButton: { justifyContent: 'center', backgroundColor: '#f8fafc' },
  inputButtonText: { color: '#0f172a', fontWeight: '800' },
  helper: { color: '#64748b', fontSize: 12, marginTop: 6 },
  chip: { backgroundColor: '#f8fafc', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  chipSelected: { backgroundColor: Colors.light.secondary, borderColor: Colors.light.secondary },
  chipTxt: { color: '#0f172a', fontWeight: '800' },
  chipTxtSelected: { color: '#fff' },
  listItem: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  listItemSelected: { backgroundColor: Colors.light.secondary, borderColor: Colors.light.secondary },
  listItemText: { color: '#0f172a', fontWeight: '800' },
  listItemTextSelected: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: '#e5e7eb', padding: 2, alignItems: 'flex-start', justifyContent: 'center' },
  switchOn: { backgroundColor: Colors.light.primary, alignItems: 'flex-end' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  knobOn: { backgroundColor: '#fff' },
  smallBtn: { backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 6, paddingHorizontal: 10 },
  smallBtnText: { color: '#0f172a', fontWeight: '800' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: '#ffffffdd', borderTopWidth: 1, borderTopColor: '#eef2f7' },
  primaryBtn: { backgroundColor: Colors.light.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '900' },
  switchText: { color: '#0f172a', fontWeight: '800' },
});
