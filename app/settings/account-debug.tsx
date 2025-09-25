import { getMockMode, setMockMode } from '@/services/api';
import { clearTokens } from '@/services/auth';
import { logAllStorage, logStorageKey, storageHealthCheck } from '@/services/debugStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function AccountDebugScreen() {
  const [mockMode, setMockModeState] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    (async () => setMockModeState(await getMockMode()))();
  }, []);

  const toggleMock = async (val: boolean) => {
    await setMockMode(val);
    setMockModeState(val);
  };

  const handleClearAllStorage = async () => {
    await AsyncStorage.clear();
    console.log('[NAV] AccountDebugScreen: All AsyncStorage cleared');
    alert('All app storage cleared. Restart app to test onboarding.');
  };

  const handleClearMockAuth = async () => {
    try {
      // Turn OFF mock mode and clear any stored auth tokens
      await setMockMode(false);
      setMockModeState(false);
      await clearTokens();
      console.log('[DEBUG] Cleared mock auth: mockMode=false, tokens removed');
      alert('Mock auth cleared. Using real API on next boot.');
      // Optionally bounce back to splash to re-run boot flow immediately
      try { router.replace('/splash'); } catch {}
    } catch (e) {
      console.warn('Failed to clear mock auth', e);
      alert('Failed to clear mock auth. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Debug Tools</Text>
      <TouchableOpacity onPress={handleClearAllStorage} style={styles.button}>
        <Text style={styles.buttonText}>Clear ALL App Storage (Debug)</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleClearMockAuth} style={[styles.button, styles.buttonSecondary]}>
        <Text style={styles.buttonText}>Clear Mock Auth (Disable Mock)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => logAllStorage({ includeValues: true, maxValueLength: 600 })}
        style={[styles.button, styles.buttonInfo]}
      >
        <Text style={styles.buttonText}>Dump All Storage to Log</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => logAllStorage({ includeValues: true, filterPrefix: 'news_cache:' })}
        style={[styles.button, styles.buttonInfo]}
      >
        <Text style={styles.buttonText}>Dump News Cache Keys</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => logStorageKey('preferences_cache_v1')}
        style={[styles.button, styles.buttonInfo]}
      >
        <Text style={styles.buttonText}>Show Preferences Cache</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => storageHealthCheck()}
        style={[styles.button, styles.buttonInfo]}
      >
        <Text style={styles.buttonText}>Storage Health Check</Text>
      </TouchableOpacity>
      <View style={styles.row}>
        <Text style={styles.rowText}>Mock Mode</Text>
        <Switch value={mockMode} onValueChange={toggleMock} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  button: {
    backgroundColor: '#e74c3c',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 10,
  },
  buttonSecondary: {
    backgroundColor: '#c0392b',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
  },
  buttonInfo: {
    backgroundColor: '#2563eb',
  },
  row: {
    marginTop: 16,
    paddingHorizontal: 24,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    fontSize: 16,
    color: '#333',
  },
});
