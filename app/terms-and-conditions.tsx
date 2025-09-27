import LegalSkeleton from '@/components/ui/LegalSkeleton';
import { useThemeColor } from '@/hooks/useThemeColor';
import { getPrivacyPolicy } from '@/services/api';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function TermsAndConditionsPage() {
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const doc = await getPrivacyPolicy('en');
        setHtml(doc?.content || '<p>No content</p>');
      } catch {
        setHtml('<p>Failed to load terms.</p>');
      }
    })();
  }, []);

  const source = useMemo(() => ({ html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{font-family: -apple-system, Roboto, Arial, sans-serif; padding: 12px; line-height: 1.6; color: ${text}; background:${bg};}</style></head><body>${html || ''}</body></html>` }), [html, bg, text]);

  return (
    <View style={[styles.safe, { backgroundColor: bg }] }>
      {html ? (
        <WebView originWhitelist={["*"]} source={source} />
      ) : (
        <LegalSkeleton />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
