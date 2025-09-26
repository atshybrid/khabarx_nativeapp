import BottomSheet from '@/components/ArticleBottomSheet';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const categories: { key: string; name: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: 'top', name: 'Top Stories', icon: 'newspaper-variant' },
  { key: 'india', name: 'India', icon: 'flag' },
  { key: 'world', name: 'World', icon: 'earth' },
  { key: 'business', name: 'Business', icon: 'briefcase' },
  { key: 'tech', name: 'Technology', icon: 'cpu-64-bit' },
  { key: 'sports', name: 'Sports', icon: 'trophy' },
  { key: 'ent', name: 'Entertainment', icon: 'movie-open' },
];

export default function CategoriesScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('selectedCategory');
        if (saved) setSelected(saved);
      } catch {}
    })();
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>Categories</Text>
        <Text style={[styles.copy, { color: theme.muted }]}>Tap to choose a category</Text>
        <Pressable style={[styles.openBtn, { backgroundColor: theme.secondary }]} onPress={() => setOpen(true)}>
          <Text style={styles.openText}>Open Categories</Text>
        </Pressable>
      </View>
      {/* Note: tab-level Category sheet is handled in app/(tabs)/_layout.tsx */}
      {open && (
        <BottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          snapPoints={[0.4, 0.8]}
          initialSnapIndex={0}
          header={<Text style={[styles.sheetTitle, { color: theme.text }]}>Categories</Text>}
        >
          <View style={styles.grid}>
            {categories.map((c) => {
              const active = selected === c.key;
              return (
                <Pressable
                  key={c.key}
                  style={[
                    styles.tile,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    active && { borderColor: theme.primary },
                  ]}
                  onPress={async () => {
                    setSelected(c.key);
                    await AsyncStorage.setItem('selectedCategory', c.key);
                    setOpen(false);
                  }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: colorScheme === 'dark' ? '#223042' : '#eef2ff' }, active && { backgroundColor: theme.primary }]}>
                    <MaterialCommunityIcons name={c.icon} size={22} color={active ? '#fff' : theme.primary} />
                  </View>
                  <Text style={[styles.tileText, { color: theme.text }, active && { color: theme.primary }]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16, gap: 8 },
  title: { fontSize: 22, fontWeight: '800' },
  copy: {},
  openBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  openText: { color: '#fff', fontWeight: '700' },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  pillText: { fontWeight: '600' },
  tile: { width: '31%', alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  tileActive: {},
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  iconCircleActive: {},
  tileText: { fontWeight: '700' },
  tileTextActive: {},
});
