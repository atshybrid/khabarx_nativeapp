import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterPreferencesUpdated, getLanguages, getUserPreferences, resolveEffectiveLanguage, updatePreferences } from './api';
import { loadTokens, logoutAndClearProfile } from './auth';
import { emit } from './events';
import { ensureNotificationsSetup, getCurrentPushToken } from './notifications';
import { requestAppPermissions } from './permissions';

const LAST_SENT_PUSH_TOKEN = 'last_sent_push_token';
const LAST_SYNC_AT = 'last_prefs_sync_at';

export type AutoSyncReason = 'login' | 'app_start' | 'foreground' | 'manual';

// Collect local state (language, push token, location) and reconcile against server preferences.
// Sends only available keys; always forceUpdate true per server contract.
export async function autoSyncPreferences(reason: AutoSyncReason = 'manual') {
	try {
		const tokens = await loadTokens();
		const userId = tokens?.user?.id || tokens?.user?._id || tokens?.user?.userId;
		if (!userId) return; // nothing to sync when not authenticated

		// Fetch server preferences for comparison (best-effort)
		const server = await getUserPreferences(userId).catch(() => null);

		// Language (local-first)
			const effLang = await resolveEffectiveLanguage();
			const serverLangId = server?.user?.languageId || undefined;
			const serverLangCode = (server?.user?.languageCode || '').toString().toLowerCase() || undefined;
			const needLang = (
				(!!effLang.id && String(effLang.id) !== String(serverLangId || '')) ||
				(!!effLang.code && effLang.code.toLowerCase() !== String(serverLangCode || ''))
			);

		// Push token: avoid re-prompting if we already have one cached
		let pushToken = await getCurrentPushToken();
		if (!pushToken) {
			const setup = await ensureNotificationsSetup();
			pushToken = setup.expoToken || (await getCurrentPushToken());
		}
		const lastSent = (await AsyncStorage.getItem(LAST_SENT_PUSH_TOKEN)) || '';
		const serverHasPush = Boolean(server?.device?.hasPushToken);
		const serverPushToken = (server as any)?.device?.pushToken as string | undefined;
		// Push when:
		// - server has no token OR
		// - local differs from last sent (client cache) OR
		// - backend explicitly reports a different token string
		const needPush = !!pushToken && (
			!serverHasPush || pushToken !== lastSent || (serverPushToken && serverPushToken !== pushToken)
		);

		// Location (request permissions + best-effort current coords)
		const perms = await requestAppPermissions();
		const coords = perms.coordsDetailed || null;
		const place = perms.place || null;
		const needLocation = !!coords; // include when we have coords
		const location = needLocation
			? {
					latitude: coords!.latitude,
					longitude: coords!.longitude,
					accuracyMeters: typeof coords!.accuracy === 'number' ? coords!.accuracy : undefined,
					placeId: undefined as any, // not resolved here
					placeName: place?.fullName || place?.name || undefined,
					address: [place?.street, place?.city, place?.region, place?.country].filter(Boolean).join(', ') || undefined,
					source: 'GPS',
				}
			: undefined;

		// If nothing to update, bail early
		if (!needLang && !needPush && !needLocation) {
			try { await AsyncStorage.setItem(LAST_SYNC_AT, String(Date.now())); } catch {}
			return;
		}

			const partial: any = { forceUpdate: true };
			if (needLang) {
				// If server already has a language, SERVER WINS: override local storage to match server and do not push language to server
				const serverHasLang = Boolean(serverLangId || serverLangCode);
				if (serverHasLang) {
					try {
						const list = await getLanguages();
						let srv = list.find(l => serverLangId && String(l.id) === String(serverLangId));
						if (!srv && serverLangCode) srv = list.find(l => String(l.code).toLowerCase() === String(serverLangCode));
						if (srv) {
							// Override local storage to server language
							await AsyncStorage.setItem('selectedLanguage', JSON.stringify({ id: srv.id, code: srv.code, name: srv.name, nativeName: srv.nativeName }));
							await AsyncStorage.multiSet([
								['language_local', JSON.stringify({ id: srv.id, code: srv.code, name: srv.name })],
								['language_local_id', String(srv.id)],
								['language_local_code', String(srv.code)],
								['language_local_name', String(srv.name)],
							]);
							// Let downstream caches refresh using server language
							await afterPreferencesUpdated({ languageIdChanged: String(srv.id), languageCode: srv.code });
							// QA visibility: surface a toast indicating server-wins override
							try { emit('toast:show', { message: `Language synced from server: ${srv.name}` } as any); } catch {}
						}
					} catch {}
				} else {
					// Server has no language yet: push local language (validated) to server
					let sendLangId: string | undefined = effLang.id ? String(effLang.id) : undefined;
					let sendLangCode: string | undefined = effLang.code ? String(effLang.code) : undefined;
					try {
						const list = await getLanguages();
						const byId = sendLangId ? list.find(l => String(l.id) === String(sendLangId)) : undefined;
						const byCode = !byId && sendLangCode ? list.find(l => String(l.code).toLowerCase() === String(sendLangCode).toLowerCase()) : undefined;
						if (byId) { sendLangId = String(byId.id); sendLangCode = String(byId.code); }
						else if (byCode) { sendLangId = String(byCode.id); sendLangCode = String(byCode.code); }
						else { sendLangId = undefined; }
					} catch {}
					if (sendLangId) partial.languageId = sendLangId;
					if (sendLangCode) partial.languageCode = sendLangCode;
				}
			}
		if (needPush && pushToken) partial.pushToken = pushToken;
		if (needLocation && location) partial.location = location;

		try {
			await updatePreferences(partial, userId);
		} catch (e: any) {
			// Retry removing languageId if server rejects it
			const status = (e as any)?.status;
			const msg = (e as any)?.message || '';
			const bodyMsg = (e as any)?.body?.message || '';
			const looksLikeLangError = /invalid\s*languageid/i.test(msg) || /invalid\s*languageid/i.test(bodyMsg);
			if ((partial.languageId && (status === 400 || status === 422 || looksLikeLangError))) {
				const fallback: any = { ...partial };
				delete fallback.languageId;
				if (!fallback.languageCode && effLang.code) fallback.languageCode = String(effLang.code);
				await updatePreferences(fallback, userId);
				// QA visibility: indicate we fixed invalid languageId by using code
				try {
					if (fallback.languageCode) emit('toast:show', { message: `Language updated using code (${fallback.languageCode})` } as any);
				} catch {}
				partial.languageId = undefined; // reflect final state for below logic
			} else {
				throw e;
			}
		}

		// After update: cache last sent pushToken to detect changes later
		if (pushToken) { try { await AsyncStorage.setItem(LAST_SENT_PUSH_TOKEN, pushToken); } catch {} }
		// If language changed, trigger downstream refreshes
		if (needLang && !serverLangId && !serverLangCode) {
			// Only trigger client refresh if we actually pushed local language to server in this run
			if (partial.languageId) {
				await afterPreferencesUpdated({ languageIdChanged: String(partial.languageId), languageCode: effLang.code || null });
			} else {
				await afterPreferencesUpdated({ languageIdChanged: null, languageCode: effLang.code || null });
			}
		}
			// Re-fetch to confirm sync
			try { await getUserPreferences(userId); } catch {}
		try { await AsyncStorage.setItem(LAST_SYNC_AT, String(Date.now())); } catch {}
	} catch (e) {
		try {
			const msg = (e as any)?.message || `${e}`;
			// If server reports that the user no longer exists, perform a local logout to avoid
			// repeated sync attempts and surface a friendly toast to the user.
			const isUserNotFound = (e as any)?.status === 404 || String(msg).toLowerCase().includes('user not found');
			if (isUserNotFound) {
				try {
					await logoutAndClearProfile({ mobileNumberHint: undefined });
				} catch {}
				try { emit('toast:show', { message: 'Session invalid – please sign in again' } as any); } catch {}
				return;
			}
			console.warn('[LOGIN_SYNC] autoSyncPreferences failed', msg);
		} catch {}
	}
}

