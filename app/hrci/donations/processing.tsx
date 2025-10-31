import { emit } from '@/services/events';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DonationProcessingScreen() {
  const router = useRouter();
  const { htmlUrl = '', pdfUrl = '' } = useLocalSearchParams<{ htmlUrl?: string; pdfUrl?: string }>();
  const [opening, setOpening] = useState(false);
  const attempted = useRef(false);

  const openReceipt = useCallback(async () => {
    const url = String(pdfUrl || htmlUrl || '').trim();
    if (!url) return;
    if (attempted.current) return;
    attempted.current = true;
    try {
      setOpening(true);
      try { emit('toast:show', { message: 'Opening receipt in browser…' }); } catch {}
      try { await Clipboard.setStringAsync(url); emit('toast:show', { message: 'Link copied to clipboard' }); } catch {}
      await WebBrowser.openBrowserAsync(url);
    } finally {
      setOpening(false);
  // After closing the browser, send the user to the main donations tab page
  try { router.replace('/donations'); } catch {}
    }
  }, [htmlUrl, pdfUrl, router]);

  useEffect(() => {
    const t = setTimeout(() => { openReceipt(); }, 600);
    return () => { clearTimeout(t); };
  }, [openReceipt]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
  <TouchableOpacity onPress={() => router.replace('/donations')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.heading}>Finalizing Receipt</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <LottieView source={require('@/assets/lotti/donate.json')} autoPlay loop style={{ width: 200, height: 200 }} />
        <Text style={{ color: '#111827', fontWeight: '800', marginTop: 10 }}>Generating your receipt…</Text>
        <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 6 }}>We will open your receipt in the browser. You can download or share it from there.</Text>

        <TouchableOpacity style={[styles.cta, { marginTop: 16 }]} onPress={openReceipt} disabled={opening || (!htmlUrl && !pdfUrl)}>
          {opening ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Open Receipt Now</Text>}
        </TouchableOpacity>

  <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/donations')}>
          <Text style={styles.backBtnText}>Back to Donations</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#eef0f4' },
  heading: { fontSize: 18, fontWeight: '800', color: '#111827', flex: 1, textAlign: 'center' },
  cta: { backgroundColor: '#1D0DA1', paddingVertical: 14, borderRadius: 12, alignItems: 'center', paddingHorizontal: 20, alignSelf: 'stretch' },
  ctaText: { color: '#fff', fontWeight: '700' },
  backBtn: { marginTop: 8, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', alignSelf: 'stretch' },
  backBtnText: { color: '#111827', fontWeight: '700' },
});
