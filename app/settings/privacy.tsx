import { useThemeColor } from '@/hooks/useThemeColor';
import { getLockMode, type AppLockMode } from '@/services/appLock';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

export default function PrivacyScreen() {
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');
  const router = useRouter();

  // Local UI state (could be wired to real preferences later)
  const [personalizedAds, setPersonalizedAds] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const [crashReports, setCrashReports] = useState(true);
  const [lockMode, setLockModeSummary] = useState<AppLockMode>('off');
  useEffect(() => { (async () => setLockModeSummary(await getLockMode()))(); }, []);

  type SectionItem = {
    icon: string;
    title: string;
    subtitle: string;
    right?: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
  };
  type SectionDef = { title: string; items: SectionItem[] };

  const sections = useMemo<SectionDef[]>(() => ([
    {
      title: 'Privacy Controls',
      items: [
        {
          icon: 'shield',
          title: 'Personalized Ads',
          subtitle: 'Allow using your app activity to personalize ads',
          right: (
            <Switch value={personalizedAds} onValueChange={setPersonalizedAds} />
          ),
        },
        {
          icon: 'bar-chart-2',
          title: 'Analytics',
          subtitle: 'Send usage data to improve app features',
          right: (
            <Switch value={analytics} onValueChange={setAnalytics} />
          ),
        },
        {
          icon: 'alert-triangle',
          title: 'Crash Reports',
          subtitle: 'Automatically send crash diagnostics',
          right: (
            <Switch value={crashReports} onValueChange={setCrashReports} />
          ),
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          icon: 'lock',
          title: 'App Lock',
          subtitle: `Current: ${lockMode === 'off' ? 'Off' : lockMode === 'biometric' ? 'Biometric' : lockMode === 'mpin' ? 'MPIN' : 'Biometric + MPIN'}`,
          onPress: () => router.push({ pathname: '/settings/app-lock' } as any),
        },
      ],
    },
    {
      title: 'Data & Legal',
      items: [
        {
          icon: 'file-text',
          title: 'Privacy Policy',
          subtitle: 'How we collect and use your data',
          onPress: () => router.push('/privacy-policy' as any),
        },
        {
          icon: 'file-text',
          title: 'Terms & Conditions',
          subtitle: 'Your rights and obligations',
          onPress: () => router.push('/terms-and-conditions' as any),
        },
        {
          icon: 'key',
          title: 'Permissions',
          subtitle: 'See permissions used by the app',
          onPress: () => router.push('/settings/permissions'),
        },
        {
          icon: 'trash-2',
          title: 'Delete Account',
          subtitle: 'Permanently remove your data from our servers',
          onPress: () => Alert.alert('Delete Account', 'This will permanently delete your account and data. This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Requested', 'Your deletion request has been submitted.') },
          ]),
        },
      ],
    },
  ]), [personalizedAds, analytics, crashReports, lockMode, router]);

  return (
    <View style={[styles.safe, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Feather name="shield" size={22} color={text} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.title, { color: text }]}>Privacy & Security</Text>
            <Text style={[styles.subtitle, { color: muted }]}>Manage how your data is used and keep your account secure</Text>
          </View>
        </View>

        {sections.map((section, si) => (
          <View key={si} style={[styles.card, { backgroundColor: card, borderColor: border }]}> 
            <Text style={[styles.cardTitle, { color: text }]}>{section.title}</Text>
            <View style={styles.divider} />
            {section.items.map((item: any, ii) => (
              <Pressable
                key={ii}
                onPress={item.onPress as any}
                disabled={!item.onPress}
                style={({ pressed }) => [styles.itemRow, pressed && { backgroundColor: 'rgba(0,0,0,0.035)' }]}
              >
                <View style={styles.itemLeft}>
                  <View style={[styles.iconWrap, { borderColor: border }]}>
                    <Feather name={(item.icon as any) || 'settings'} size={18} color={text} />
                  </View>
                  <View style={styles.textWrap}>
                    <Text style={[styles.itemTitle, { color: text }]} numberOfLines={1}>{item.title}</Text>
                    {item.subtitle ? <Text style={[styles.itemSubtitle, { color: muted }]} numberOfLines={2}>{item.subtitle}</Text> : null}
                  </View>
                </View>
                <View style={styles.itemRight}>
                  {item.right ? item.right : (item.onPress ? <Feather name="chevron-right" size={18} color={muted} /> : null)}
                </View>
              </Pressable>
            ))}
          </View>
        ))}

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)', marginRight: 12 },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { marginTop: 4 },

  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 8 },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderRadius: 10 },
  itemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  textWrap: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemSubtitle: { marginTop: 2, fontSize: 12 },
  itemRight: { marginLeft: 12 },
});

