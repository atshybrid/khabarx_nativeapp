import LottieLoader from '@/components/ui/LottieLoader';
import { Colors } from '@/constants/Colors';
import { loadTokens } from '@/services/auth';
import { DonationEvent, getCasesAdminAnalytics, getOrgSettings, listAdminDonationEvents } from '@/services/hrciAdmin';
import { getTopDonors, TopDonor } from '@/services/hrciDonations';
import { HrciMeeting, joinMeeting, listAdminMeetings } from '@/services/hrciMeet';
import { getHrciMetrics, getMemberDonations, HrciMetricsResponse, MemberDonationsResponse } from '@/services/hrciReports';
import { makeShadow } from '@/utils/shadow';
import { Feather } from '@expo/vector-icons';
// Clean, flat admin UI (no gradient header)
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// import { useHrciOnboarding } from '../../../context/HrciOnboardingContext';

export default function HrciAdminDashboard() {
  const ShimmerBar = ({ width = '60%', height = 12, style }: { width?: number | string; height?: number; style?: any }) => {
    const opacity = useRef(new Animated.Value(0.4)).current;
    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, [opacity]);
    return <Animated.View style={[styles.skelBar, { width, height }, { opacity }, style]} />;
  };
  const AdminSkeleton = () => (
    <View style={{ gap: 12 }}>
      {/* Metrics skeleton */}
      <View style={styles.card}>
        <ShimmerBar width="25%" height={14} />
        <View style={{ marginTop: 10 }}>
          <ShimmerBar width="40%" />
          <ShimmerBar width="65%" />
        </View>
        <View style={{ marginTop: 10, gap: 10 }}>
          <View style={styles.todayRow}>
            <View style={styles.todayLeft}>
              <View style={[styles.gridIconWrap, { backgroundColor: '#f1f5f9' }]} />
              <ShimmerBar width={100} />
            </View>
            <View style={styles.todayRight}>
              <ShimmerBar width={40} />
              <ShimmerBar width={60} style={{ marginLeft: 10 }} />
            </View>
          </View>
          <View style={styles.todayRow}>
            <View style={styles.todayLeft}>
              <View style={[styles.gridIconWrap, { backgroundColor: '#f1f5f9' }]} />
              <ShimmerBar width={100} />
            </View>
            <View style={styles.todayRight}>
              <ShimmerBar width={40} />
              <ShimmerBar width={60} style={{ marginLeft: 10 }} />
            </View>
          </View>
        </View>
      </View>

      {/* Overview skeleton (horizontal) */}
      <View style={styles.card}>
        <ShimmerBar width="25%" height={14} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 8 }}>
          {[1,2,3,4,5].map(k => (
            <View key={k} style={[styles.kpiItem, { minWidth: 120 }]}> 
              <ShimmerBar width="70%" />
              <ShimmerBar width="40%" />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Meetings skeleton */}
      <View style={styles.card}>
        <ShimmerBar width="30%" height={14} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {[1,2,3].map(i => (<View key={i} style={[styles.statusChip, styles.scheduledChip]}><ShimmerBar width={60} height={10} /></View>))}
        </View>
        <View style={{ marginTop: 12 }}>
          <ShimmerBar width="60%" />
          <ShimmerBar width="40%" />
          <ShimmerBar width={120} height={32} style={{ borderRadius: 8, marginTop: 10 }} />
        </View>
      </View>

      {/* Donation Events skeleton (horizontal) */}
      <View style={styles.card}>
        <ShimmerBar width="40%" height={14} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8 }}>
          {[1,2,3].map(i => (
            <View key={i} style={[styles.eventCard, { width: 260, marginRight: 10 }]}>
              <ShimmerBar width="100%" height={90} style={{ borderRadius: 8 }} />
              <ShimmerBar width="80%" />
              <ShimmerBar width="60%" />
              <ShimmerBar width="100%" height={8} style={{ marginTop: 8, borderRadius: 6 }} />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Admin Tools skeleton grid */}
      <View style={styles.card}>
        <ShimmerBar width="30%" height={14} />
        <View style={styles.grid}>
          {[1,2,3,4,5,6].map(i => (
            <View key={i} style={styles.quickTile}>
              <View style={styles.quickIconWrap} />
              <ShimmerBar width={70} />
            </View>
          ))}
        </View>
      </View>

      {/* Donor Wall skeleton */}
      <View style={styles.card}>
        <ShimmerBar width="30%" height={14} />
        <View style={styles.donorGrid}>
          {[1,2,3,4,5,6].map(i => (
            <View key={i} style={styles.donorCard}>
              <View style={styles.donorAvatar}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' }} />
              </View>
              <ShimmerBar width={60} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [events, setEvents] = useState<DonationEvent[]>([]);
  const [eventsCount, setEventsCount] = useState<number>(0);
  const [org, setOrg] = useState<any>(null);
  const [cases, setCases] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [topDonors, setTopDonors] = useState<TopDonor[]>([]);
  const [loadingTop, setLoadingTop] = useState<boolean>(false);
  const [meetingItems, setMeetingItems] = useState<HrciMeeting[]>([]);
  const [meetingLoading, setMeetingLoading] = useState<boolean>(true);
  const [meetingJoiningId, setMeetingJoiningId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<HrciMetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState<boolean>(true);
  const [metricGranularity, setMetricGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [mdOpen, setMdOpen] = useState<boolean>(false);
  const [mdUserId, setMdUserId] = useState<string>('');
  const [mdLoading, setMdLoading] = useState<boolean>(false);
  const [mdResult, setMdResult] = useState<MemberDonationsResponse | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const t = await loadTokens();
        const role = (t?.user?.role || '').toString().trim().toUpperCase();
        const isAdmin = role === 'HRCI_ADMIN' || role === 'SUPERADMIN';
        setAllowed(isAdmin);
        if (!isAdmin) {
          setLoading(false);
          return;
        }
        const [ev, cs, og, mt] = await Promise.all([
          listAdminDonationEvents({ limit: 5 }),
          getCasesAdminAnalytics(7).catch(()=>null),
          getOrgSettings().catch(()=>null),
          listAdminMeetings().catch(()=>({ data: [], count: 0 } as any)),
        ]);
        setEvents(ev.data || []);
        setEventsCount(ev.count || (ev.data?.length || 0));
        setCases(cs);
        setOrg(og);
  setMeetingItems(mt?.data || []);
  setMeetingLoading(false);
        // Load donors (separately so dashboard stays responsive)
        setLoadingTop(true);
        getTopDonors(12).then((d) => setTopDonors(d || [])).finally(() => setLoadingTop(false));
      } catch (e: any) {
        try { Alert.alert('Admin', e?.message || 'Failed to load admin dashboard'); } catch {}
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [ev, cs, og, donors, mt, mx] = await Promise.all([
        listAdminDonationEvents({ limit: 5 }),
        getCasesAdminAnalytics(7).catch(()=>null),
        getOrgSettings().catch(()=>null),
        getTopDonors(12).catch(()=>[]),
        listAdminMeetings().catch(()=>({ data: [], count: 0 } as any)),
        getHrciMetrics({ granularity: metricGranularity }).catch(()=>null),
      ]);
      setEvents(ev.data || []);
      setEventsCount(ev.count || (ev.data?.length || 0));
      setCases(cs);
      setOrg(og);
      setTopDonors(Array.isArray(donors) ? donors : []);
      setMeetingItems(mt?.data || []);
      setMeetingLoading(false);
  setMetrics(mx || null);
  setMetricsLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, [metricGranularity]);

  const GridAction = ({ icon, label, onPress, color }: { icon: any; label: string; onPress?: () => void; color?: { bg: string; border: string } }) => (
    <Pressable
      onPress={async () => { try { await Haptics.selectionAsync(); } catch {}; onPress?.(); }}
      style={({ pressed }) => [styles.gridItem, pressed && { opacity: 0.92 }]}
    >
      <View style={[styles.gridIconWrap, color ? { backgroundColor: color.bg, borderColor: color.border } : null]}>{icon}</View>
      <Text style={styles.gridLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );

  const kpis = useMemo(() => {
    const summary = cases || {};
    const total = summary.total ?? (summary?.countsByStatus ? Object.values(summary.countsByStatus).reduce((a:number,b:any)=>a+Number(b||0),0) : 0);
    const open = summary.open ?? (summary?.countsByStatus?.IN_PROGRESS || 0) + (summary?.countsByStatus?.NEW || 0) + (summary?.countsByStatus?.TRIAGED || 0);
    const pending = summary.pending ?? (summary?.countsByStatus?.PENDING || 0);
    const resolved = (summary?.countsByStatus?.RESOLVED || 0) + (summary?.countsByStatus?.CLOSED || 0);
    return [
      { key: 'total', label: 'Total', value: total, icon: 'chart-bar' },
      { key: 'open', label: 'Open', value: open, icon: 'progress-clock' },
      { key: 'pending', label: 'Pending', value: pending, icon: 'clock-outline' },
      { key: 'resolved', label: 'Resolved', value: resolved, icon: 'check-circle-outline' },
    ];
  }, [cases]);

  // Meetings summary (hooks must be before any early return)
  const liveCount = useMemo(() => meetingItems.filter(m => String(m.runtimeStatus || m.status || '').toUpperCase() === 'LIVE').length, [meetingItems]);
  const scheduledCount = useMemo(() => meetingItems.filter(m => String(m.runtimeStatus || m.status || '').toUpperCase() === 'SCHEDULED').length, [meetingItems]);
  const endedCount = useMemo(() => meetingItems.filter(m => String(m.runtimeStatus || m.status || '').toUpperCase() === 'ENDED').length, [meetingItems]);
  const nextMeeting: HrciMeeting | null = useMemo(() => {
    if (!meetingItems?.length) return null;
    const live = meetingItems.find(m => String(m.runtimeStatus || m.status || '').toUpperCase() === 'LIVE');
    if (live) return live;
    const future = meetingItems
      .filter(m => new Date(m.scheduledAt).getTime() >= Date.now())
      .sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    return future[0] || null;
  }, [meetingItems]);

  const handleStartMeeting = useCallback(async (meetingId: string) => {
    try {
      setMeetingJoiningId(meetingId);
      const res = await joinMeeting(meetingId);
      const url = res?.join?.url;
      if (!url) throw new Error('Join URL not available');
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      try { Alert.alert('Meeting', (e as any)?.message || 'Failed to start meeting'); } catch {}
    } finally {
      setMeetingJoiningId(null);
    }
  }, []);

  const handleCheckMemberDonations = useCallback(async () => {
    if (!mdUserId?.trim()) {
      try { Alert.alert('Member Donations', 'Enter a Member userId first'); } catch {}
      return;
    }
    setMdLoading(true);
    setMdResult(null);
    try {
      const res = await getMemberDonations({ userId: mdUserId.trim() });
      setMdResult(res || null);
    } catch (e) {
      try { Alert.alert('Member Donations', (e as any)?.message || 'Failed to fetch'); } catch {}
    } finally {
      setMdLoading(false);
    }
  }, [mdUserId]);

  // Fetch metrics when granularity changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMetricsLoading(true);
        const mx = await getHrciMetrics({ granularity: metricGranularity });
        if (!cancelled) setMetrics(mx || null);
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [metricGranularity]);

  if (allowed === false) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.appBar}><Text style={styles.appTitle}>HRCI Admin</Text></View>
        <View style={styles.center}>
          <Feather name="lock" size={32} color={Colors.light.primary} />
          <Text style={{ marginTop: 8, color: '#0f172a', fontWeight: '800' }}>Access restricted</Text>
          <Pressable onPress={() => router.replace('/news')} style={({ pressed }) => [styles.primaryBtn, { marginTop: 12 }, pressed && { opacity: 0.8 }]}>
            <Text style={styles.primaryBtnText}>Go to News</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Early skeleton during initial load
  if (allowed === null || loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.topBar}>
          <View style={styles.headerLeft}>
            <View style={styles.orgLogoPlaceholder}><Feather name="image" color="#64748b" size={18} /></View>
            <View>
              <Text style={styles.topTitle}>HRCI Admin</Text>
              <Text style={styles.topSub}>{org?.orgName || 'Organization'}</Text>
            </View>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <AdminSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {/* Simple top bar with org */}
      <View style={styles.topBar}>
        <View style={styles.headerLeft}>
          {org?.hrciLogoUrl ? (
            <Image source={{ uri: org.hrciLogoUrl }} style={styles.orgLogo} />
          ) : (
            <View style={styles.orgLogoPlaceholder}><Feather name="image" color="#64748b" size={18} /></View>
          )}
          <View>
            <Text style={styles.topTitle}>HRCI Admin</Text>
            <Text style={styles.topSub}>{org?.orgName || 'Organization'}</Text>
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}> 
        {/* Metrics (granularity filter) */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Metrics</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {(['daily','weekly','monthly'] as const).map(g => (
                <Pressable key={g} onPress={() => setMetricGranularity(g)} style={({ pressed }) => [styles.statusChip, metricGranularity === g ? styles.scheduledChip : null, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.statusChipTxt}>{g[0].toUpperCase() + g.slice(1)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {!!metrics?.range ? (
            <Text style={styles.rangeText}>{new Date(metrics.range.from).toLocaleDateString()} → {new Date(metrics.range.to).toLocaleDateString()}</Text>
          ) : null}
          {metricsLoading ? (
            <View>
              <ShimmerBar width="40%" />
              <ShimmerBar width="70%" />
              <ShimmerBar width="55%" />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {/* Members */}
              <View style={styles.todayRow}>
                <View style={styles.todayLeft}>
                  <View style={[styles.gridIconWrap, { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' }]}>
                    <Feather name="user-plus" size={16} color={Colors.light.primary} />
                  </View>
                  <Text style={styles.todayLabel}>Members</Text>
                </View>
                <View style={styles.todayRight}>
                  <Text style={styles.todayValue}>{metrics?.totals?.memberships?.joinsCount ?? 0}</Text>
                  <Text style={styles.todaySub}>Joined</Text>
                  <Text style={[styles.todayValue, { marginLeft: 10 }]}>{metrics?.totals?.membershipFees?.successAmount?.toLocaleString?.() ?? 0}</Text>
                  <Text style={styles.todaySub}>Fees</Text>
                </View>
              </View>
              {/* Donations */}
              <View style={styles.todayRow}>
                <View style={styles.todayLeft}>
                  <View style={[styles.gridIconWrap, { backgroundColor: '#f0fdfa', borderColor: '#99f6e4' }]}>
                    <Feather name="heart" size={16} color={Colors.light.primary} />
                  </View>
                  <Text style={styles.todayLabel}>Donations</Text>
                </View>
                <View style={styles.todayRight}>
                  <Text style={styles.todayValue}>{metrics?.totals?.donations?.totalCount ?? 0}</Text>
                  <Text style={styles.todaySub}>Count</Text>
                  <Text style={[styles.todayValue, { marginLeft: 10 }]}>{metrics?.totals?.donations?.totalAmount?.toLocaleString?.() ?? 0}</Text>
                  <Text style={styles.todaySub}>Amount</Text>
                </View>
              </View>
            </View>
          )}
        </View>
        {/* Overview KPIs (horizontal scroll) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {kpis.map((k) => (
              <View key={k.key} style={[styles.kpiItem, { minWidth: 120 }]}> 
                <Text style={styles.kpiValue}>{String(k.value ?? '—')}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Meetings summary card */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Meetings</Text>
            <Pressable onPress={() => router.push('/hrci/admin/meetings-list' as any)}><Text style={{ color: Colors.light.primary, fontWeight: '800' }}>View all</Text></Pressable>
          </View>
          {meetingLoading ? (
            <View>
              <ShimmerBar width="60%" />
              <ShimmerBar width="40%" />
            </View>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[styles.statusChip, styles.liveChip]}><Text style={styles.statusChipTxt}>Live {liveCount}</Text></View>
                <View style={[styles.statusChip, styles.scheduledChip]}><Text style={styles.statusChipTxt}>Scheduled {scheduledCount}</Text></View>
                <View style={[styles.statusChip, styles.endedChip]}><Text style={styles.statusChipTxt}>Ended {endedCount}</Text></View>
              </View>
              {nextMeeting ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: '#0f172a', fontWeight: '900' }} numberOfLines={1}>{nextMeeting.title || 'Meeting'}</Text>
                  <Text style={{ color: '#64748b', marginTop: 4 }}>{new Date(nextMeeting.scheduledAt).toLocaleString()}</Text>
                  {String(nextMeeting.runtimeStatus || nextMeeting.status || '').toUpperCase() === 'LIVE' ? (
                    <Pressable
                      disabled={meetingJoiningId === nextMeeting.id}
                      onPress={() => handleStartMeeting(nextMeeting.id)}
                      style={({ pressed }) => [styles.primaryBtn, { marginTop: 10 }, pressed && { opacity: 0.9 }]}
                    >
                      {meetingJoiningId === nextMeeting.id ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Start Meeting</Text>
                      )}
                    </Pressable>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <Pressable onPress={() => router.push('/hrci/admin/meeting-create' as any)} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}>
                        <Text style={styles.smallBtnText}>Create Meeting</Text>
                      </Pressable>
                      <Pressable onPress={() => router.push('/hrci/admin/meetings-list' as any)} style={({ pressed }) => [styles.smallBtnGhost, pressed && { opacity: 0.9 }]}>
                        <Text style={styles.smallBtnGhostText}>Open List</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ color: '#64748b' }}>No meetings yet.</Text>
                  <Pressable onPress={() => router.push('/hrci/admin/meeting-create' as any)} style={({ pressed }) => [styles.smallBtn, { marginTop: 10, alignSelf: 'flex-start' }, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.smallBtnText}>Create Meeting</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
        {/* Admin Menu (3 per row icon grid) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Admin Menu</Text>
          <View style={styles.grid}>
            {/* Priority row */}
            <GridAction color={{ bg: '#fff7ed', border: '#fdba74' }} icon={<Feather name="calendar" size={20} color={Colors.light.primary} />} label="Meetings" onPress={() => router.push('/hrci/admin/meetings-list' as any)} />
            <GridAction color={{ bg: '#f0f9ff', border: '#bae6fd' }} icon={<Feather name="users" size={20} color={Colors.light.primary} />} label="KYC Review" onPress={() => router.push('/hrci/admin/kyc' as any)} />
            <GridAction color={{ bg: '#f0fdfa', border: '#99f6e4' }} icon={<Feather name="user-check" size={20} color={Colors.light.primary} />} label="Members" onPress={() => router.push('/hrci/admin/members' as any)} />
            {/* Secondary row */}
            <GridAction color={{ bg: '#ecfdf5', border: '#a7f3d0' }} icon={<Feather name="plus-circle" size={18} color={Colors.light.primary} />} label="Create Event" onPress={() => router.push('/hrci/admin/events' as any)} />
            <GridAction color={{ bg: '#f5f3ff', border: '#ddd6fe' }} icon={<Feather name="link" size={18} color={Colors.light.primary} />} label="Payment Links" onPress={() => router.push('/hrci/admin/payments' as any)} />
            <GridAction color={{ bg: '#fffbeb', border: '#fde68a' }} icon={<Feather name="file-text" size={18} color={Colors.light.primary} />} label="Stories" onPress={() => router.push('/hrci/admin/stories' as any)} />
            {/* Tertiary row */}
            <GridAction color={{ bg: '#eef2ff', border: '#e0e7ff' }} icon={<Feather name="settings" size={18} color={Colors.light.primary} />} label="Org Settings" onPress={() => router.push('/hrci/admin/settings' as any)} />
            <GridAction color={{ bg: '#fff1f2', border: '#fecdd3' }} icon={<Feather name="percent" size={18} color={Colors.light.primary} />} label="Member Discount" onPress={() => router.push('/hrci/admin/discounts' as any)} />
            <GridAction color={{ bg: '#fdf4ff', border: '#f5d0fe' }} icon={<Feather name="film" size={18} color={Colors.light.primary} />} label="Ads" onPress={() => router.push('/hrci/admin/ads' as any)} />
            <GridAction color={{ bg: '#f7fee7', border: '#d9f99d' }} icon={<Feather name="award" size={18} color={Colors.light.primary} />} label="Donor Wall" onPress={() => router.push('/hrci/admin/donors' as any)} />
            <GridAction color={{ bg: '#eef2ff', border: '#e0e7ff' }} icon={<Feather name="map-pin" size={18} color={Colors.light.primary} />} label="Geo Mandals" onPress={() => router.push('/hrci/admin/geo/mandals' as any)} />
          </View>
        </View>

        {/* Events overview (horizontal scroll) */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Donation Events{eventsCount ? ` (${eventsCount})` : ''}</Text>
            <Pressable onPress={() => router.push('/hrci/admin/events' as any)}><Text style={{ color: Colors.light.primary, fontWeight: '800' }}>View all</Text></Pressable>
          </View>
          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}><LottieLoader size={72} /></View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}>
              {events.map((e) => {
                const status = String(e.status || '').toUpperCase();
                const chipStyle = status === 'ACTIVE' ? styles.activeChip : status === 'PAUSED' ? styles.pausedChip : status === 'ENDED' ? styles.endedChip : styles.draftChip;
                const goal = Number(e.goalAmount || 0);
                const collected = Number(e.collectedAmount || 0);
                const pct = goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : 0;
                return (
                  <View key={String(e.id)} style={[styles.eventCard, { width: 260, marginRight: 10 }]}> 
                    <View style={styles.eventThumb}>
                      {e.coverImageUrl ? (
                        <Image source={{ uri: e.coverImageUrl }} style={styles.eventThumbImg} />
                      ) : (
                        <Feather name="image" size={16} color="#94a3b8" />
                      )}
                      <View style={{ position: 'absolute', left: 8, top: 8 }}>
                        <View style={[styles.statusChip, chipStyle]}><Text style={styles.statusChipTxt}>{status}</Text></View>
                      </View>
                    </View>
                    <Text style={styles.eventTitle} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.eventMeta}>{e.currency || 'INR'} {goal ? goal.toLocaleString() : '—'} goal</Text>
                    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct}%` }]} /></View>
                    <View style={styles.eventMetaRow}>
                      <Text style={styles.eventMeta}>{e.currency || 'INR'} {collected ? collected.toLocaleString() : 0} raised</Text>
                      <Text style={styles.eventMeta}>{pct}%</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <Pressable onPress={() => Alert.alert('Coming soon', 'Manage event')} style={({ pressed }) => [styles.smallBtn, pressed && { opacity: 0.9 }]}>
                        <Text style={styles.smallBtnText}>Manage</Text>
                      </Pressable>
                      <Pressable onPress={() => Alert.alert('Coming soon', 'Share')} style={({ pressed }) => [styles.smallBtnGhost, pressed && { opacity: 0.9 }]}>
                        <Text style={styles.smallBtnGhostText}>Share</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {!events.length ? (
                <View style={[styles.emptyWrap, { alignItems: 'flex-start' }]}> 
                  <Text style={styles.emptyText}>No events yet.</Text>
                  <Pressable onPress={() => router.push('/hrci/admin/events' as any)} style={({ pressed }) => [styles.smallBtn, { marginTop: 8 }, pressed && { opacity: 0.9 }]}>
                    <Text style={styles.smallBtnText}>Create Event</Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>

        {/* Admin tools (tile grid) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Admin Tools</Text>
          <View style={styles.grid}>
            <GridAction color={{ bg: '#ecfeff', border: '#a5f3fc' }} icon={<Feather name="list" size={18} color={Colors.light.primary} />} label="Donations" onPress={() => router.push('/hrci/donations' as any)} />
            <GridAction color={{ bg: '#fff7ed', border: '#fdba74' }} icon={<Feather name="activity" size={18} color={Colors.light.primary} />} label="Audit Logs" onPress={() => Alert.alert('Coming soon', 'Audit logs')} />
            <GridAction color={{ bg: '#f0fdfa', border: '#99f6e4' }} icon={<Feather name="credit-card" size={18} color={Colors.light.primary} />} label="ID Card Settings" onPress={() => router.push('/hrci/admin/settings' as any)} />
            <GridAction color={{ bg: '#f5f3ff', border: '#ddd6fe' }} icon={<Feather name="shield" size={18} color={Colors.light.primary} />} label="Permissions" onPress={() => Alert.alert('Coming soon', 'Permissions')} />
            <GridAction color={{ bg: '#eef2ff', border: '#e0e7ff' }} icon={<Feather name="search" size={18} color={Colors.light.primary} />} label="Member Donations" onPress={() => setMdOpen(v => !v)} />
          </View>
          {mdOpen ? (
            <View style={{ marginTop: 10, gap: 10 }}>
              <Text style={styles.toolTxt}>Check member-wise donations (userId)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  placeholder="Enter Member userId"
                  placeholderTextColor="#94a3b8"
                  value={mdUserId}
                  onChangeText={setMdUserId}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={handleCheckMemberDonations} style={({ pressed }) => [styles.smallBtn, { alignSelf: 'flex-start' }, pressed && { opacity: 0.9 }]}>
                  {mdLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.smallBtnText}>Check</Text>}
                </Pressable>
              </View>
              {mdLoading ? null : mdResult ? (
                <View style={styles.mdResultBox}>
                  <View style={styles.mdRow}><Text style={styles.mdKey}>Generated</Text><Text style={styles.mdVal}>{mdResult?.totals?.generatedCount ?? 0}</Text></View>
                  <View style={styles.mdRow}><Text style={styles.mdKey}>Success</Text><Text style={styles.mdVal}>{mdResult?.totals?.successCount ?? 0}</Text></View>
                  <View style={styles.mdRow}><Text style={styles.mdKey}>Success Amount</Text><Text style={styles.mdVal}>{mdResult?.totals?.successAmount?.toLocaleString?.() ?? 0}</Text></View>
                  <View style={styles.mdRow}><Text style={styles.mdKey}>Pending</Text><Text style={styles.mdVal}>{mdResult?.totals?.pendingCount ?? 0}</Text></View>
                  <View style={styles.mdRow}><Text style={styles.mdKey}>Failed</Text><Text style={styles.mdVal}>{mdResult?.totals?.failedCount ?? 0}</Text></View>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Donor Wall (grid) */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Donor Wall</Text>
            <Pressable onPress={() => router.push('/hrci/admin/donors' as any)}><Text style={{ color: Colors.light.primary, fontWeight: '800' }}>Manage</Text></Pressable>
          </View>
          {loadingTop ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}><LottieLoader size={72} /></View>
          ) : (
            <View style={styles.donorGrid}>
              {topDonors.length ? topDonors.slice(0, 6).map((d, idx) => (
                <View key={d.key} style={styles.donorCard}>
                  <View style={[styles.donorAvatar, idx === 0 ? styles.medalGoldRing : idx === 1 ? styles.medalSilverRing : idx === 2 ? styles.medalBronzeRing : null]}>
                    {d.photoUrl ? (
                      <Image source={{ uri: d.photoUrl }} style={styles.donorAvatarImg} />
                    ) : (
                      <Feather name="user" size={18} color="#64748b" />
                    )}
                  </View>
                  <Text numberOfLines={1} style={styles.donorName}>{d.displayName || 'Donor'}</Text>
                  {idx < 3 ? (
                    <View style={[styles.donorMedal, idx === 0 ? styles.medalGold : idx === 1 ? styles.medalSilver : styles.medalBronze]}>
                      <Feather name="award" size={10} color="#0f172a" />
                    </View>
                  ) : null}
                </View>
              )) : (
                <View style={styles.emptyWrap}><Text style={styles.emptyText}>No donors yet.</Text></View>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  appBar: { height: 52, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  appTitle: { fontSize: 18, fontWeight: '800', color: Colors.light.primary },
  iconBtn: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: Colors.light.secondary, borderRadius: 8 },
  header: { paddingHorizontal: 12, paddingBottom: 16, paddingTop: 12 },
  topBar: { paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orgLogo: { width: 36, height: 36, borderRadius: 6 },
  orgLogoPlaceholder: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  roundBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' },
  topTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  topSub: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  searchBar: { marginTop: 10, height: 40, borderRadius: 10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchPlaceholder: { color: '#64748b', fontWeight: '700' },
  kpiRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  kpiCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.16)' },
  kpiIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  kpiVal: { color: '#0f172a', fontSize: 18, fontWeight: '900', marginTop: 8 },
  kpiLab: { color: '#0f172a', opacity: 0.85, fontSize: 12, fontWeight: '700' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  kpiItem: { width: '48%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  kpiValue: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  kpiLabel: { color: '#64748b', fontWeight: '700', marginTop: 2 },
  content: { padding: 12, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  elevated: { ...makeShadow(8, { opacity: 0.12, blur: 14, y: 6 }) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: '#0f172a', fontWeight: '900', fontSize: 14, marginBottom: 8 },
  primaryBtn: { backgroundColor: Colors.light.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: { backgroundColor: Colors.light.secondary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  secondaryBtnText: { color: '#fff', fontWeight: '800' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quick: { backgroundColor: '#f8fafc', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#eef2f7', flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickTxt: { color: '#0f172a', fontWeight: '800' },
  quickGridNew: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickTile: { width: '31.5%', backgroundColor: '#f8fafc', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: '#eef2f7', alignItems: 'center', justifyContent: 'center', ...makeShadow(4, { opacity: 0.08, blur: 10, y: 4 }) },
  quickIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickLabel: { color: '#0f172a', fontWeight: '800', textAlign: 'center' },
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  eventCard: { width: '48%', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 10 },
  eventThumb: { width: '100%', height: 90, borderRadius: 8, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  eventTitle: { color: '#0f172a', fontWeight: '900' },
  eventMeta: { color: '#64748b', marginTop: 2 },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  eventThumbImg: { width: '100%', height: '100%', borderRadius: 8 },
  progressTrack: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 6, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Colors.light.primary, borderRadius: 6 },
  smallBtn: { backgroundColor: Colors.light.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  smallBtnText: { color: '#fff', fontWeight: '800' },
  smallBtnGhost: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#fff' },
  smallBtnGhostText: { color: '#0f172a', fontWeight: '800' },
  input: { flex: 1, height: 40, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, color: '#0f172a', fontWeight: '700' },
  emptyWrap: { height: 110, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  emptyText: { color: '#64748b' },
  rangeText: { color: '#64748b', fontWeight: '700', marginBottom: 6 },
  todayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 10, padding: 10 },
  todayLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayRight: { flexDirection: 'row', alignItems: 'center' },
  todayLabel: { color: '#0f172a', fontWeight: '800' },
  todayValue: { color: '#0f172a', fontWeight: '900' },
  todaySub: { color: '#64748b', fontWeight: '700', marginLeft: 4 },
  kpi: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 12, minWidth: 88, alignItems: 'center' },
  kpiNum: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  kpiLbl: { color: '#64748b', fontWeight: '700' },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#eef2f7' },
  toolTxt: { color: '#0f172a', fontWeight: '800' },
  donorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  donorCard: { width: '31.5%', alignItems: 'center', position: 'relative' },
  donorAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  donorAvatarImg: { width: '100%', height: '100%' },
  donorName: { color: '#0f172a', fontSize: 12, fontWeight: '700', marginTop: 6, maxWidth: 72, textAlign: 'center' },
  donorMedal: { position: 'absolute', right: 8, top: 2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  medalGold: { backgroundColor: '#f59e0b33' },
  medalSilver: { backgroundColor: '#9ca3af33' },
  medalBronze: { backgroundColor: '#b4530933' },
  medalGoldRing: { borderColor: '#f59e0b', borderWidth: 2 },
  medalSilverRing: { borderColor: '#9ca3af', borderWidth: 2 },
  medalBronzeRing: { borderColor: '#b45309', borderWidth: 2 },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: '#fff' },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, color: '#0f172a', fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  gridItem: { width: '31.5%', alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  gridIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  gridLabel: { color: '#0f172a', fontWeight: '800', textAlign: 'center', marginTop: 8, fontSize: 12 },
  mdResultBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 10, padding: 10, marginTop: 2 },
  mdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  mdKey: { color: '#64748b', fontWeight: '800' },
  mdVal: { color: '#0f172a', fontWeight: '900' },
  statusChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  statusChipTxt: { fontWeight: '900', color: '#0f172a', fontSize: 12 },
  activeChip: { backgroundColor: '#16a34a22', borderColor: '#16a34a' },
  pausedChip: { backgroundColor: '#f59e0b22', borderColor: '#f59e0b' },
  draftChip: { backgroundColor: '#7c3aed22', borderColor: '#7c3aed' },
  liveChip: { backgroundColor: '#16a34a22', borderColor: '#16a34a' },
  scheduledChip: { backgroundColor: '#2563eb22', borderColor: '#2563eb' },
  endedChip: { backgroundColor: '#6b728022', borderColor: '#6b7280' },
  skelBar: { height: 12, borderRadius: 6, backgroundColor: '#e5e7eb', marginTop: 8 },
});
