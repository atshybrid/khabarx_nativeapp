import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ReporterMPIN() {
	return (
		<View style={styles.container}>
			<Text style={styles.title}>Enter MPIN</Text>
			<Text style={styles.sub}>Feature coming soon</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
	title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
	sub: { marginTop: 6, color: '#6b7280' },
});

