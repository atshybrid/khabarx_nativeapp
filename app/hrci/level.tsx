import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { BackHandler, Dimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HrciLevel, useHrciOnboarding } from '../../context/HrciOnboardingContext';

const LEVELS: HrciLevel[] = ['NATIONAL', 'ZONE', 'STATE', 'DISTRICT', 'MANDAL'];

export default function HrciLevelScreen() {
  const router = useRouter();
  const { setLevel } = useHrciOnboarding();
  const screen = Dimensions.get('window');
  // Use two columns only on sufficiently wide screens to avoid title wrapping
  const twoCol = screen.width >= 400;
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LEVELS.filter(l => l.toLowerCase().includes(q));
  }, [query]);

  // On Android, make sure hardware back from this screen returns to HRCI login
  useFocusEffect(
    useCallback(() => {
      const back = () => {
        try { router.replace('/hrci/login'); } catch {}
        return true;
      };
  const sub = BackHandler.addEventListener('hardwareBackPress', back);
  return () => sub.remove();
    }, [router])
  );

  const choose = async (lvl: HrciLevel) => {
    try { await Haptics.selectionAsync(); } catch {}
    setLevel(lvl);
    try { await AsyncStorage.setItem('HRCI_SELECTED_LEVEL', lvl); } catch {}
    router.push('/hrci/cells' as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','left','right']}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      <View style={styles.headerWrap}>
        <View style={styles.searchBox}>
          <TouchableOpacity onPress={() => router.replace('/hrci/login')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
          </TouchableOpacity>
          <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
          <TextInput
            placeholder="Search levels"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* Card grid */}
      <View style={[styles.grid, twoCol ? styles.gridTwo : undefined]}>
        {(filtered.length ? filtered : LEVELS).map(l => (
          <TouchableOpacity key={l} style={[styles.card, twoCol ? styles.cardTwo : undefined]} onPress={() => choose(l)}>
            <View style={styles.iconCircle}>
              <LevelIcon level={l} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{l.charAt(0) + l.slice(1).toLowerCase()}</Text>
              <Text style={styles.sub}>Tap to continue</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={28} color="#c7cbd4" />
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function LevelIcon({ level }: { level: HrciLevel }) {
  switch (level) {
    case 'NATIONAL':
      return <MaterialCommunityIcons name="earth" size={20} color="#fff" />;
    case 'ZONE':
      return <MaterialCommunityIcons name="view-grid-outline" size={20} color="#fff" />;
    case 'STATE':
      return <MaterialCommunityIcons name="flag-outline" size={20} color="#fff" />;
    case 'DISTRICT':
      return <MaterialCommunityIcons name="map-marker-radius" size={20} color="#fff" />;
    case 'MANDAL':
      return <MaterialCommunityIcons name="map-outline" size={20} color="#fff" />;
    default:
      return <MaterialCommunityIcons name="shape-outline" size={20} color="#fff" />;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  headerWrap: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, color: '#111827', paddingVertical: 4 },
  grid: { paddingHorizontal: 18, paddingTop: 12 },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap' as const, justifyContent: 'space-between' },
  card: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eef0f4',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTwo: { width: '48%', minHeight: 72 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1D0DA1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sub: { color: '#6b7280', marginTop: 2 },
});
