import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DOCS = [
  { title: 'Registration Certificate', url: 'https://example.org/docs/registration.pdf' },
  { title: '12A/80G Approval', url: 'https://example.org/docs/80g.pdf' },
  { title: 'Annual Report (FY 2023-24)', url: 'https://example.org/docs/annual-report.pdf' },
  { title: 'Audited Financials', url: 'https://example.org/docs/financials.pdf' },
];

export default function TransparencyScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView>
        <View style={styles.appBar}>
          <Text style={styles.appTitle}>Transparency</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ padding: 16 }}>
          <Text style={styles.lead}>We’re committed to high transparency. Access our registrations, audited financials, and annual reports below.</Text>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {DOCS.map((d, idx) => (
            <Pressable key={idx} onPress={() => Linking.openURL(d.url)} style={styles.docItem}>
              <MaterialCommunityIcons name="file-document-outline" size={20} color="#374151" />
              <Text numberOfLines={2} style={styles.docTitle}>{d.title}</Text>
              <View style={{ flex: 1 }} />
              <MaterialCommunityIcons name="open-in-new" size={18} color="#6b7280" />
            </Pressable>
          ))}
        </View>
        <View style={{ padding: 16 }}>
          <Text style={styles.subhead}>FAQ</Text>
          <Text style={styles.faqItem}>• Will I get an 80G receipt? Yes, you’ll receive an instant digital receipt by email/SMS.</Text>
          <Text style={styles.faqItem}>• How are funds used? Funds are allocated to approved causes and audited annually.</Text>
          <Text style={styles.faqItem}>• Can I donate anonymously? Yes, choose “Hide my name” at checkout.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#fff' },
  appTitle: { color: '#111', fontWeight: '900', fontSize: 18 },
  lead: { color: '#374151' },
  subhead: { color: '#111', fontWeight: '900', marginBottom: 8 },
  faqItem: { color: '#4b5563', marginTop: 4, lineHeight: 20 },
  docItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', padding: 12, borderRadius: 12 },
  docTitle: { color: '#111', fontWeight: '800', flexShrink: 1 },
});
