import { StyleSheet, Text, View } from 'react-native';

export default function ReporterLogin() {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>Reporter Login</Text>
			<Text style={styles.sub}>Screen under construction</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
	title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
	sub: { marginTop: 6, color: '#6b7280' },
});

