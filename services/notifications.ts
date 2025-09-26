import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

type PushStatus = 'granted' | 'denied' | 'undetermined';

const PUSH_TOKEN_KEY = 'push_token';
let initDone = false;
let cachedToken: string | undefined;

// Ensure foreground notifications show a banner/toast
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
		// Newer SDKs
		shouldShowBanner: true as any,
		shouldShowList: true as any,
	} as any),
});

export async function ensureNotificationsSetup(): Promise<{ status: PushStatus; expoToken?: string; deviceToken?: string }> {
	try {
		if (!initDone) {
			if (Platform.OS === 'android') {
				try {
					await Notifications.setNotificationChannelAsync('default', {
						name: 'Default',
						importance: Notifications.AndroidImportance.HIGH,
						vibrationPattern: [0, 250, 250, 250],
						lightColor: '#FF231F7C',
						sound: 'default',
					});
				} catch {}
			}

			// Listen for notifications (foreground) and user taps
			Notifications.addNotificationReceivedListener((n) => {
				console.log('[NOTIF] received (fg)', JSON.stringify(n.request?.content));
			});
			Notifications.addNotificationResponseReceivedListener((resp) => {
				console.log('[NOTIF] response', JSON.stringify(resp.notification?.request?.content));
			});

			initDone = true;
		}

		// Check/request permission
		const current = await Notifications.getPermissionsAsync();
		let status = current.status as PushStatus;
		if (status !== 'granted') {
			const req = await Notifications.requestPermissionsAsync();
			status = req.status as PushStatus;
		}
		if (status !== 'granted') {
			console.warn('[NOTIF] permission not granted');
			return { status };
		}

		// Fetch Expo push token (preferred)
		let expoToken: string | undefined;
		try {
			const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId
				|| (Constants as any)?.default?.expoConfig?.extra?.eas?.projectId
				|| undefined;
			const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } as any : undefined as any);
			expoToken = tokenData?.data;
			cachedToken = expoToken || cachedToken;
			if (expoToken) await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoToken);
		} catch (e) {
			console.warn('[NOTIF] getExpoPushTokenAsync failed', e instanceof Error ? e.message : e);
		}

		// Device token fallback (FCM/APNS)
		let deviceToken: string | undefined;
		if (!expoToken) {
			try {
				const device = await Notifications.getDevicePushTokenAsync();
				deviceToken = (device as any)?.data || (device as any)?.token || String(device || '');
			} catch (e) {
				console.warn('[NOTIF] getDevicePushTokenAsync failed', e instanceof Error ? e.message : e);
			}
		}

		console.log('[NOTIF] setup done', { status, expoToken: expoToken ? `${expoToken.slice(0, 12)}…` : 'none', deviceToken: deviceToken ? 'yes' : 'no' });
		return { status, expoToken, deviceToken };
	} catch (e) {
		console.warn('[NOTIF] setup failed', e instanceof Error ? e.message : e);
		return { status: 'undetermined' };
	}
}

export async function getCurrentPushToken(): Promise<string | undefined> {
	if (cachedToken) return cachedToken;
	const t = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
	cachedToken = t || undefined;
	return cachedToken;
}

export async function scheduleLocalTestNotification(seconds = 3) {
	try {
			await Notifications.scheduleNotificationAsync({
			content: {
				title: 'Test notification',
				body: 'This is a local test notification from KhabarX',
				sound: 'default',
			},
				trigger: {
					type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
					seconds,
					channelId: Platform.OS === 'android' ? 'default' : undefined,
					repeats: false,
				} as any,
		});
		console.log('[NOTIF] local test scheduled in', seconds, 'sec');
	} catch (e) {
		console.warn('[NOTIF] schedule local failed', e instanceof Error ? e.message : e);
	}
}
