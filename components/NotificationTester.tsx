import { useThemeColor } from '@/hooks/useThemeColor';
import { ensureNotificationsSetup, getCurrentPushToken, scheduleLocalTestNotification } from '@/services/notifications';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function NotificationTester() {
	const bg = useThemeColor({}, 'background');
	const card = useThemeColor({}, 'card');
	const border = useThemeColor({}, 'border');
	const text = useThemeColor({}, 'text');
	const muted = useThemeColor({}, 'muted');

	const [status, setStatus] = React.useState<string>('unknown');
	const [expoToken, setExpoToken] = React.useState<string>('');

	const init = async () => {
		const res = await ensureNotificationsSetup();
		setStatus(res.status);
		const t = res.expoToken || (await getCurrentPushToken()) || '';
		setExpoToken(t);
	};

	React.useEffect(() => { init(); }, []);

	const copyToken = async () => {
		try {
			const token = expoToken || (await getCurrentPushToken()) || '';
			if (!token) return Alert.alert('No token', 'No Expo push token yet');
			const Clipboard = await import('expo-clipboard');
			await Clipboard.setStringAsync(token);
			Alert.alert('Copied', 'Push token copied to clipboard');
		} catch {}
	};

	return (
		<View style={[styles.safe, { backgroundColor: bg }]}>
			<ScrollView contentContainerStyle={styles.content}>
				<View style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
					<Text style={[styles.title, { color: text }]}>Push notifications</Text>
					<Text style={[styles.subtitle, { color: muted }]}>Status: {status}</Text>
					<Text numberOfLines={4} style={[styles.token, { color: muted }]}>{expoToken || 'No token yet'}</Text>
					<View style={{ height: 8 }} />
					<View style={styles.row}> 
						<Pressable onPress={init} style={[styles.btn, { borderColor: border }]}><Text style={[styles.btnText, { color: text }]}>Refresh</Text></Pressable>
						<Pressable onPress={copyToken} style={[styles.btn, { borderColor: border }]}><Text style={[styles.btnText, { color: text }]}>Copy token</Text></Pressable>
						<Pressable onPress={() => scheduleLocalTestNotification(3)} style={[styles.btn, { borderColor: border }]}><Text style={[styles.btnText, { color: text }]}>Send test</Text></Pressable>
					</View>
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1 },
	content: { padding: 16 },
	card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 14 },
	title: { fontSize: 16, fontWeight: '800' },
	subtitle: { marginTop: 6, fontSize: 12 },
	token: { marginTop: 8, fontSize: 12 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	btn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
	btnText: { fontWeight: '700' },
});
