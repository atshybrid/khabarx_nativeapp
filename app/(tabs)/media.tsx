import { Colors } from '@/constants/Colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DonationScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { setTabBarVisible } = useTabBarVisibility();
  const openDonate = () => {
    Linking.openURL('https://www.hricindia.org/donate').catch(() => {});
  };

  useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={[styles.appBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => {
            // As a tab, back usually isn’t needed; provide a path back to Home for consistency
            router.replace('/news');
          }}
          style={styles.backRow}
        >
          <Feather name="arrow-left" size={22} color={colorScheme === 'dark' ? '#fff' : theme.primary} />
          <Text style={[styles.backText, { color: colorScheme === 'dark' ? '#fff' : theme.primary }]}>Home</Text>
        </Pressable>
        <Text style={[styles.appBarTitle, { color: colorScheme === 'dark' ? '#fff' : theme.text }]}>Donate</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Support HRIC</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>Human Rights Initiative Center</Text>
        <Text style={[styles.copy, { color: theme.text }]}>
          Your donation helps fund our independent journalism and human rights reporting.
          Contributions support field investigations, legal aid, and advocacy.
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Why donate?</Text>
          <Text style={[styles.item, { color: theme.text }]}>• Keep journalism independent and ad-light</Text>
          <Text style={[styles.item, { color: theme.text }]}>• Fund ground reporting and verifications</Text>
          <Text style={[styles.item, { color: theme.text }]}>• Expand language and regional coverage</Text>
        </View>
        <Pressable onPress={openDonate} style={[styles.cta, { backgroundColor: theme.secondary }]}>
          <Text style={styles.ctaText}>Donate Now</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  backText: { fontWeight: '600' },
  appBarTitle: { fontSize: 16, fontWeight: '700' },
  container: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  copy: { fontSize: 15 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1, marginTop: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  item: { fontSize: 14, marginTop: 4 },
  cta: { marginTop: 20, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
