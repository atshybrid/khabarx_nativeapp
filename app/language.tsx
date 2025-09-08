
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
} from 'react-native';
import { StackActions } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
// import * as Notifications from 'expo-notifications';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { LANGUAGES, Language } from '../constants/languages';
import { registerGuestUser } from '../services/api';

const LanguageSelectionScreen = () => {
  const navigation = useNavigation();
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(
    LANGUAGES.find((l) => l.code === 'te') || null
  );

  const handleLanguageSelect = async (language: Language) => {
    setSelectedLanguage(language);
    await AsyncStorage.setItem('selectedLanguage', JSON.stringify(language));

    const deviceDetails = {
      deviceId: 'mock-device-id', // Replace with actual device ID
      deviceModel: 'mock-device-model', // Replace with actual device model
    };

    try {
      const authResponse = await registerGuestUser({
        languageId: language.id,
        deviceDetails,
      });

      console.log('Guest user registered:', authResponse);
      await AsyncStorage.setItem('jwt', authResponse.jwt);
      await AsyncStorage.setItem('refreshToken', authResponse.refreshToken);

      // await requestPermissions();
      navigation.dispatch(StackActions.replace('(tabs)'));
    } catch (error) {
      console.error('Failed to register guest user:', error);
      // Handle error appropriately
    }
  };

  const requestPermissions = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Permission to access location was denied');
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    await AsyncStorage.setItem('userLocation', JSON.stringify(location));

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
  };

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

  const otherLanguages = LANGUAGES.filter(l => l.id !== selectedLanguage?.id);

  return (
    <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContainer}>
            {selectedLanguage && renderLanguageItem(selectedLanguage, true)}
            <View style={styles.gridContainer}>
                {otherLanguages.map((item) => renderLanguageItem(item, false))}
            </View>
        </ScrollView>
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
    elevation: 2, // for Android shadow
    shadowColor: '#000', // for iOS shadow
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    height: 110, // Fixed height for all cards
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
});

export default LanguageSelectionScreen;
