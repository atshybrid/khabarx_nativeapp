import { makeShadow } from '@/utils/shadow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
// import * as Location from 'expo-location';
// import * as Notifications from 'expo-notifications';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { LanguageSkeleton } from '@/components/ui/LanguageSkeleton';
import { saveTokens } from '@/services/auth';
import { getDeviceIdentity } from '@/services/device';
import { requestAppPermissions } from '@/services/permissions';
import { Language } from '../constants/languages';
import { afterPreferencesUpdated, getLanguages, registerGuestUser, updatePreferences } from '../services/api';

const LanguageSelectionScreen = () => {
  // use expo-router to navigate to the News tab after selection
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [languages, setLanguages] = useState<Language[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const list = await getLanguages();
        setLanguages(list);
        // Show the first API item as top full-width card; preserve backend order
        if (list?.length) setSelectedLanguage(list[0]);
        setLoadError(null);
      } catch {
        setLoadError('Failed to load languages');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLanguageSelect = async (language: Language) => {
    if (submitting || loading) return;
    setSelectedLanguage(language);
    await AsyncStorage.setItem('selectedLanguage', JSON.stringify(language));
    // Keep member/admin local override in sync so Account screen reflects immediately
    try { await AsyncStorage.setItem('language_local', JSON.stringify(language)); } catch {}

  const deviceDetails = await getDeviceIdentity();

    try {
      setSubmitting(true);
      setSubmitError(null);
      // If we already have tokens, skip re-registering
      const existingJwt = await AsyncStorage.getItem('jwt');
      const existingRefresh = await AsyncStorage.getItem('refreshToken');
      if (existingJwt && existingRefresh) {
        try {
          await updatePreferences({ languageId: language.id, languageCode: language.code });
          await afterPreferencesUpdated({ languageIdChanged: language.id, languageCode: language.code });
        } catch {}
        router.replace('/news');
        return;
      }

      const perms = await requestAppPermissions();
      const authResponse = await registerGuestUser({
        // Backend expects string IDs like "cmfdwhqk80009ugtof37yt8vv"
        languageId: language.id,
        deviceDetails,
        location: perms.coords ? { latitude: perms.coords.latitude, longitude: perms.coords.longitude } : undefined,
        pushToken: perms.pushToken,
      });

      console.log('Guest user registered:', authResponse);
      await saveTokens({
        jwt: authResponse.jwt,
        refreshToken: authResponse.refreshToken,
        expiresAt: authResponse.expiresAt || (Date.now() + 24 * 3600 * 1000),
        languageId: authResponse.languageId || language.id,
        user: authResponse.user,
      });

      try {
        // Warm caches for the chosen language
        await afterPreferencesUpdated({ languageIdChanged: language.id, languageCode: language.code });
      } catch {}

      // await requestPermissions();
      router.replace('/news');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Failed to register guest user:', msg);
      setSubmitError(msg || 'Failed to register. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // const requestPermissions = async () => {
  //   let { status } = await Location.requestForegroundPermissionsAsync();
  //   if (status !== 'granted') {
  //     console.log('Permission to access location was denied');
  //     return;
  //   }
  //
  //   let location = await Location.getCurrentPositionAsync({});
  //   await AsyncStorage.setItem('userLocation', JSON.stringify(location));

    // const { status: existingStatus } = await Notifications.getPermissionsAsync();        
    // let finalStatus = existingStatus;
    // if (existingStatus !== 'granted') {
    //   const { status } = await Notifications.requestPermissionsAsync();
    //   finalStatus = status;
    // }
    // if (finalStatus !== 'granted') {
    //   console.log('Failed to get push token for push notification!');
    //   return;
    // }

    // const token = (await Notifications.getExpoPushTokenAsync()).data;
    // console.log('FCM Token:', token);
  // };

  const renderLanguageItem = (item: Language, isSelected: boolean) => (
    <TouchableOpacity
      key={item.id}
      onPress={() => handleLanguageSelect(item)}
      style={isSelected ? styles.fullWidthContainer : styles.gridItemContainer}
    >
      <View
        style={[
          styles.item,
          { borderBottomColor: item.color },
          isSelected && styles.selectedItem,
        ]}
      >
        <View style={styles.languageNames}>
          <Text style={[styles.nativeName, { color: item.color }]}>{item.nativeName}</Text>
          <Text style={styles.englishName}>{item.name}</Text>
        </View>
        <View style={styles.checkmarkContainer}>
            {isSelected && (
              <MaterialCommunityIcons name="check-circle" size={24} color="green" />        
            )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Show only the first language as the top card; remaining languages follow as grid, in the same API order
  const otherLanguages = (languages || []).slice(1);

  return (
    <View style={styles.container}>
      {loading && <LanguageSkeleton />}
      {!loading && loadError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Unable to load languages.</Text>
          <TouchableOpacity
            onPress={async () => {
              setLoading(true);
              setLoadError(null);
              try {
                const list = await getLanguages();
                setLanguages(list);
              } catch {
                setLoadError('Retry failed');
              } finally {
                setLoading(false);
              }
            }}
            style={styles.retryBtn}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {!loading && !loadError && (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContainer}>
          {selectedLanguage && renderLanguageItem(selectedLanguage, true)}
          <View style={styles.gridContainer}>
            {otherLanguages.map((item) => renderLanguageItem(item, false))}
          </View>
          {submitError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{submitError}</Text>
              <TouchableOpacity
                onPress={() => selectedLanguage && handleLanguageSelect(selectedLanguage)}
                style={styles.retryBtn}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Retry Register</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {submitting && (
        <View style={[styles.overlay, { pointerEvents: 'auto' }]}>
          <View style={styles.overlayCard}>
            <MaterialCommunityIcons name="loading" size={22} color="#444" />
            <Text style={styles.overlayText}>Setting up your experience…</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    padding: 10,
  },
  fullWidthContainer: {
    margin: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  gridItemContainer: {
    width: '50%',
    padding: 5,
  },
  item: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    borderBottomWidth: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 110, // Fixed height for all cards
    ...makeShadow(2, { opacity: 0.2, blur: 3, y: 1 })
  },
  selectedItem: {
    // Add any style for selected item if needed, like a border
  },
  languageNames: {
    flex: 1,
    justifyContent: 'center',
  },
  nativeName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  englishName: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  checkmarkContainer: {
      width: 24, // same as the icon size
      height: 24, // same as the icon size
      alignItems: 'center',
      justifyContent: 'center',
  },
  // Error and retry UI
  errorBox: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fdecea',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#f5c6cb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#b00020',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  // Submitting overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    ...makeShadow(3, { opacity: 0.2, blur: 3, y: 1 })
  },
  overlayText: {
    marginLeft: 10,
    color: '#333',
    fontWeight: '600',
  },
});

export default LanguageSelectionScreen;
