import { useRouter } from 'expo-router';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HrciLevel, useHrciOnboarding } from '../../context/HrciOnboardingContext';

const LEVELS: { key: HrciLevel; title: string; desc: string }[] = [
  { key: 'NATIONAL', title: 'National', desc: 'Country-wide leadership' },
  { key: 'ZONE', title: 'Zone', desc: 'Regional zone' },
  { key: 'STATE', title: 'State', desc: 'State team' },
  { key: 'DISTRICT', title: 'District', desc: 'District unit' },
  { key: 'MANDAL', title: 'Mandal', desc: 'Mandal / Taluka' },
];

export default function HrciZoneScreen() {
  const router = useRouter();
  const { setLevel } = useHrciOnboarding();
  const screen = Dimensions.get('window');
  const twoCol = screen.width >= 360;

  const choose = (lvl: HrciLevel) => {
    setLevel(lvl);
    router.push('/hrci/cells' as any);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Select your level</Text>
      <View style={[styles.grid, twoCol ? styles.gridTwo : undefined]}>
        {LEVELS.map(l => (
          <TouchableOpacity key={l.key} style={styles.card} onPress={() => choose(l.key)}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{l.title.charAt(0)}</Text>
            </View>
            <Text style={styles.title}>{l.title}</Text>
            <Text style={styles.sub}>{l.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f7f7fb' },
  heading: { fontSize: 20, fontWeight: '800', marginBottom: 12, color: '#111827' },
  grid: { flexDirection: 'column', gap: 12 },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap' as const },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eef0f4',
    marginRight: 12,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1D0DA1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgeText: { color: '#fff', fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sub: { color: '#6b7280', marginTop: 4 },
});
