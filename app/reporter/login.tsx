import MobileLoginModal from '@/components/MobileLoginModal';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function ReporterLogin() {
	const router = useRouter();
	const [visible, setVisible] = useState<boolean>(true);

	useEffect(() => {
		// Ensure sheet is visible on mount
		setVisible(true);
	}, []);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Citizen Reporter</Text>
			<Text style={styles.sub}>Sign in or create your account</Text>

			<MobileLoginModal
				visible={visible}
				onClose={() => {
					setVisible(false);
					router.back();
				}}
				onSuccess={() => {
					setVisible(false);
					router.replace('/reporter/dashboard');
				}}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
	title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
	sub: { marginTop: 6, color: '#6b7280' },
});

