import { useHrciOnboarding } from '@/context/HrciOnboardingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Launcher that reuses public flow: level -> cells -> designations -> geo -> admin availability -> finalize
export default function AdminMemberNewLauncher() {
  const { setReturnToAfterGeo } = useHrciOnboarding();

  useEffect(() => {
    (async () => {
      // After geo selection, navigate to admin availability step
      try { setReturnToAfterGeo('/hrci/admin/members/admin-availability'); } catch {}
      // Persist a marker so if context reloads we still treat back as returning to memberships list
      try { await AsyncStorage.setItem('HRCI_ADMIN_MEMBER_CREATE_ACTIVE', '1'); } catch {}
      router.replace('/hrci/level' as any);
    })();
  }, [setReturnToAfterGeo]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.txt}>Starting member creation…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  txt: { marginTop: 8, color: '#334155', fontWeight: '700' },
});
