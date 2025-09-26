import { ThemePref, useThemePref } from '@/context/ThemeContext';
import { useUiPrefs } from '@/context/UiPrefsContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Feather } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

// ThemePref now provided by ThemeContext

export default function AppearanceScreen() {
  // Theme tokens
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const primary = useThemeColor({}, 'primary');

  const { themePref, setThemePref } = useThemePref();
  const { fontScale, setFontScale, readingMode, setReadingMode } = useUiPrefs();

  const pickTheme = async (val: ThemePref) => { await setThemePref(val); };
  const changeFont = async (delta: number) => {
    const next = Math.max(0.85, Math.min(1.3, Number((fontScale + delta).toFixed(2))));
    await setFontScale(next);
  };

  const ThemeOption = ({ value, label, icon }: { value: ThemePref; label: string; icon: any }) => {
    const selected = themePref === value;
    return (
      <Pressable onPress={() => pickTheme(value)} style={({ pressed }) => [styles.optionRow, { backgroundColor: card, borderColor: selected ? primary : border }, pressed && { opacity: 0.9 }]}>
        <View style={[styles.iconWrap, { borderColor: border }]}>
          <Feather name={icon} size={18} color={text} />
        </View>
        <Text style={[styles.optionTitle, { color: text }]}>{label}</Text>
        <View style={[styles.radio, { borderColor: selected ? primary : border }]}>
          {selected && <View style={[styles.radioDot, { backgroundColor: primary }]} />}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIconWrap}><Feather name="aperture" size={20} color={text} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: text }]}>Appearance</Text>
            <Text style={[styles.subtitle, { color: muted }]}>Choose theme and reading preferences</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Theme</Text>
          <View style={styles.separator} />
          <ThemeOption value="system" label="Use system" icon="smartphone" />
          <View style={styles.divider} />
          <ThemeOption value="light" label="Light" icon="sun" />
          <View style={styles.divider} />
          <ThemeOption value="dark" label="Dark" icon="moon" />
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Live preview</Text>
          <View style={[styles.preview, { borderColor: border }]}> 
            <Text style={[styles.previewTitle, { color: text, fontSize: 18 * fontScale }]}>Sample headline looks like this</Text>
            <Text style={[styles.previewBody, { color: muted, fontSize: 13 * fontScale }]}>Body text adapts to your selected font size and theme. Make sure it’s comfortable to read.</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Text size</Text>
          <View style={styles.separator} />
          <View style={[styles.fontRow]}>
            <Pressable onPress={() => changeFont(-0.05)} style={[styles.pill, { borderColor: border }]}>
              <Text style={[styles.pillText, { color: primary }]}>A-</Text>
            </Pressable>
            <Text style={[styles.fontValue, { color: text }]}>{(fontScale * 100).toFixed(0)}%</Text>
            <Pressable onPress={() => changeFont(0.05)} style={[styles.pill, { borderColor: border }]}>
              <Text style={[styles.pillText, { color: primary }]}>A+</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Reading mode</Text>
          <View style={styles.separator} />
          <View style={styles.readRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: text }]}>Distraction-free reading</Text>
              <Text style={[styles.optionSubtitle, { color: muted }]}>Cleaner layout and subtle UI chrome</Text>
            </View>
            <Switch value={readingMode} onValueChange={(v) => setReadingMode(v)} />
          </View>
        </View>

        <Text style={{ color: muted, marginTop: 2, marginBottom: 10 }}>Your preferences are saved on this device.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)', marginRight: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { marginTop: 2 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)' },
  iconWrap: { width: 34, height: 34, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  optionSubtitle: { fontSize: 12, marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  radioDot: { width: 10, height: 10, borderRadius: 999 },
  preview: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginTop: 8 },
  previewTitle: { fontWeight: '800', marginBottom: 6 },
  previewBody: { lineHeight: 20 },
  fontRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  pillText: { fontWeight: '800' },
  fontValue: { fontWeight: '800', fontSize: 16 },
  readRow: { flexDirection: 'row', alignItems: 'center' },
});
