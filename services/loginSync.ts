import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from './logger';
import { notificationService } from './notifications';
import { updateAll } from './preferences';

/**
 * Login Response Sync
 * 
 * After successful login with CITIZEN_REPORTER role:
 * 1. Compare login response languageId/location with stored preferences
 * 2. Get current push token 
 * 3. If any differences found, call /preferences/update with new data
 * 
 * This ensures backend preferences stay synced with user's latest device state.
 */

interface LoginResponseData {
  jwt: string;
  refreshToken: string;
  expiresIn?: number;
  user: {
    userId: string;
    role: string;
    languageId: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    provider?: string;
    timestampUtc?: string;
    placeId?: string;
    placeName?: string;
    address?: string;
    source?: string;
  };
}

/**
 * Sync preferences after successful login
 */
export async function syncPreferencesAfterLogin(loginData: LoginResponseData) {
  try {
    log.info('login.syncPreferences.start', { 
      userId: loginData.user.userId, 
      role: loginData.user.role,
      loginLanguageId: loginData.user.languageId,
      hasLoginLocation: !!loginData.location
    });
    
    // Get stored selected language
    let storedLanguageId: string | null = null;
    try {
      const langRaw = await AsyncStorage.getItem('selectedLanguage');
      if (langRaw) {
        const parsed = JSON.parse(langRaw);
        storedLanguageId = parsed?.id || null;
        log.info('login.syncPreferences.storedLanguage', { raw: langRaw, parsed, storedLanguageId });
      } else {
        log.info('login.syncPreferences.storedLanguage', 'No stored language found');
      }
    } catch (e) {
      log.warn('login.syncPreferences.storedLanguage.error', String(e));
    }
    
    // Get current push token
    let currentPushToken: string | null = null;
    try {
      currentPushToken = await notificationService.getNotificationToken();
      log.info('login.syncPreferences.pushToken', { currentPushToken });
    } catch (e) {
      log.warn('login.syncPreferences.pushToken.error', String(e));
    }
    
    // Get cached preferences to compare push token
    let cachedPushToken: string | null = null;
    try {
      const cachedPrefs = await AsyncStorage.getItem('preferences_cache_v1');
      if (cachedPrefs) {
        const parsed = JSON.parse(cachedPrefs);
        cachedPushToken = parsed?.pushToken || null;
        log.info('login.syncPreferences.cachedPrefs', { cachedPushToken, cachedLanguageId: parsed?.languageId });
      }
    } catch (e) {
      log.warn('login.syncPreferences.cachedPrefs.error', String(e));
    }
    
    // Compare what needs updating
    const loginLanguageId = loginData.user.languageId;
    const loginLocation = loginData.location;
    
    // Language: if stored language differs from login response, use stored (local choice wins)
    const needsLanguageUpdate = storedLanguageId && storedLanguageId !== loginLanguageId;
    
    // Push token: if current token differs from cached, update
    const needsPushUpdate = currentPushToken && currentPushToken !== cachedPushToken;
    
    // Location: always update if provided in login response
    const needsLocationUpdate = loginLocation !== undefined;
    
    log.info('login.syncPreferences.comparison', {
      storedLanguageId,
      loginLanguageId,
      needsLanguageUpdate,
      currentPushToken,
      cachedPushToken,
      needsPushUpdate,
      needsLocationUpdate,
      loginLocation: loginLocation ? 'present' : 'absent'
    });
    
    if (!needsLanguageUpdate && !needsPushUpdate && !needsLocationUpdate) {
      log.info('login.syncPreferences.skip', 'No differences found - preferences are already in sync');
      return;
    }

    // Prepare update payload
    const updatePayload: {
      languageId?: string | null;
      pushToken?: string | null;
      location?: any | null;
    } = {};
    
    // Use stored language if different from login response (user's local choice wins)
    if (needsLanguageUpdate) {
      updatePayload.languageId = storedLanguageId;
    }
    
    if (needsPushUpdate) {
      updatePayload.pushToken = currentPushToken;
    }
    
    if (needsLocationUpdate && loginLocation) {
      updatePayload.location = {
        latitude: loginLocation.latitude,
        longitude: loginLocation.longitude,
        accuracyMeters: loginLocation.accuracyMeters,
        placeId: loginLocation.placeId || null,
        placeName: loginLocation.placeName || null,
        address: loginLocation.address || null,
        source: loginLocation.source || 'GPS'
      };
    }

    log.info('login.syncPreferences.payload', { 
      updatePayload,
      fields: Object.keys(updatePayload),
      size: JSON.stringify(updatePayload).length
    });

    // Call preferences update API
    await updateAll(updatePayload);
    
    log.info('login.syncPreferences.success', { updated: Object.keys(updatePayload) });
    
  } catch (error) {
    // Better error logging without causing JavaScript errors
    let errorInfo = 'Unknown error';
    try {
      if (error && typeof error === 'object') {
        const e = error as any;
        const message = e.message || e.toString() || 'No message';
        const status = e.status || 'no status';
        errorInfo = `${message} (status: ${status})`;
      } else {
        errorInfo = String(error);
      }
    } catch {
      errorInfo = 'Error parsing failed';
    }
    
    log.error('login.syncPreferences.failed', `Failed to update preferences: ${errorInfo}`);
    // Don't throw - this is best-effort sync, shouldn't block login flow
  }
}