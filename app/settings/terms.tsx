import { ScrollView, StyleSheet, Text } from 'react-native';

export default function TermsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Terms & Conditions</Text>
      <Text style={styles.paragraph}>These placeholder Terms & Conditions describe the basic rules of using the application. Replace this content with real legal text provided by counsel. By using the app you agree to abide by platform policies, refrain from abusive conduct, and respect intellectual property. Content may be moderated and accounts can be suspended for violations. Location and preference data is used to personalize your experience. Media uploads should be original or properly licensed. Additional clauses about liability, governing law, dispute resolution, termination, and changes to terms should appear here.</Text>
      <Text style={styles.paragraph}>1. Acceptance: Installing or using the app constitutes acceptance of these terms. 2. Eligibility: You represent you are legally allowed to use this service. 3. User Content: You retain ownership of content you create but grant the service a license to display and distribute within the platform. 4. Prohibited Use: Do not upload malicious code, harass other users, or attempt to circumvent security.</Text>
      <Text style={styles.paragraph}>Last updated: {new Date().toDateString()}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#111827' },
  paragraph: { fontSize: 14, lineHeight: 20, color: '#374151', marginBottom: 14 },
});
