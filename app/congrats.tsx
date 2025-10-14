import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';

export default function CongratsScreen() {
  const router = useRouter();
  const [LottieComp, setLottieComp] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== 'web') {
      (async () => {
        try {
          const mod = await import('lottie-react-native');
          if (!cancelled) setLottieComp(() => (mod as any).default || mod);
        } catch (e) {
          console.warn('[Congrats] Lottie import failed, falling back', (e as any)?.message);
        }
      })();
    } else {
      setLottieComp(null);
    }
    return () => { cancelled = true; };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        {LottieComp ? (
          <LottieComp
            source={require('../assets/lotti/congratulation.json')}
            autoPlay
            loop={false}
            style={{ width: 260, height: 260 }}
          />
        ) : (
          <View style={styles.fallbackAnim}>
            <Text style={styles.fallbackEmoji}>🎉</Text>
          </View>
        )}
        <Text style={styles.title}>Congratulations!</Text>
        <Text style={styles.subtitle}>Your article has been published successfully.</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/news')}>
            <Text style={styles.primaryBtnText}>View News Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/explore')}>
            <Text style={styles.secondaryBtnText}>Post Another</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: 8 },
  subtitle: { fontSize: 15, color: '#475569', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  actions: { marginTop: 28, width: '100%', gap: 14 },
  primaryBtn: { backgroundColor: Colors.light.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#f1f5f9', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  secondaryBtnText: { color: Colors.light.primary, fontSize: 15.5, fontWeight: '600' },
  fallbackAnim: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  fallbackEmoji: { fontSize: 120 },
});
