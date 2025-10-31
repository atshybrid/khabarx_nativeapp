import { Colors } from '@/constants/Colors';
import { createAdminMeeting, HrciAdminCreateMeetingPayload } from '@/services/hrciMeet';
import { makeShadow } from '@/utils/shadow';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHrciOnboarding } from '../../../context/HrciOnboardingContext';

export default function HrciAdminMeetingCreatePage() {
  const onboarding = useHrciOnboarding();
  const level = (onboarding.level || '').toUpperCase();
  const cellId = onboarding.cellId || '';
  const cellName = onboarding.cellName || '';
  const designationId = onboarding.designationId || '';
  const designationName = onboarding.designationName || onboarding.designationCode || '';
  const geo = onboarding.geo || {};
  const { setReturnToAfterGeo } = onboarding as any;

  const needsGeo = useMemo(() => {
    const lvl = (level || '').toUpperCase();
    return {
      country: lvl === 'NATIONAL' || lvl === 'ZONE' || lvl === 'STATE' || lvl === 'DISTRICT' || lvl === 'MANDAL',
      state: lvl === 'ZONE' || lvl === 'STATE' || lvl === 'DISTRICT' || lvl === 'MANDAL',
      district: lvl === 'DISTRICT' || lvl === 'MANDAL',
      mandal: lvl === 'MANDAL',
      zone: lvl === 'ZONE',
    } as const;
  }, [level]);

  const [title, setTitle] = useState('');
  const initialStart = useMemo(() => new Date(Date.now() + 30 * 60 * 1000), []);
  const [scheduledAt, setScheduledAt] = useState<string>(initialStart.toISOString());
  const [endsAt, setEndsAt] = useState<string>(new Date(initialStart.getTime() + 24 * 60 * 60 * 1000).toISOString());
  const [showStartPicker, setShowStartPicker] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const screen = Dimensions.get('window');
  const twoCol = screen.width >= 400;
  const [footerH, setFooterH] = useState(72);
  const [selectionsCollapsed, setSelectionsCollapsed] = useState(true);

  // No quick presets to keep time UI minimal

  // Anytime start changes via picker, auto-set end to +24h
  useEffect(() => {
    try {
      const start = new Date(scheduledAt).getTime();
      if (isFinite(start)) {
        setEndsAt(new Date(start + 24 * 60 * 60 * 1000).toISOString());
      }
    } catch {}
  }, [scheduledAt]);

  // Android uses window resize (app.json: softwareKeyboardLayoutMode: 'resize'),
  // so we avoid manual keyboard paddings to prevent double-spacing.

  const validate = useCallback((): string | null => {
    if (!level) return 'Please pick a level';
    if (!cellId) return 'Please select a cell';
    if (!designationId) return 'Please select a designation';
    // For NATIONAL, default to India and don't force selecting a country
    if (level !== 'NATIONAL' && needsGeo.country && !geo.hrcCountryId) return 'Please select a country';
    if (needsGeo.state && !geo.hrcStateId) return 'Please select a state';
    if (needsGeo.district && !geo.hrcDistrictId) return 'Please select a district';
    if (needsGeo.mandal && !geo.hrcMandalId) return 'Please select a mandal';
    if ((needsGeo as any).zone && !geo.zone) return 'Please select a zone';
    if (!title.trim()) return 'Please enter a meeting title';
    const start = new Date(scheduledAt).getTime();
    const end = new Date(endsAt).getTime();
    if (!isFinite(start)) return 'Please set a valid meeting time';
    if (!isFinite(end)) return 'Please set a valid end time';
    if (end <= start) return 'End time must be after meeting time';
    return null;
  }, [title, level, cellId, designationId, needsGeo, geo.hrcCountryId, geo.hrcStateId, geo.hrcDistrictId, geo.hrcMandalId, geo.zone, scheduledAt, endsAt]);

  const validationError = useMemo(() => validate(), [validate]);
  const canSubmit = !validationError && !submitting;

  const onSubmit = useCallback(async () => {
    const err = validate();
    if (err) { return; }
    try {
      setSubmitting(true);
      const payload: HrciAdminCreateMeetingPayload = {
        title: title.trim(),
        level: level.toUpperCase(),
        includeChildren: false,
        zone: geo.zone || null,
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
      // Clear meeting redirect hint and go back to list view
      try { await AsyncStorage.removeItem('HRCI_RETURN_TO_AFTER_GEO'); } catch {}
      Alert.alert('Meetings', 'Meeting created successfully', [
        { text: 'OK', onPress: () => router.replace('/hrci/admin/meetings-list' as any) },
      ]);
    } catch (e: any) {
      Alert.alert('Meetings', e?.message || 'Failed to create meeting');
    } finally {
      setSubmitting(false);
    }
  }, [title, level, cellId, geo.hrcCountryId, geo.hrcStateId, geo.hrcDistrictId, geo.hrcMandalId, geo.zone, scheduledAt, endsAt, password, validate]);

  const gotoLevel = useCallback(() => {
    try {
      (setReturnToAfterGeo as (p: string|null) => void)?.('/hrci/admin/meeting-create');
      AsyncStorage.setItem('HRCI_RETURN_TO_AFTER_GEO', '/hrci/admin/meeting-create');
      AsyncStorage.setItem('HRCI_EDIT_AFTER_SELECT', '1');
    } catch {}
    router.push('/hrci/level' as any);
  }, [setReturnToAfterGeo]);
  const gotoCells = useCallback(() => {
    try {
      (setReturnToAfterGeo as (p: string|null) => void)?.('/hrci/admin/meeting-create');
      AsyncStorage.setItem('HRCI_RETURN_TO_AFTER_GEO', '/hrci/admin/meeting-create');
      AsyncStorage.setItem('HRCI_EDIT_AFTER_SELECT', '1');
    } catch {}
    router.push('/hrci/cells' as any);
  }, [setReturnToAfterGeo]);
  const gotoDesignations = useCallback(() => {
    try {
      (setReturnToAfterGeo as (p: string|null) => void)?.('/hrci/admin/meeting-create');
      AsyncStorage.setItem('HRCI_RETURN_TO_AFTER_GEO', '/hrci/admin/meeting-create');
      AsyncStorage.setItem('HRCI_EDIT_AFTER_SELECT', '1');
    } catch {}
    router.push('/hrci/designations' as any);
  }, [setReturnToAfterGeo]);
  const gotoGeo = useCallback(() => {
    try { (setReturnToAfterGeo as (p: string|null) => void)?.('/hrci/admin/meeting-create'); } catch {}
    try { AsyncStorage.setItem('HRCI_RETURN_TO_AFTER_GEO', '/hrci/admin/meeting-create'); } catch {}
    router.push('/hrci/geo' as any);
  }, [setReturnToAfterGeo]);

  // Location summary: show only the relevant granularity by level
  const locationSummary = useMemo(() => {
    const lvl = (level || '').toUpperCase();
    switch (lvl) {
      case 'NATIONAL':
        return 'India'; // default country label
      case 'ZONE':
        return geo.zone ? String(geo.zone) : 'Not selected';
      case 'STATE':
        return String(geo.hrcStateName || geo.hrcStateId || 'Not selected');
      case 'DISTRICT':
        return String(geo.hrcDistrictName || geo.hrcDistrictId || 'Not selected');
      case 'MANDAL':
        return String(geo.hrcMandalName || geo.hrcMandalId || 'Not selected');
      default:
        return 'Not selected';
    }
  }, [level, geo.zone, geo.hrcStateName, geo.hrcStateId, geo.hrcDistrictName, geo.hrcDistrictId, geo.hrcMandalName, geo.hrcMandalId]);

  const suggestedTitle = useMemo(() => {
    const loc = locationSummary !== 'Not selected' ? ` • ${locationSummary}` : '';
    const who = designationName || 'Members';
    const lvl = level || '';
    return `Meeting with ${who}${lvl ? ` • ${lvl}` : ''}${loc}`.trim();
  }, [designationName, level, locationSummary]);

  // No extra relative time line to keep UI simple

  const selectionSummaryLine = useMemo(() => {
    const parts: string[] = [];
    if (level) parts.push(level);
    const who = designationName || designationId;
    if (who) parts.push(who);
    if (locationSummary && locationSummary !== 'Not selected') parts.push(locationSummary);
    return parts.join(' • ') || 'Not selected';
  }, [level, designationName, designationId, locationSummary]);

  const openAndroidDateTime = useCallback(() => {
    try {
      const current = new Date(scheduledAt);
      // First pick date
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (_e1: any, d1?: Date) => {
          const base = d1 || current;
          // Then pick time
          DateTimePickerAndroid.open({
            value: base,
            mode: 'time',
            is24Hour: true,
            onChange: (_e2: any, t?: Date) => {
              const time = t || base;
              const combined = new Date(base);
              combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
              setScheduledAt(combined.toISOString());
            },
          });
        },
      });
    } catch {}
  }, [scheduledAt]);

  return (
    <SafeAreaView style={styles.safe} edges={['top','left','right']}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}>
          <Feather name="arrow-left" size={18} color={Colors.light.primary} />
        </Pressable>
        <Text style={styles.appTitle}>Create Meeting</Text>
        <View style={{ width: 36 }} />
      </View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} enabled style={{ flex: 1 }}>
  <ScrollView contentContainerStyle={[styles.content, { paddingBottom: footerH + 12 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
          {!!validationError && (
            <View style={styles.bannerWarn}>
              <Feather name="alert-triangle" size={16} color="#b45309" />
              <Text style={styles.bannerWarnText}>{validationError}</Text>
            </View>
          )}
          {/* Summary card */}
          <View style={[styles.card, styles.cardShadow]}> 
            <Pressable onPress={() => setSelectionsCollapsed(v => !v)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pressed && { opacity: 0.9 }]}>
              <Text style={styles.sectionTitle}>Selections</Text>
              <Feather name={selectionsCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color="#64748b" />
            </Pressable>
            {selectionsCollapsed ? (
              <Text style={[styles.helper, { marginTop: 2 }]} numberOfLines={2}>{selectionSummaryLine}</Text>
            ) : (
              <View style={{ gap: 8 }}>
                <SummaryRow label="Level" value={level || 'Not selected'} onEdit={gotoLevel} small />
                <Separator />
                <SummaryRow label="Cell" value={cellName || cellId || 'Not selected'} onEdit={gotoCells} small />
                <Separator />
                <SummaryRow label="Designation" value={designationName || designationId || 'Not selected'} onEdit={gotoDesignations} small />
                <Separator />
                <SummaryRow label="Location" value={locationSummary} onEdit={gotoGeo} small />
              </View>
            )}
          </View>

          {/* Meeting (merged name, time, password) */}
          <View style={[styles.card, styles.cardShadow]}> 
            <Text style={styles.sectionTitle}>Meeting</Text>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput value={title} onChangeText={setTitle} placeholder="Meeting name" placeholderTextColor="#94a3b8" style={styles.fieldInput} />
            </View>
            {!!suggestedTitle && (
              <View style={{ marginTop: 6 }}>
                <Pressable onPress={() => setTitle(suggestedTitle)} style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.linkBtnText}>Use suggestion</Text>
                </Pressable>
              </View>
            )}
            <View style={[styles.fieldRow, twoCol ? { alignItems: 'stretch' } : undefined]}>
              <Text style={styles.fieldLabel}>Time</Text>
              <Pressable onPress={() => { if (Platform.OS === 'android') { openAndroidDateTime(); } else { setShowStartPicker(true); } }} style={({ pressed }) => [styles.fieldInput, styles.inputButton, pressed && { opacity: 0.9 }]}> 
                <Text style={styles.inputButtonText}>{new Date(scheduledAt).toLocaleString()}</Text>
              </Pressable>
            </View>
            {Platform.OS === 'ios' && showStartPicker && (
              <DateTimePicker
                value={new Date(scheduledAt)}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(e, d) => { setShowStartPicker(false); if (d) setScheduledAt(d.toISOString()); }}
              />
            )}
            <Text style={[styles.helper, { marginTop: 8 }]}>Auto expires in 24h: {new Date(endsAt).toLocaleString()}</Text>
            {/* Keep UI minimal: removed quick presets */}
            {/* Simplified time UI: no relative line */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Optional password"
                placeholderTextColor="#94a3b8"
                style={styles.fieldInput}
                secureTextEntry={false}
                autoCorrect={false}
                autoCapitalize="none"
                textContentType={Platform.OS === 'ios' ? 'password' : 'none'}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => { if (canSubmit) onSubmit(); }}
              />
            </View>
          </View>

          {/* Security block removed; Password lives in Meeting card */}

          <View style={{ height: Math.max(footerH, 72) }} />
        </ScrollView>
  <View style={styles.footer} onLayout={e => setFooterH(Math.ceil(e.nativeEvent.layout.height))}>
          {!canSubmit && (
            <Text style={styles.footerHint}>{validationError || 'Complete selections to continue'}</Text>
          )}
          <Pressable disabled={!canSubmit} onPress={onSubmit} style={({ pressed }) => [styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled, pressed && canSubmit && { opacity: 0.95 }]}>
            <Text style={styles.primaryBtnText}>{submitting ? 'Creating…' : 'Create meeting'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, onEdit, small }: { label: string; value: string; onEdit?: () => void; small?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={styles.dot} />
        <View>
          <Text style={{ color: '#64748b', fontWeight: '800', fontSize: small ? 11 : 12 }} numberOfLines={1}>{label}</Text>
          <Text style={{ color: '#0f172a', fontWeight: '900', marginTop: 2, fontSize: small ? 13 : 14 }} numberOfLines={1} ellipsizeMode="tail">{value || '—'}</Text>
        </View>
      </View>
      {!!onEdit && (
        <Pressable onPress={onEdit} style={({ pressed }) => [styles.smallBtn, { paddingVertical: small ? 4 : 6, paddingHorizontal: small ? 8 : 10 }, pressed && { opacity: 0.9 }]}>
          <Text style={[styles.smallBtnText, { fontSize: small ? 12 : 13 }]}>Edit</Text>
        </Pressable>
      )}
    </View>
  );
}

function Separator() {
  return <View style={{ height: 1, backgroundColor: '#f1f5f9' }} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  appTitle: { fontSize: 18, fontWeight: '900', color: Colors.light.primary },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7' },
  content: { padding: 12, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#eef2f7' },
  cardShadow: { ...makeShadow(8, { opacity: 0.08, blur: 24, y: 8 }) },
  sectionTitle: { color: '#0f172a', fontWeight: '900', fontSize: 14, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  fieldLabel: { width: 86, color: '#64748b', fontWeight: '800' },
  fieldInput: { flex: 1, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 10, backgroundColor: '#f8fafc', color: '#0f172a' },
  inputButton: { justifyContent: 'center', backgroundColor: '#f8fafc' },
  inputButtonText: { color: '#0f172a', fontWeight: '800' },
  helper: { color: '#64748b', fontSize: 12, marginTop: 6 },
  smallBtn: { backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 6, paddingHorizontal: 10 },
  smallBtnText: { color: '#0f172a', fontWeight: '800' },
  linkBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  linkBtnText: { color: Colors.light.primary, fontWeight: '800' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: '#ffffffdd', borderTopWidth: 1, borderTopColor: '#eef2f7' },
  footerHint: { color: '#64748b', fontSize: 12, marginBottom: 8, textAlign: 'center' },
  primaryBtn: { backgroundColor: Colors.light.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  primaryBtnDisabled: { backgroundColor: '#c7d2fe' },
  primaryBtnText: { color: '#fff', fontWeight: '900' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a3e635' },
  bannerWarn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: '#fffbeb', borderRadius: 12, borderWidth: 1, borderColor: '#fef3c7' },
  bannerWarnText: { color: '#b45309', fontWeight: '800', flex: 1 },
});
