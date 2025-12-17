import MobileLoginModal from '@/components/MobileLoginModal';
import { loadTokens } from '@/services/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  // Thin wrapper: render bottom-sheet login and route appropriately
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await loadTokens();
        if (t?.jwt) {
          if (params.from === 'post') router.replace('/explore');
          else router.replace('/news');
        }
      } catch {}
    })();
  }, [params.from, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.header}>Citizen Reporter</Text>
        <Text style={styles.sub}>Sign in or create your account</Text>
      </View>
      <MobileLoginModal
        visible={visible}
        onClose={() => {
          setVisible(false);
          if (router.canGoBack()) router.back(); else router.replace('/news');
        }}
        onSuccess={() => {
          setVisible(false);
          if (params.from === 'post') router.replace('/explore'); else router.replace('/news');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sub: { marginTop: 6, color: '#6b7280' },
});
