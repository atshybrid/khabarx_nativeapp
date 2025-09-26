import { WEB_BASE_URL } from '@/config/appConfig';
import { useThemeColor } from '@/hooks/useThemeColor';
import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

export default function PrivacyScreen() {
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'muted');

  // Local UI state (could be wired to real preferences later)
  const [personalizedAds, setPersonalizedAds] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const [crashReports, setCrashReports] = useState(true);
  const [appLock, setAppLock] = useState(false);
  const [biometrics, setBiometrics] = useState(false);

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
          subtitle: 'Require PIN or biometrics to open the app',
          right: (
            <Switch value={appLock} onValueChange={setAppLock} />
          ),
        },
        {
          icon: 'unlock',
          title: 'Biometric Unlock',
          subtitle: 'Use Face ID/Touch ID to unlock',
          right: (
            <Switch value={biometrics} onValueChange={setBiometrics} disabled={!appLock} />
          ),
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
          onPress: () => Linking.openURL(`${WEB_BASE_URL}/privacypolicy`).catch(() => Alert.alert('Error', 'Unable to open link')),
        },
        {
          icon: 'file-text',
          title: 'Terms & Conditions',
          subtitle: 'Your rights and obligations',
          onPress: () => Linking.openURL(`${WEB_BASE_URL}/TermsandConditions`).catch(() => Alert.alert('Error', 'Unable to open link')),
        },
        {
          icon: 'key',
          title: 'Permissions',
          subtitle: 'See permissions used by the app',
          onPress: () => Alert.alert('Permissions', 'App permissions info coming soon'),
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
  ]), [personalizedAds, analytics, crashReports, appLock, biometrics]);

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

