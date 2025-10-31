import { Colors } from '@/constants/Colors';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PaymentLink = { id: string; label: string; url: string; active: boolean };

export default function HrciAdminPaymentsPage() {
  // In future, add loading while fetching from API
  const [items, setItems] = useState<PaymentLink[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    // Placeholder: in future, fetch from API
    setItems([
      { id: '1', label: 'General Donation', url: 'https://pay.example.com/donate', active: true },
      { id: '2', label: 'Medical Aid', url: 'https://pay.example.com/medical', active: true },
      { id: '3', label: 'Emergency Relief', url: 'https://pay.example.com/relief', active: false },
    ]);
  }, []);

  const data = items.filter(x => x.label.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <StatusBar style="dark" />
        <View style={styles.appBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Payment Links</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 12 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search links"
            placeholderTextColor="#9CA3AF"
            style={styles.search}
          />
        </View>
      </SafeAreaView>

      <FlatList
        data={data}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={[styles.pill, item.active ? styles.pillActive : styles.pillInactive]}>{item.active ? 'Active' : 'Disabled'}</Text>
            </View>
            <Text style={styles.meta} numberOfLines={1}>{item.url}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No payment links.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  title: { fontSize: 16, fontWeight: '800', color: Colors.light.primary },
  search: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#111', backgroundColor: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', padding: 12, marginBottom: 12 },
  cardTitle: { color: '#0f172a', fontWeight: '900' },
  meta: { color: '#64748b', marginTop: 4 },
  empty: { color: '#64748b', textAlign: 'center', paddingTop: 24 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '700', color: '#111' },
  pillActive: { backgroundColor: '#DCFCE7' },
  pillInactive: { backgroundColor: '#FEE2E2' },
});
