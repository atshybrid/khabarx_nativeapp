import { ScrollView, StyleSheet, Text } from 'react-native';

export default function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.paragraph}>This placeholder Privacy Policy outlines how the application may collect, use, and store personal information. Replace with a real policy drafted by legal counsel. Typical data points can include device identifiers, push notification tokens, location (when granted), and user preferences (language, region). Media you upload may be stored on a cloud provider and processed for optimization. We do not sell personal data. Access revocation is possible via your device settings. For account deletion or data export flows, contact support.</Text>
      <Text style={styles.paragraph}>We implement reasonable safeguards; however no system is perfectly secure. Users should avoid sharing sensitive personal information within public content. Children under applicable minimum age should not use the service without guardian consent.</Text>
      <Text style={styles.paragraph}>Last updated: {new Date().toDateString()}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#111827' },
  paragraph: { fontSize: 14, lineHeight: 20, color: '#374151', marginBottom: 14 },
});
