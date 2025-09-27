import { useThemeColor } from '@/hooks/useThemeColor';
import { getPrivacyPolicy } from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function PrivacyPolicyPage() {
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const [html, setHtml] = useState<string | null>(null);
  // derive language from stored preference

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('selectedLanguage');
        const parsed = raw ? JSON.parse(raw) : null;
        const code = (parsed?.code || parsed?.languageCode || 'en').toLowerCase();
        const doc = await getPrivacyPolicy(code);
        setHtml(doc?.content || '<p>No content</p>');
      } catch {
        setHtml('<p>Failed to load privacy policy.</p>');
      }
    })();
  }, []);

  const source = useMemo(() => ({ html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{font-family: -apple-system, Roboto, Arial, sans-serif; padding: 12px; line-height: 1.6; color: ${text}; background:${bg};}</style></head><body>${html || ''}</body></html>` }), [html, bg, text]);

  return (
    <View style={[styles.safe, { backgroundColor: bg }] }>
      {html ? (
        <WebView originWhitelist={["*"]} source={source} />
      ) : (
        <View style={styles.center}> 
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
