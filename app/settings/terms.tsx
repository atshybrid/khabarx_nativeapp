import { useThemeColor } from '@/hooks/useThemeColor';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TermsScreen() {
	const bg = useThemeColor({}, 'background');
	const text = useThemeColor({}, 'text');
	const muted = useThemeColor({}, 'muted');
	return (
		<View style={[styles.safe, { backgroundColor: bg }] }>
			<ScrollView contentContainerStyle={styles.container}>
				<Text style={[styles.title, { color: text }]}>Terms & Conditions</Text>
				<Text style={[styles.body, { color: muted }]}>Our terms and conditions content will appear here.</Text>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	container: { flexGrow: 1, padding: 16 },
	title: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
	body: { fontSize: 14, lineHeight: 20 },
});

