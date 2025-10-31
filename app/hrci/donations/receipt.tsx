import { emit } from '@/services/events';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function DonationReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    htmlUrl?: string;
    pdfUrl?: string;
    donationId?: string;
    receiptNo?: string;
    amount?: string;
  }>();

  const htmlUrl = useMemo(() => String(params?.htmlUrl || ''), [params?.htmlUrl]);
  const pdfUrl = useMemo(() => String(params?.pdfUrl || ''), [params?.pdfUrl]);
  const receiptNo = useMemo(() => String(params?.receiptNo || ''), [params?.receiptNo]);
  const donationId = useMemo(() => String(params?.donationId || ''), [params?.donationId]);
  // amount not used in UI for now; can be displayed later if needed
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const title = receiptNo ? `Receipt ${receiptNo}` : 'Donation Receipt';

  const onDownloadPdf = async () => {
    const url = (pdfUrl || '').trim();
    if (!url) {
      // Fallback: open HTML in browser if no PDF
      if (htmlUrl) {
        try { emit('toast:show', { message: 'Opening receipt in browser…' }); } catch {}
        try { await Clipboard.setStringAsync(htmlUrl); emit('toast:show', { message: 'Link copied to clipboard' }); } catch {}
        await WebBrowser.openBrowserAsync(htmlUrl);
      } else {
        Alert.alert('Unavailable', 'Receipt link is not available yet.');
      }
      return;
    }
    try {
      // If it's an http(s) URL, opening in browser is often best UX on Android
      if (/^https?:\/\//i.test(url)) {
        // Try open in browser first; if the user wants a local copy, they can choose save in the browser
        try { emit('toast:show', { message: 'Opening receipt in browser…' }); } catch {}
        try { await Clipboard.setStringAsync(url); emit('toast:show', { message: 'Link copied to clipboard' }); } catch {}
        await WebBrowser.openBrowserAsync(url);
        return;
      }
      setDownloading(true);
  const fileName = `receipt-${receiptNo || donationId || 'donation'}.pdf`;
  const docDir = (FileSystem as any).documentDirectory as string | undefined;
  const cacheDir = (FileSystem as any).cacheDirectory as string | undefined;
  const baseDir = docDir || cacheDir || '';
  const fileUri = `${baseDir}${fileName}`;
      const dl = FileSystem.createDownloadResumable(url, fileUri);
      await dl.downloadAsync();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Share Receipt PDF' });
      } else {
        Alert.alert('Downloaded', `Saved to: ${fileUri}`);
      }
    } catch (e: any) {
      Alert.alert('Download Failed', e?.message || 'Could not download the receipt.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/donations')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.heading}>{title}</Text>
        <View style={{ width: 22 }} />
      </View>

      {!htmlUrl ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#111827', fontWeight: '700', textAlign: 'center' }}>Receipt not available yet.</Text>
          <Text style={{ color: '#6b7280', marginTop: 6, textAlign: 'center' }}>Please try again in a moment or check your WhatsApp/Email.</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {loading && (
            <View style={styles.loadingCover}>
              <ActivityIndicator size="large" color="#1D0DA1" />
              <Text style={{ color: '#6b7280', marginTop: 8 }}>Loading receipt…</Text>
            </View>
          )}
          <WebView
            source={{ uri: htmlUrl }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            startInLoadingState
            javaScriptEnabled
            scalesPageToFit
            originWhitelist={["*"]}
            style={{ flex: 1 }}
          />
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.cta, (!pdfUrl || downloading) && styles.ctaDisabled]} onPress={onDownloadPdf} disabled={!pdfUrl || downloading}>
          {downloading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>{pdfUrl ? 'Open/Download PDF' : 'Open in Browser'}</Text>
          )}
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
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: '#eef0f4', backgroundColor: '#fff', gap: 8 },
  cta: { backgroundColor: '#1D0DA1', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontWeight: '700' },
  backBtn: { paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  backBtnText: { color: '#111827', fontWeight: '700' },
  loadingCover: { position: 'absolute', left: 0, right: 0, top: Platform.OS === 'android' ? 0 : 0, bottom: 0, zIndex: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
});
