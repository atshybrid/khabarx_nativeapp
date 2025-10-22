import { FullScreenLoader } from '@/components/ui/Loader';
import { getHrciCaseById, HrciCaseDetails, HrciLegalStatus, updateHrciCaseLegalAdvice } from '@/services/hrciCases';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const LEGAL_STATUSES: HrciLegalStatus[] = ['REQUIRED','NOT_REQUIRED','REVIEW','FOLLOW_UP','REFERRED'];

export default function HrciLegalCaseDetailsPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = String(params.id || '');
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<HrciCaseDetails | null>(null);
  const [legalStatus, setLegalStatus] = useState<HrciLegalStatus>('NOT_REQUIRED');
  const [legalSuggestion, setLegalSuggestion] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await getHrciCaseById(id);
        setItem(res);
      } catch (e:any) {
        setError(e?.message || 'Failed to load case');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const save = async () => {
    try {
      if (!legalSuggestion.trim()) {
        Alert.alert('Required', 'Please enter a legal suggestion');
        return;
      }
      if (legalSuggestion.length > 5000) {
        Alert.alert('Too long', 'Legal suggestion must be at most 5000 characters');
        return;
      }
      setLoading(true);
      await updateHrciCaseLegalAdvice(id, { legalStatus, legalSuggestion });
      Alert.alert('Saved', 'Legal advice updated');
      router.back();
    } catch (e:any) {
      Alert.alert('Error', e?.message || 'Failed to update legal advice');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <FullScreenLoader label="Loading…" />;
  if (error) return (
    <View style={[styles.container, styles.center]}>
      <Text style={{ color: '#b91c1c' }}>{error}</Text>
    </View>
  );
  if (!item) return null;

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <View style={styles.appBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.title}>#{item.caseNumber}</Text>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={(insets?.top || 0) + 56}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: (insets?.bottom || 0) + 40 }}
      >
        <Text style={styles.h1} numberOfLines={2}>{item.title}</Text>
        {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
        <View style={{ height: 12 }} />

        {/* Legal advice editor */}
        <Text style={styles.label}>Legal status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectRowScroll}>
          {LEGAL_STATUSES.map(s => (
            <Pressable key={s} style={[styles.selectChip, legalStatus === s && styles.selectChipActive]} onPress={() => setLegalStatus(s)}>
              <Text style={[styles.selectTxt, legalStatus === s && styles.selectTxtActive]}>{s.replace('_',' ')}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={[styles.label, { marginTop: 12 }]}>Legal suggestion (max 5000 chars)</Text>
        <TextInput
          multiline
          value={legalSuggestion}
          onChangeText={setLegalSuggestion}
          style={styles.textarea}
          placeholder="Write your advice…"
          placeholderTextColor="#9CA3AF"
          maxLength={5000}
        />
        <Text style={styles.counter}>{legalSuggestion.length}/5000</Text>

        <Pressable onPress={save} style={styles.saveBtn}>
          <Text style={styles.saveTxt}>Save legal advise</Text>
        </Pressable>
  </ScrollView>
  </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { alignItems: 'center', justifyContent: 'center' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  title: { color: '#111', fontWeight: '800' },
  h1: { color: '#111', fontSize: 20, fontWeight: '700' },
  desc: { color: '#374151', marginTop: 8 },
  label: { color: '#111', fontSize: 12, fontWeight: '800' },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  selectRowScroll: { paddingVertical: 8, gap: 8 },
  selectChip: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 },
  selectChipActive: { backgroundColor: '#111' },
  selectTxt: { color: '#111', fontSize: 12, fontWeight: '700' },
  selectTxtActive: { color: '#fff' },
  textarea: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, color: '#111', minHeight: 140, textAlignVertical: 'top' },
  counter: { color: '#6b7280', fontSize: 12, textAlign: 'right', marginTop: 4 },
  saveBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: '#111', alignItems: 'center' },
  saveTxt: { color: '#fff', fontWeight: '800' },
});
