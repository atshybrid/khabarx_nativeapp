import { AvatarPicker } from '@/components/AvatarPicker';
import { FieldRow } from '@/components/settings/FieldRow';
import { InlineMessage } from '@/components/settings/InlineMessage';
import { SectionCard } from '@/components/settings/SectionCard';
import type { Language } from '@/constants/languages';
import { usePreferences } from '@/hooks/usePreferences';
import { useProfile } from '@/hooks/useProfile';
import { getLanguages } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AccountScreen() {
  const router = useRouter();
  const { prefs, updateLocation, updateLanguage, loading } = usePreferences();
  const { profile, loading: profileLoading, saving: profileSaving, dirty: profileDirty, error: profileError, updateLocal: updateProfileLocal, save: saveProfile } = useProfile();
  const [rawDraft, setRawDraft] = React.useState<{ name: string; lat: number; lng: number } | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [inlineMsg, setInlineMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [gpsBusy, setGpsBusy] = React.useState(false);
  // Language picker state
  const [langSheetOpen, setLangSheetOpen] = React.useState(false);
  const [languageList, setLanguageList] = React.useState<Language[] | null>(null);
  const [langLoading, setLangLoading] = React.useState(false);
  const [langError, setLangError] = React.useState<string | null>(null);
  const [langUpdating, setLangUpdating] = React.useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('profile_location_obj');
        if (!active) return;
        if (raw) setRawDraft(JSON.parse(raw));
      } catch {}
    })();
    return () => { active = false; };
  }, []));

  // Determine if draft differs from stored backend value; if identical treat as no draft.
  const backendLoc = prefs?.location || null;
  const effectiveDraft = useMemo(() => {
    if (!rawDraft) return null;
    if (!backendLoc) return rawDraft;
    const same = Math.abs((backendLoc.latitude) - rawDraft.lat) < 1e-6 &&
                Math.abs((backendLoc.longitude) - rawDraft.lng) < 1e-6;
    if (same && (backendLoc.placeName) === rawDraft.name) return null;
    return rawDraft;
  }, [rawDraft, backendLoc]);

  const currentDisplay = useCallback(() => {
    const loc: any = effectiveDraft || backendLoc;
    if (!loc) return 'Not set';
    const lat = loc.latitude;
    const lng = loc.longitude;
    const meta: string[] = [];
    if (lat != null && lng != null) meta.push(`${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)}`);
    return loc.placeName || loc.name || meta.join(' ');
  }, [effectiveDraft, backendLoc]);

  // Load languages when sheet first opened
  const ensureLanguages = async () => {
    if (languageList || langLoading) { setLangSheetOpen(true); return; }
    setLangLoading(true); setLangError(null); setLangSheetOpen(true);
    try {
      const list = await getLanguages();
      setLanguageList(list);
    } catch (e: any) {
      setLangError(e?.message || 'Failed to load languages');
    } finally {
      setLangLoading(false);
    }
  };

  const currentLanguage = React.useMemo(() => {
    if (!prefs?.languageId || !languageList) return languageList?.find(l => l.id === prefs?.languageId) || null;
    return languageList.find(l => l.id === prefs.languageId) || null;
  }, [prefs?.languageId, languageList]);

  const onSelectLanguage = async (lang: Language) => {
    if (langUpdating) return;
    if (prefs?.languageId === lang.id) {
      setInlineMsg({ type: 'success', text: 'Language already selected.' });
      setLangSheetOpen(false);
      return;
    }
    setLangUpdating(true); setInlineMsg(null);
    try {
      console.log('[LANG][ACCOUNT] user selecting language', { selectedId: lang.id, name: lang.name, nativeName: lang.nativeName, previous: prefs?.languageId });
      const res = await updateLanguage(lang.id);
      console.log('[LANG][ACCOUNT] updateLanguage response prefs.languageId now =', res?.languageId);
      if (res) {
        setInlineMsg({ type: 'success', text: `Language set to ${lang.nativeName || lang.name}.` });
        setLangSheetOpen(false);
      }
    } catch (e: any) {
      setInlineMsg({ type: 'error', text: e?.message || 'Failed to update language.' });
      console.warn('[LANG][ACCOUNT] language update failed', e);
    } finally {
      setLangUpdating(false);
    }
  };

  const saveDraftToPreferences = async () => {
    if (!effectiveDraft) return;
    const currentLat = backendLoc?.latitude;
    const currentLng = backendLoc?.longitude;
    const same = backendLoc && currentLat != null && currentLng != null && Math.abs(currentLat - effectiveDraft.lat) < 1e-6 && Math.abs(currentLng - effectiveDraft.lng) < 1e-6 && (backendLoc.placeName) === effectiveDraft.name;
    if (same) {
      setInlineMsg({ type: 'success', text: 'No change – already up to date.' });
      return;
    }
    setSyncing(true);
    try {
      await updateLocation({
        latitude: effectiveDraft.lat,
        longitude: effectiveDraft.lng,
        placeName: effectiveDraft.name,
        source: 'manual-map',
      });
      setRawDraft(null);
      await AsyncStorage.removeItem('profile_location_obj');
      setInlineMsg({ type: 'success', text: 'Location updated.' });
    } catch (e: any) {
      setInlineMsg({ type: 'error', text: e?.message || 'Failed to update location.' });
    } finally {
      setSyncing(false);
    }
  };

  const refreshViaGPS = async () => {
    if (gpsBusy) return;
    setGpsBusy(true); setInlineMsg(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setInlineMsg({ type: 'error', text: 'Location permission denied.' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      let placeName: string | undefined;
      try {
        const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
        const first = rev[0];
        if (first) placeName = [first.name, first.subregion, first.region].filter(Boolean).join(', ');
      } catch {}
      // Skip if identical to backend to avoid redundant write
      const currentLat = backendLoc?.latitude;
      const currentLng = backendLoc?.longitude;
      if (backendLoc && currentLat != null && currentLng != null && Math.abs(currentLat - latitude) < 1e-6 && Math.abs(currentLng - longitude) < 1e-6) {
        setInlineMsg({ type: 'success', text: 'Location already current.' });
        return;
      }
      await updateLocation({ latitude, longitude, placeName, source: 'gps-refresh' });
      setInlineMsg({ type: 'success', text: 'Location refreshed from GPS.' });
    } catch (e: any) {
      setInlineMsg({ type: 'error', text: e?.message || 'Failed to refresh location.' });
    } finally {
      setGpsBusy(false);
    }
  };

  const lastUpdated = prefs?.updatedAt ? new Date(prefs.updatedAt) : null;
  function timeAgo(d: Date) {
    const diff = Date.now() - d.getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24); if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }
  const lastUpdatedLabel = lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : 'Never updated';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Account</Text>
      {/* Profile Section */}
      <SectionCard>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'flex-start' }}>
          <AvatarPicker
            url={profile?.profilePhotoUrl || undefined}
            onPick={(r) => {
              if (r) updateProfileLocal({ profilePhotoUrl: r.url, profilePhotoMediaId: r.mediaId });
            }}
          />
          <View style={{ flex: 1, marginLeft: 18 }}>
            {profileLoading ? (
              <View>
                <View style={styles.skelLineBig} />
                <View style={styles.skelSpacer} />
                <View style={styles.skelLineMulti} />
              </View>
            ) : (
              <>
                <FieldRow label="Full Name" value={(profile as any)?.fullName || ''} onChangeText={(t) => updateProfileLocal({ fullName: t })} placeholder="Enter full name" disabled={profileSaving} />
                <FieldRow label="Bio" value={(profile as any)?.bio || ''} onChangeText={(t) => updateProfileLocal({ bio: t })} placeholder="Short bio" disabled={profileSaving} multiline />
              </>
            )}
            {profileError && <InlineMessage type="error" text={profileError} />}
            <View style={{ flexDirection: 'row', marginTop: 14, alignItems: 'center' }}>
              {profileDirty && (
                <TouchableOpacity style={[styles.actionBtn, styles.primaryAction]} disabled={profileSaving} onPress={() => saveProfile()}>
                  <Text style={styles.actionBtnTxt}>{profileSaving ? 'Saving…' : 'Save Profile'}</Text>
                </TouchableOpacity>
              )}
              {profileLoading && <ActivityIndicator style={{ marginLeft: 10 }} />}
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <TouchableOpacity onPress={() => router.push('/settings/terms' as any)} style={styles.linkBtn}><Text style={styles.linkTxt}>Terms</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings/privacy' as any)} style={styles.linkBtn}><Text style={styles.linkTxt}>Privacy</Text></TouchableOpacity>
        </View>
      </SectionCard>
      <SectionCard>
        <Text style={styles.sectionTitle}>Location Preference</Text>
        <Text style={styles.value}>{currentDisplay()}</Text>
        <Text style={styles.metaLabel}>{lastUpdatedLabel}</Text>
        {loading && <ActivityIndicator style={{ marginTop: 8 }} />}
  {effectiveDraft && (<Text style={styles.draftNote}>Unsaved selection. Press Save to apply.</Text>)}
        {inlineMsg && (
          <InlineMessage type={inlineMsg.type} text={inlineMsg.text} onHide={() => setInlineMsg(null)} />
        )}
        <View style={styles.row}>
          <TouchableOpacity style={[styles.actionBtn, styles.secondaryAction]} onPress={() => router.push('/settings/location')}>
            <Text style={styles.actionBtnTxt}>Change</Text>
          </TouchableOpacity>
          {effectiveDraft && (
            <TouchableOpacity style={[styles.actionBtn, styles.successAction]} onPress={saveDraftToPreferences} disabled={syncing}>
              <Text style={styles.actionBtnTxt}>{syncing ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          )}
          {!effectiveDraft && (
            <TouchableOpacity style={[styles.actionBtn, styles.altAction]} onPress={refreshViaGPS} disabled={gpsBusy}>
              <Text style={styles.actionBtnTxt}>{gpsBusy ? 'GPS…' : 'Refresh GPS'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SectionCard>
      {/* Language Preference Card */}
      <SectionCard>
        <Text style={styles.sectionTitle}>Language</Text>
        <Text style={styles.value}>{currentLanguage?.nativeName || currentLanguage?.name || prefs?.languageId || 'Not set'}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.actionBtn, styles.secondaryAction]} onPress={ensureLanguages}>
            <Text style={styles.actionBtnTxt}>Change</Text>
          </TouchableOpacity>
          {langUpdating && <ActivityIndicator />}
        </View>
      </SectionCard>
      {langSheetOpen && (
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setLangSheetOpen(false)}><Text style={styles.closeBtnTxt}>Close</Text></TouchableOpacity>
            </View>
            {langLoading && <ActivityIndicator style={{ marginVertical: 12 }} />}
            {langError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{langError}</Text>
                <TouchableOpacity onPress={() => { setLanguageList(null); ensureLanguages(); }} style={styles.retryBtn}><Text style={styles.retryTxt}>Retry</Text></TouchableOpacity>
              </View>
            )}
            {!langLoading && !langError && (
              <View style={styles.langList}>
                {languageList?.map(l => {
                  const selected = prefs?.languageId === l.id;
                  return (
                    <TouchableOpacity key={l.id} style={[styles.langItem, selected && styles.langItemSelected]} disabled={langUpdating} onPress={() => onSelectLanguage(l)}>
                      <View style={[styles.langColorDot, { backgroundColor: l.color }]} />
                      <Text style={styles.langName}>{l.nativeName} <Text style={styles.langSub}>{l.name}</Text></Text>
                      {selected && <Text style={styles.currentBadge}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}
      <TouchableOpacity style={[styles.footerBtn]} onPress={() => router.push('/settings/account-debug')}>
        <Text style={styles.footerBtnTxt}>Developer: Clear ALL App Storage</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 32,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#111827',
  },
  card: { },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  value: { marginTop: 6, fontSize: 14, color: '#374151' },
  metaLabel: { marginTop: 4, fontSize: 11, color: '#6b7280' },
  draftNote: { marginTop: 4, fontSize: 12, color: '#d97706' },
  inlineMsg: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  inlineErr: { backgroundColor: '#fee2e2' },
  inlineOk: { backgroundColor: '#dcfce7' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, marginRight: 10 },
  actionBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  primaryAction: { backgroundColor: '#032557' },
  secondaryAction: { backgroundColor: '#6366f1' },
  successAction: { backgroundColor: '#16a34a' },
  altAction: { backgroundColor: '#0d9488' },
  footerBtn: { backgroundColor: '#1e293b', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, marginTop: 12, marginBottom: 40 },
  footerBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 14, textAlign: 'center' },
  inlineMsgTxt: { fontSize: 12, color: '#111827' },
  fieldLabel: { fontSize: 12, color: '#374151', fontWeight: '600', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, backgroundColor: '#fff', marginTop: 4 },
  errorSmall: { color: '#b91c1c', fontSize: 12, marginTop: 4 },
  linkBtn: { backgroundColor: '#e0f2fe', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, marginRight: 8 },
  linkTxt: { color: '#0369a1', fontSize: 12, fontWeight: '600' },
  /* Language sheet styles */
  sheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', paddingTop: 12, paddingHorizontal: 16, paddingBottom: 28, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '70%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtnTxt: { color: '#2563eb', fontWeight: '600' },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', padding: 12, borderRadius: 8, marginVertical: 8 },
  errorText: { color: '#b91c1c', fontSize: 13, marginBottom: 6 },
  retryBtn: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, alignSelf: 'flex-start' },
  retryTxt: { color: '#fff', fontWeight: '600' },
  langList: { marginTop: 4 },
  langItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  langItemSelected: { backgroundColor: '#f1f5f9' },
  langColorDot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  langName: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  langSub: { fontSize: 12, color: '#6b7280' },
  currentBadge: { fontSize: 11, color: '#059669', fontWeight: '700' },
  skelLineBig: { height: 18, borderRadius: 6, backgroundColor: '#e2e8f0', width: '70%' },
  skelSpacer: { height: 14 },
  skelLineMulti: { height: 80, borderRadius: 10, backgroundColor: '#e2e8f0', width: '100%' },
});
