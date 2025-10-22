import { Loader } from '@/components/ui/Loader';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { CategoryItem } from '@/services/api';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import BottomSheet from './BottomSheet';

export type LiteCategory = { id: string; name: string; slug?: string; iconUrl?: string | null };

type Props = {
  categories: CategoryItem[] | null | undefined;
  value: LiteCategory | null;
  onChange: (item: LiteCategory) => void;
  label?: string;
  placeholder?: string;
  recentKey?: string; // AsyncStorage key for recents
};

const DEFAULT_RECENT_KEY = 'recentCategories';

export default function CategoryPicker({ categories, value, onChange, label = 'Category', placeholder = 'Select Category', recentKey = DEFAULT_RECENT_KEY }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const pressLockedRef = useRef(false);
  const [recents, setRecents] = useState<LiteCategory[]>([]);
  const [currentParent, setCurrentParent] = useState<LiteCategory | null>(null);
  const [cachedList, setCachedList] = useState<CategoryItem[] | null>(null);
  const list = useMemo(() => (categories && categories.length ? categories : (cachedList || [])), [categories, cachedList]);

  // Persist categories locally to improve first render performance and second-open speed
  useEffect(() => {
    (async () => {
      try {
        // Prefer language-specific cache from services/api (categories_cache:<languageId>)
        let langId: string | undefined;
        try {
          const langRaw = await AsyncStorage.getItem('selectedLanguage');
          if (langRaw) langId = (JSON.parse(langRaw)?.id as string | undefined) || undefined;
        } catch {}
        const svcKey = langId ? `categories_cache:${langId}` : null;
        const genericKey = 'cached_categories_generic';
        if (categories && categories.length) {
          // Update both caches
          if (svcKey) await AsyncStorage.setItem(svcKey, JSON.stringify(categories));
          await AsyncStorage.setItem(genericKey, JSON.stringify(categories));
          setCachedList(categories);
        } else if (!cachedList) {
          // Hydrate from service cache first, else generic
          let raw: string | null = null;
          if (svcKey) raw = await AsyncStorage.getItem(svcKey);
          if (!raw) raw = await AsyncStorage.getItem(genericKey);
          if (raw) {
            const arr = JSON.parse(raw) as CategoryItem[];
            if (Array.isArray(arr)) setCachedList(arr);
          }
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(recentKey);
        const arr = raw ? JSON.parse(raw) as LiteCategory[] : [];
        if (Array.isArray(arr)) setRecents(arr.filter(x => x && x.id && x.name).slice(0, 8));
      } catch {}
    })();
  }, [recentKey]);

  const title = value?.name || placeholder;

  // Ensure the first tap after opening is never blocked
  useEffect(() => {
    // reset ref lock whenever visibility changes
    pressLockedRef.current = false;
  }, [visible]);

  // Derived list per view
  const currentList: CategoryItem[] = useMemo(() => {
    if (!currentParent) return list;
    const parent = list.find(c => c.id === currentParent.id);
    if (!parent) return list;
    const children = Array.isArray(parent.children) ? parent.children : [];
    // Render a synthetic first row to select parent itself
    return [{ ...parent, children: [] }, ...children];
  }, [currentParent, list]);

  const filteredList: (CategoryItem & { _isParentOption?: boolean })[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currentList as any;
    // filter by name (starts-with prioritized) within current view
    const starts: any[] = [];
    const contains: any[] = [];
    for (const c of currentList) {
      const name = String(c?.name || '').toLowerCase();
      if (!name) continue;
      if (name.startsWith(q)) starts.push(c);
      else if (name.includes(q)) contains.push(c);
      if (Array.isArray(c.children) && c.children.length) {
        for (const ch of c.children) {
          const cn = String(ch?.name || '').toLowerCase();
          if (!cn) continue;
          if (cn.startsWith(q)) starts.push(ch);
          else if (cn.includes(q)) contains.push(ch);
        }
      }
    }
    return [...starts, ...contains] as any;
  }, [query, currentList]);

  const onPick = async (item?: LiteCategory | null) => {
  if (pressLockedRef.current) return;
  pressLockedRef.current = true;
    try {
      if (!item || !item.id) return;
      onChange({ id: item.id, name: item.name, slug: item.slug, iconUrl: item.iconUrl });
      // update recents (move to front, unique by id)
      try {
        const next = [item, ...recents.filter(r => r.id !== item.id)].slice(0, 8);
        setRecents(next);
        await AsyncStorage.setItem(recentKey, JSON.stringify(next));
      } catch {}
      setVisible(false);
    } finally {
      // keep lock brief to avoid ignoring initial taps after quick reopen
      setTimeout(() => { pressLockedRef.current = false; }, 150);
    }
  };

  const renderRow = (c: CategoryItem, i: number) => {
    const hasChildren = Array.isArray(c.children) && c.children.length > 0;
    return (
      <Pressable
        key={`${c.id}:${i}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        android_ripple={{ color: '#e9edf9' }}
        onPressIn={() => {
          try { Keyboard.dismiss(); } catch {}
          // If in children view and this is the synthetic parent option
          if (currentParent && c.id === currentParent.id) {
            onPick(currentParent);
            return;
          }
          // Default: single-tap selects the category (even if it has children)
          onPick(c as any);
        }}
      >
        <View style={styles.iconCircle}>
          {c.iconUrl ? (
            <Image source={{ uri: c.iconUrl }} style={{ width: 22, height: 22, borderRadius: 4 }} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons name="shape" size={22} color={Colors.light.primary} />
          )}
        </View>
        <Text style={styles.rowText} numberOfLines={1}>
          {currentParent && c.id === currentParent.id ? `Use "${c.name}"` : c.name}
        </Text>
        {hasChildren && !currentParent ? (
          <Pressable
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => {
              try { Keyboard.dismiss(); } catch {}
              setCurrentParent({ id: c.id, name: c.name, slug: c.slug, iconUrl: c.iconUrl });
            }}
            style={{ paddingHorizontal: 2, paddingVertical: 2 }}
          >
            <Feather name="chevron-right" size={18} color={isDark ? '#fff' : '#666'} />
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select category"
        onPress={() => {
          try { Keyboard.dismiss(); } catch {}
          // reset state before showing to prevent layout jump flicker
          setQuery('');
          setCurrentParent(null);
          pressLockedRef.current = false;
          setVisible(true);
        }}
        style={[styles.card]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Feather name="tag" size={16} color={isDark ? '#fff' : Colors.light.primary} />
          <Text style={[styles.cardText, { color: isDark ? '#fff' : undefined }]}>{title}</Text>
        </View>
  <Feather name="chevron-right" size={18} color={isDark ? '#fff' : '#666'} />
      </Pressable>

      <BottomSheet
        visible={visible}
        onClose={() => { setVisible(false); setQuery(''); setCurrentParent(null); }}
        snapPoints={[0.5, 0.88]}
        initialSnapIndex={1}
        dragEnabled={false}
        header={
          <View style={styles.headerRow}>
            {currentParent ? (
              <Pressable onPress={() => setCurrentParent(null)} style={styles.backBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Feather name="chevron-left" size={20} color={isDark ? '#fff' : Colors.light.primary} />
                <Text style={[styles.backText, { color: isDark ? '#fff' : undefined }]}>Back</Text>
              </Pressable>
            ) : (
              <Text style={[styles.sheetTitle, { color: isDark ? '#fff' : undefined }]}>Choose category</Text>
            )}
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color={isDark ? '#fff' : '#666'} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search categories"
                placeholderTextColor={isDark ? '#9BA1A6' : '#999'}
                style={styles.searchInput}
              />
            </View>
          </View>
        }
      >
        {list.length === 0 ? (
          <View style={styles.loading}>
            <Loader size={48} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="always">
            {!currentParent && recents.length > 0 && !query ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>Recent</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
                  {recents.map((r) => (
                    <Pressable key={r.id} onPressIn={() => onPick(r)} style={({ pressed }) => [styles.chip, pressed && styles.pressed]} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={styles.chipText}>{r.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {filteredList.length === 0 ? (
              <Text style={styles.empty}>No categories</Text>
            ) : (
              <View>
                {filteredList.map((c, i) => renderRow(c as any, i))}
              </View>
            )}
          </ScrollView>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 12, marginBottom: 6 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardText: { fontSize: 14, color: '#333' },
  headerRow: { flexDirection: 'column', gap: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.primary },
  searchBox: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  searchInput: { flex: 1, color: '#333', padding: 0, margin: 0 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#666', marginBottom: 4 },
  chip: { backgroundColor: '#eef2ff', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  chipText: { fontSize: 12, color: Colors.light.primary, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, fontSize: 14, color: '#032557', fontWeight: '700' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff', marginRight: 10 },
  empty: { paddingVertical: 16, textAlign: 'center', color: '#666' },
  loading: { paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: Colors.light.primary, fontWeight: '700' },
});
