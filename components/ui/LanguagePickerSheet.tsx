import { Colors } from '@/constants/Colors';
import { Language } from '@/constants/languages';
import { getLanguages } from '@/services/api';
import { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (lang: Language) => void | Promise<void>;
  currentCode?: string | null;
  title?: string;
};

export default function LanguagePickerSheet({ visible, onClose, onPick, currentCode, title }: Props) {
  const ref = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%', '75%'], []);
  const [list, setList] = useState<Language[]>([]);
  const [loading, setLoading] = useState(false);
  const selectingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const langs = await getLanguages();
      if (Array.isArray(langs) && langs.length) setList(langs);
    } catch {
      // API failure handled upstream via fallback constants if needed; here we just keep list empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      ref.current?.present();
      load();
    } else {
      ref.current?.dismiss();
    }
  }, [visible, load]);

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
  ), []);

  const handlePick = useCallback((lang: Language) => {
    if (selectingRef.current) return;
    selectingRef.current = true;
    // Close instantly for smooth UX
    onClose();
    // Fire callback in background
    Promise.resolve(onPick(lang)).finally(() => {
      selectingRef.current = false;
    });
  }, [onClose, onPick]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      onDismiss={onClose}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title || 'Select language'}</Text>
      </View>
      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="small" color={Colors.light.primary} /></View>
      ) : (
        <BottomSheetFlatList<Language>
          data={list}
          keyExtractor={(item: Language) => item.code}
          renderItem={({ item }: { item: Language }) => {
            const active = (currentCode || '').toLowerCase() === item.code.toLowerCase();
            return (
              <Pressable onPress={() => handlePick(item)} style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && { opacity: 0.9 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.langNative, { color: item.color }]}>{item.nativeName}</Text>
                  <Text style={styles.langEnglish}>{item.name}</Text>
                </View>
                <View style={styles.checkWrap}>
                  {active ? <View style={styles.checkDot} /> : null}
                </View>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  headerRow: { paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.light.primary },
  loadingWrap: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  rowActive: { backgroundColor: 'rgba(0,0,0,0.03)' },
  langNative: { fontSize: 18, fontWeight: '700' },
  langEnglish: { marginTop: 2, color: '#666' },
  checkWrap: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  checkDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.light.secondary },
});
