import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';
import { getDeviceIdentity } from './device';
import { request } from './http';

type PushStatus = 'granted' | 'denied' | 'undetermined';

const PUSH_TOKEN_KEY = 'push_token';
let initDone = false;
let cachedToken: string | undefined;

// Ensure foreground notifications show a banner/toast
Notifications.setNotificationHandler({
	handleNotification: async () => {
		// iOS: prefer shouldShowBanner/shouldShowList to avoid deprecation warning
		// Android: explicitly enable alert UI in foreground via shouldShowAlert (valid on Android)
		const behavior: any = {
			shouldPlaySound: true,
			shouldSetBadge: false,
		};
		if (Platform.OS === 'ios') {
			behavior.shouldShowBanner = true;
			behavior.shouldShowList = true;
		} else if (Platform.OS === 'android') {
			behavior.shouldShowAlert = true;
		}
		return behavior;
	},
});

export async function ensureNotificationsSetup(): Promise<{ status: PushStatus; expoToken?: string; deviceToken?: string }> {
	if (Platform.OS === 'web') {
		// Web: avoid getExpoPushTokenAsync to suppress listener warnings; just report permission
		const current = await Notifications.getPermissionsAsync();
		const status = current.status as PushStatus;
		console.log('[NOTIF_WEB] setup (permissions only)', { status });
		return { status };
	}
	try {
		if (!initDone) {
			if (Platform.OS === 'android') {
				try {
					await Notifications.setNotificationChannelAsync('default', {
						name: 'Default',
						importance: Notifications.AndroidImportance.MAX,
						vibrationPattern: [0, 250, 250, 250],
						sound: 'default',
						lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
						bypassDnd: false as any,
						showBadge: true as any,
					} as any);
				} catch {}
			}

			// Listen for notifications (foreground) and user taps
			Notifications.addNotificationReceivedListener(async (n) => {
				// Log a safe subset to avoid deprecated getters
				try {
					const c: any = (n as any)?.request?.content || {};
					const logPayload = {
						title: c?.title,
						body: c?.body,
						subtitle: c?.subtitle,
						sound: c?.sound,
						badge: c?.badge,
						sticky: c?.sticky,
						autoDismiss: c?.autoDismiss,
						data: c?.data,
					};
					console.log('[NOTIF] received (fg)', logPayload);
				} catch {}
			});
			Notifications.addNotificationResponseReceivedListener((resp) => {
				console.log('[NOTIF] response', JSON.stringify(resp.notification?.request?.content));
			});

			initDone = true;
		}

		// Check/request permission (aggressive: ask every time until granted)
		const current = await Notifications.getPermissionsAsync();
		let status = current.status as PushStatus;
		if (status !== 'granted') {
			const req = await Notifications.requestPermissionsAsync({
				ios: { allowAlert: true, allowBadge: true, allowSound: true },
			} as any);
			status = req.status as PushStatus;
			// If user has permanently denied and OS won't show prompt again, guide to Settings
			if (status !== 'granted' && (req as any)?.canAskAgain === false) {
				try {
					Alert.alert(
						'Enable Notifications',
						'Notifications are disabled. Enable them in Settings to receive alerts.',
						[
							{ text: 'Not now', style: 'cancel' },
							{ text: 'Open Settings', onPress: () => { try { Linking.openSettings(); } catch {} } },
						]
					);
				} catch {}
			}
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
			// Dev convenience: print full token in logs
			try { if (expoToken && (global as any).__DEV__) { console.log('[NOTIF] Expo push token (full):', expoToken); } } catch {}
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

// Read current permission without prompting the user
export async function getPushPermissionStatus(): Promise<{ status: PushStatus; canAskAgain?: boolean }>{
	try {
		const current = await Notifications.getPermissionsAsync();
		return { status: current.status as PushStatus, canAskAgain: (current as any)?.canAskAgain };
	} catch {
		return { status: 'undetermined' };
	}
}

export async function scheduleLocalTestNotification(seconds = 3) {
	try {
			await Notifications.scheduleNotificationAsync({
			content: {
				title: 'Test notification',
				body: 'This is a local test notification from KhabarX',
				sound: 'default',
				data: { __local: true },
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

// Register current device's Expo push token with backend so server can send notifications
export async function registerPushTokenWithBackend(projectIdOverride?: string): Promise<string | null> {
	try {
		if (Platform.OS === 'web') {
			// Skip on web to avoid noisy warnings; web push is not supported in this app
			console.log('[NOTIF_WEB] skip registerPushTokenWithBackend');
			return null;
		}
		// Ensure setup + permission + token
		const setup = await ensureNotificationsSetup();
		let expoToken = setup.expoToken;
		let devicePushToken = setup.deviceToken;
		if (!expoToken) {
			try {
				const pid = projectIdOverride
					|| (Constants as any)?.expoConfig?.extra?.eas?.projectId
					|| (Constants as any)?.default?.expoConfig?.extra?.eas?.projectId
					|| undefined;
				const t = await Notifications.getExpoPushTokenAsync(pid ? { projectId: pid } as any : undefined as any);
				expoToken = t?.data;
			} catch (e) {
				console.warn('[NOTIF] getExpoPushTokenAsync (register) failed', e instanceof Error ? e.message : e);
			}
		}
		// Also fetch native device push token (FCM/APNS) so backend can send directly if desired
		if (!devicePushToken) {
			try {
				const device = await Notifications.getDevicePushTokenAsync();
				devicePushToken = (device as any)?.data || (device as any)?.token || String(device || '');
			} catch (e) {
				console.warn('[NOTIF] getDevicePushTokenAsync (register) failed', e instanceof Error ? e.message : e);
			}
		}
		if (!expoToken) {
			console.warn('[NOTIF] No Expo push token available to register');
			return null;
		}
		const { deviceId, deviceModel } = await getDeviceIdentity();
		// Call backend register endpoint (JWT is attached by request())
		try {
			const body = { deviceId, pushToken: expoToken, deviceModel, devicePushToken: devicePushToken || undefined, platform: Platform.OS } as any;
			const res = await request<any>('/devices/register', { method: 'POST', body });
			try {
				console.log('[NOTIF] Registered device push token', {
					deviceId: deviceId?.slice(0, 6) + '…',
					ok: Boolean((res as any)?.ok ?? (res as any)?.success ?? true),
					hasDevicePushToken: !!devicePushToken,
				});
			} catch {}
		} catch (e: any) {
			const msg = e?.message || 'register failed';
			console.warn('[NOTIF] Backend register failed', msg);
		}
		return expoToken;
	} catch (e: any) {
		console.warn('[NOTIF] registerPushTokenWithBackend error', e?.message || e);
		return null;
	}
}

// Best-effort: ask backend to send a push to this device's token.
// Tries a few common endpoints so it works across envs without another client release.
export async function sendServerTestNotification(token?: string, title: string = 'Test from server', body: string = 'If you see this, server push works'): Promise<{ ok: boolean; endpoint?: string; status?: number; message?: string }> {
	try {
		const pushToken = token || (await getCurrentPushToken());
		if (!pushToken) return { ok: false, message: 'No push token available' };
		const payloads: any[] = [
			{ pushToken, title, body },
			{ token: pushToken, title, body },
			{ to: pushToken, title, body },
		];
		const endpoints = [
			'/notifications/test',
			'/push/test',
			'/push/notify',
			'/notifications/send',
		];
		let lastErr: any = null;
		for (const ep of endpoints) {
			for (const p of payloads) {
				try {
					const res = await request<any>(ep, { method: 'POST', body: p });
					const ok = Boolean((res as any)?.ok ?? (res as any)?.success ?? true);
					if (ok) return { ok: true, endpoint: ep, status: 200 };
				} catch (e: any) {
					lastErr = e;
				}
			}
		}
		if (lastErr && typeof lastErr === 'object') {
			const status = (lastErr as any).status;
			const message = (lastErr as any).body?.message || (lastErr as any).message;
			return { ok: false, status, message };
		}
		return { ok: false, message: 'All endpoints failed' };
	} catch (e: any) {
		return { ok: false, message: e?.message || 'Failed to send server test' };
	}
}

// Send a test notification directly via Expo Push API (bypasses your backend)
export async function sendExpoDirectTestNotification(token?: string, title: string = 'Expo direct test', body: string = 'If you see this, Expo push delivery works'):
	Promise<{ ok: boolean; status?: number; message?: string; id?: string }>
{
	try {
		const pushToken = token || (await getCurrentPushToken());
		if (!pushToken) return { ok: false, message: 'No push token available' };
		const res = await fetch('https://exp.host/--/api/v2/push/send', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				to: pushToken,
				title,
				body,
				sound: 'default',
				channelId: Platform.OS === 'android' ? 'default' : undefined,
			}),
		});
		const json = await res.json().catch(() => ({}));
		// Response shape can be { data: { status, id } } or { data: [ { status, id } ] } or { errors }
		const data = (json && (json.data || json)) as any;
		const first = Array.isArray(data) ? data[0] : data;
		const ok = first?.status === 'ok' || res.ok;
		const id = first?.id;
		const message = json?.errors ? (json.errors[0]?.message || 'Expo push error') : undefined;
		return { ok, status: res.status, message, id };
	} catch (e: any) {
		return { ok: false, message: e?.message || 'Failed to send via Expo' };
	}
}
