import { Colors } from '@/constants/Colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DonationScreen() {
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.appBar}>
        <Pressable
          onPress={() => {
            // As a tab, back usually isn’t needed; provide a path back to Home for consistency
            router.replace('/news');
          }}
          style={styles.backRow}
        >
          <Feather name="arrow-left" size={22} color={Colors.light.primary} />
          <Text style={styles.backText}>Home</Text>
        </Pressable>
        <Text style={styles.appBarTitle}>Donate</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Support HRIC</Text>
        <Text style={styles.subtitle}>Human Rights Initiative Center</Text>
        <Text style={styles.copy}>
          Your donation helps fund our independent journalism and human rights reporting.
          Contributions support field investigations, legal aid, and advocacy.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Why donate?</Text>
          <Text style={styles.item}>• Keep journalism independent and ad-light</Text>
          <Text style={styles.item}>• Fund ground reporting and verifications</Text>
          <Text style={styles.item}>• Expand language and regional coverage</Text>
        </View>
        <Pressable onPress={openDonate} style={styles.cta}>
          <Text style={styles.ctaText}>Donate Now</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6 },
  backText: { color: Colors.light.primary, fontWeight: '600' },
  appBarTitle: { color: Colors.light.primary, fontSize: 16, fontWeight: '700' },
  container: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.light.primary },
  subtitle: { fontSize: 14, color: '#666' },
  copy: { fontSize: 15, color: '#333' },
  card: { backgroundColor: '#fafafa', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#eee', marginTop: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.primary, marginBottom: 6 },
  item: { fontSize: 14, color: '#333', marginTop: 4 },
  cta: { marginTop: 20, backgroundColor: Colors.light.secondary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
