import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHrciOnboarding } from '../../context/HrciOnboardingContext';
import { on } from '../../services/events';
import { canCreateHrciCase, getHrciCasesSummary, HrciCasesSummary } from '../../services/hrciCases';
import { request } from '../../services/http';

type Profile = {
  fullName?: string;
  profilePhotoUrl?: string;
  designation?: string;
  cell?: string;
  level?: string;
  // Add more fields as needed
};

type Membership = {
  id?: string;
  level?: string;
  status?: string;
  paymentStatus?: string;
  idCardStatus?: string;
  activatedAt?: string | null;
  expiresAt?: string | null;
  kyc?: { hasKyc?: boolean; status?: string; updatedAt?: string } | null;
  // Some environments may return just a string (legacy) instead of object shape – support both
  cell?: ({ id?: string; code?: string; name?: string } | string) | null;
  designation?: ({ id?: string; code?: string; name?: string; validityDays?: number; defaultCapacity?: number } | string) | null;
  hrci?: {
    zone?: string | null;
    country?: any;
    state?: any;
    district?: any;
    mandal?: any;
    [k: string]: any;
  } | null;
  lastPayment?: { amount?: number; status?: string; providerRef?: string | null; createdAt?: string } | null;
};

type CardInfo = {
  id?: string;
  cardNumber?: string;
  status?: string;
  issuedAt?: string;
  expiresAt?: string;
};

// Reusable humanize helper for CODE_WITH_UNDERSCORES -> Title Case (leaves other values intact)
const humanize = (val?: string | null) => {
  if (!val) return undefined;
  if (/^[A-Z0-9_]{3,}$/.test(val)) {
    return val
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return val;
};

type CaseStats = {
  total: number;
  completed: number;
  pending: number;
  rejected: number;
};

// Small helper to color the tiny status dot in smart mini-cards
function dotStyleForStatus(status: string) {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'NEW': return { backgroundColor: '#E5E7EB' };
    case 'TRIAGED': return { backgroundColor: '#DBEAFE' };
    case 'IN_PROGRESS': return { backgroundColor: '#FEF3C7' };
    case 'LEGAL_REVIEW': return { backgroundColor: '#EDE9FE' };
    case 'ACTION_TAKEN': return { backgroundColor: '#DBEAFE' };
    case 'RESOLVED': return { backgroundColor: '#DCFCE7' };
    case 'REJECTED': return { backgroundColor: '#FEE2E2' };
    case 'CLOSED': return { backgroundColor: '#E5E7EB' };
    case 'ESCALATED': return { backgroundColor: '#FFE4E6' };
    default: return { backgroundColor: '#E5E7EB' };
  }
}

export default function HrciDashboard() {
  const router = useRouter();
  const {
    designationId,
    designationCode,
    designationName,
    cellId,
    cellName,
    cellCode,
    geo,
    setDesignation,
    setCell,
  } = useHrciOnboarding();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [stats, setStats] = useState<CaseStats>({ total: 0, completed: 0, pending: 0, rejected: 0 });
  const [summary, setSummary] = useState<HrciCasesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usingFallbackMembership, setUsingFallbackMembership] = useState(false);
  const [cardInfo, setCardInfo] = useState<CardInfo | null>(null);


  const loadProfile = async () => {
    console.log('[Dashboard] 📊 Starting profile load...');
    console.log('[Dashboard] 🔗 API Call: GET /profiles/me');
    
    try {
      const startTime = Date.now();
      const res = await request<any>(`/profiles/me`, { method: 'GET' });
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`[Dashboard] ✅ Profile API Success (${duration}ms)`);
      console.log('[Dashboard] 📄 Profile Response:', {
        status: 'success',
        hasData: !!(res?.data || res),
        responseSize: JSON.stringify(res).length,
        timestamp: new Date().toISOString()
      });
      
      const profileData = res?.data || res;
      console.log('[Dashboard] 👤 Profile Data:', {
        hasName: !!profileData?.fullName,
        hasPhoto: !!profileData?.profilePhotoUrl,
        hasDesignation: !!profileData?.designation,
        hasCell: !!profileData?.cell,
        hasLevel: !!profileData?.level,
        profileId: profileData?.id?.slice(-8) || 'N/A'
      });
      
      setProfile(profileData);
      
      // Check if profile photo is missing and show popup
      if (!profileData?.profilePhotoUrl) {
        console.log('[Dashboard] ⚠️  Profile photo missing - showing upload prompt');
        setTimeout(() => {
          Alert.alert(
            'Complete Your Profile',
            'Please upload your profile photo to access all features.',
            [
              { text: 'Later', style: 'cancel', onPress: () => console.log('[Dashboard] 🔄 Photo upload postponed') },
              { text: 'Upload Photo', onPress: () => {
                console.log('[Dashboard] 📸 Navigating to profile photo upload');
                router.push('/hrci/profile-photo' as any);
              }}
            ]
          );
        }, 1000);
      } else {
        console.log('[Dashboard] ✅ Profile photo exists:', profileData.profilePhotoUrl?.slice(0, 50) + '...');
      }
    } catch (e: any) {
      console.error('[Dashboard] ❌ Profile Load Failed:', {
        error: e?.message || 'Unknown error',
        status: e?.status || 'N/A',
        timestamp: new Date().toISOString(),
        stack: e?.stack?.slice(0, 200) || 'No stack trace'
      });
    }
  };

  const loadStats = async () => {
    console.log('[Dashboard] 📈 Loading case statistics (summary)…');
    try {
      const start = Date.now();
      const sum = await getHrciCasesSummary();
      const ms = Date.now() - start;
      console.log(`[Dashboard] ✅ Summary loaded (${ms}ms)`, sum);
      setSummary(sum);
      // Derive basic 4 numbers for the legacy section (we will remove that grid below)
      const completed = (sum.breakdown?.RESOLVED || 0) + (sum.breakdown?.CLOSED || 0) + (sum.breakdown?.COMPLETED || 0) + (sum.breakdown?.DONE || 0);
      const rejected = (sum.breakdown?.REJECTED || 0) + (sum.breakdown?.REVOKED || 0) + (sum.breakdown?.DENIED || 0);
      // Treat everything else as pending/open bucket (best effort, not shown prominently anymore)
      const pending = (sum.pending ?? 0);
      setStats({ total: sum.total || 0, completed, pending, rejected });
    } catch (e: any) {
      console.error('[Dashboard] ❌ Summary Load Failed:', { error: e?.message || 'Unknown error' });
      // Keep zeros and allow UI to render
      setSummary(null);
    }
  };

  // Composite loader that fetches both profile + membership in a single round trip.
  // Returns true if successful (so we can skip separate calls), false otherwise.
  const loadComposite = async (): Promise<boolean> => {
    console.log('[Dashboard] 🔄 Attempting composite load: GET /memberships/me/profile');
    try {
      const start = Date.now();
      const res = await request<any>('/memberships/me/profile', { method: 'GET' });
      const dur = Date.now() - start;
      // API shape can be either { success: true, data: {...} } OR directly {...}
      const outer = res?.data || res;
      const payload = outer?.data && outer.success !== undefined ? outer.data : outer?.data ? outer.data : outer; // prefer outer.data when success flag present
      if (!payload || (!payload.user && !payload.membership)) {
        console.warn('[Dashboard] Composite response missing expected keys – treating as failure', Object.keys(outer || {}));
        return false;
      }
      console.log(`[Dashboard] ✅ Composite load success (${dur}ms)`, {
        hasUser: !!payload?.user,
        hasMembership: !!payload?.membership,
        hasCard: !!payload?.card,
        membershipId: payload?.membership?.id,
        designation: payload?.membership?.designation?.code,
        cell: payload?.membership?.cell?.code,
        level: payload?.membership?.level,
      });
      // Profile
      if (payload?.user?.profile) {
        const prof = {
          fullName: payload.user.profile.fullName,
          profilePhotoUrl: payload.user.profile.profilePhotoUrl,
          designation: undefined, // designation/cell now driven by membership object
          cell: undefined,
          level: payload?.membership?.level,
        } as Profile;
        setProfile(prof);
      }
      // Membership
      if (payload?.membership) {
        setMembership(payload.membership);
        setUsingFallbackMembership(false);
        // Populate onboarding context if empty
        if (!designationCode && payload.membership?.designation?.code && setDesignation) {
          console.log('[Dashboard] ↩️ Seeding onboarding context (designation)');
          setDesignation(
            payload.membership.designation.id || payload.membership.designation.code,
            payload.membership.designation.code,
            payload.membership.designation.name
          );
        }
        if (!cellId && payload.membership?.cell?.id && setCell) {
          console.log('[Dashboard] ↩️ Seeding onboarding context (cell)');
          setCell(
            payload.membership.cell.id,
            payload.membership.cell.name,
            payload.membership.cell.code
          );
        }
      }
      if (payload?.card) setCardInfo(payload.card);
      return true;
    } catch (e: any) {
      const status = e?.status || e?.response?.status;
      console.warn('[Dashboard] ❌ Composite load failed', e?.message || e, 'status=', status);
      return false;
    }
  };

  const loadMembership = async () => {
    console.log('[Dashboard] 🪪 Loading membership data...');
    try {
      const start = Date.now();
      const res = await request<any>(`/memberships/me`, { method: 'GET' });
      const dur = Date.now() - start;
      const raw = res?.data || res;
      const designationObj: any = raw?.designation;
      const cellObj: any = raw?.cell;
      const hrciObj: any = raw?.hrci;
      console.log(`[Dashboard] ✅ Membership loaded (${dur}ms)`);
      console.log('[Dashboard] 🧩 Membership raw snapshot:', {
        keys: raw && typeof raw === 'object' ? Object.keys(raw).slice(0, 20) : 'n/a',
        designationType: typeof designationObj,
        designationKeys: designationObj && typeof designationObj === 'object' ? Object.keys(designationObj) : 'n/a',
        designationVal: designationObj,
        cellType: typeof cellObj,
        cellKeys: cellObj && typeof cellObj === 'object' ? Object.keys(cellObj) : 'n/a',
        cellVal: cellObj,
        hrciKeys: hrciObj && typeof hrciObj === 'object' ? Object.keys(hrciObj) : 'n/a',
        hrciVal: hrciObj,
        kycStatus: raw?.kyc?.status,
      });
      setMembership(raw || null);
      setUsingFallbackMembership(false);
    } catch (e: any) {
      const status = e?.status || e?.response?.status;
      console.warn('[Dashboard] ⚠️ Membership load failed:', e?.message || e, 'status=', status);
      // If 404, attempt to build a fallback membership object from onboarding context values
      if (String(status) === '404') {
        const fallback: Membership = {
          designation: designationCode ? { id: designationId, code: designationCode, name: designationName } : undefined,
          cell: cellId ? { id: cellId, name: cellName || cellCode } : undefined,
          hrci: {
            zone: geo?.zone || null,
            mandal: geo?.hrcMandalName || null,
            district: geo?.hrcDistrictName || null,
            state: geo?.hrcStateName || null,
            country: geo?.hrcCountryName || null,
          },
        };
        // Only set if we have at least one meaningful piece of info
        if (fallback.designation || fallback.cell || (fallback.hrci && Object.values(fallback.hrci).some(v => v))) {
          console.log('[Dashboard] 🛟 Using fallback membership from onboarding context', fallback);
          setMembership(fallback);
          setUsingFallbackMembership(true);
        } else {
          console.log('[Dashboard] 🛟 Fallback membership not available (no onboarding data)');
        }
      }
    }
  };

  const loadData = async () => {
    console.log('[Dashboard] 🚀 Dashboard initialization started');
    const startTime = Date.now();
    // First try composite endpoint for efficiency
    const compositeOk = await loadComposite();
    if (!compositeOk) {
      // Fall back to parallel individual loads (profile + membership) if composite not available
      await Promise.all([loadProfile(), loadMembership()]);
    }
    // Always load summary stats
    await loadStats();
    const endTime = Date.now();
    console.log(`[Dashboard] ✅ Dashboard loaded successfully (${endTime - startTime}ms) (composite=${compositeOk})`);
    setLoading(false);
  };

  const onRefresh = async () => {
    console.log('[Dashboard] 🔄 Manual refresh triggered');
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    console.log('[Dashboard] ✅ Refresh completed');
  };

  useEffect(() => {
    loadData();
    // Listen for profile updates (photo etc.) to refresh relevant data
    const off = on('profile:updated', () => {
      console.log('[Dashboard] Received profile:updated event – refreshing profile & membership');
      loadProfile();
      loadMembership();
    });
    return () => off();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {/* Header Skeleton */}
          <LinearGradient colors={["#FE0002", "#1D0DA1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerTop}>
                <SkeletonBox style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                <Text style={styles.headerTitle}>HRCI Dashboard</Text>
                <SkeletonBox style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.4)' }} />
              </View>
              <View style={styles.profileCard}>
                <View style={styles.profileTopRow}>
                  <SkeletonBox style={{ width: 80, height: 80, borderRadius: 40 }} />
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <SkeletonBox style={{ height: 18, borderRadius: 6, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.7)' }} />
                    <SkeletonBox style={{ height: 14, borderRadius: 6, width: '70%', backgroundColor: 'rgba(255,255,255,0.6)' }} />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', marginTop: 16, gap: 12 }}>
                  <SkeletonBox style={{ flex: 1, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                  <SkeletonBox style={{ flex: 1, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Stats Skeleton */}
          <View style={{ paddingHorizontal: 16, marginTop: -24 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SkeletonBox style={{ flex: 1, height: 90, borderRadius: 12 }} />
              <SkeletonBox style={{ flex: 1, height: 90, borderRadius: 12 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <SkeletonBox style={{ flex: 1, height: 90, borderRadius: 12 }} />
              <SkeletonBox style={{ flex: 1, height: 90, borderRadius: 12 }} />
            </View>
          </View>

          {/* Quick Actions Skeleton */}
          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <SkeletonBox style={{ height: 22, width: 160, borderRadius: 6, marginBottom: 12 }} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SkeletonBox style={{ flex: 1, height: 60, borderRadius: 12 }} />
              <SkeletonBox style={{ flex: 1, height: 60, borderRadius: 12 }} />
              <SkeletonBox style={{ flex: 1, height: 60, borderRadius: 12 }} />
            </View>
          </View>

          {/* Recent Activity Skeleton */}
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <SkeletonBox style={{ height: 22, width: 180, borderRadius: 6, marginBottom: 12 }} />
            {[...Array(5)].map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <SkeletonBox style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <SkeletonBox style={{ height: 14, borderRadius: 6, marginBottom: 6 }} />
                  <SkeletonBox style={{ height: 12, borderRadius: 6, width: '70%' }} />
                </View>
                <SkeletonBox style={{ width: 60, height: 28, borderRadius: 8, marginLeft: 12 }} />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={['#FE0002', '#1D0DA1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <TouchableOpacity 
                onPress={() => router.back()}
                style={styles.backBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="arrow-left" size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>HRCI Dashboard</Text>
              <TouchableOpacity 
                onPress={() => Alert.alert('Settings', 'Settings panel coming soon!')}
                style={styles.settingsBtn}
              >
                <MaterialCommunityIcons name="cog" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            {/* User Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.profileTopRow}>
                <TouchableOpacity style={styles.avatarContainer} onPress={() => router.push('/hrci/profile-photo' as any)} activeOpacity={0.7}>
                {profile?.profilePhotoUrl ? (
                  <View>
                    <Image source={{ uri: profile.profilePhotoUrl }} style={styles.avatar} />
                    {membership?.kyc?.status === 'APPROVED' && (
                      <View style={styles.kycBadge}>
                        <MaterialCommunityIcons name="check" size={14} color="#ffffff" />
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <MaterialCommunityIcons name="account" size={32} color="#6b7280" />
                  </View>
                )}
                </TouchableOpacity>
                <View style={styles.profileInfo}>
                {(() => {
                  // Name
                  const fullName = profile?.fullName || 'User Name';
                  // Designation: prefer name, show code only if name missing
                  let designationName: string | undefined;
                  let designationCode: string | undefined;
                  if (membership?.designation) {
                    if (typeof membership.designation === 'string') {
                      designationName = humanize(membership.designation) || undefined;
                    } else {
                      designationName = humanize(membership.designation.name) || undefined;
                      designationCode = humanize(membership.designation.code) || undefined;
                    }
                  }
                  if (!designationName) designationName = humanize(profile?.designation) || 'Designation';
                  if (designationName && designationCode && designationName.toLowerCase() === designationCode.toLowerCase()) {
                    // Avoid duplicate if humanized code equals name
                    designationCode = undefined;
                  }
                  // Cell: prefer name; code only used indirectly if name missing
                  let cellName: string | undefined;
                  if (membership?.cell) {
                    if (typeof membership.cell === 'string') {
                      cellName = humanize(membership.cell) || undefined;
                    } else {
                      cellName = humanize(membership.cell.name) || undefined;
                      if (!cellName && membership.cell.code) cellName = humanize(membership.cell.code) || undefined;
                    }
                  }
                  if (!cellName) cellName = humanize(profile?.cell) || undefined;
                  // Location: choose based on membership.level deepest node
                  const hrci: any = membership?.hrci || {};
                  const level = (membership as any)?.level as string | undefined;
                  const orderedKeys = ['mandal','district','state','zone','country'];
                  let locationLabel: string | null = null;
                  // Priority: if level known, start from that level's key then fallback through hierarchy
                  const levelKeyMap: Record<string,string> = { MANDAL: 'mandal', DISTRICT: 'district', STATE: 'state', ZONE: 'zone', NATIONAL: 'country' };
                  const primaryKey = level ? levelKeyMap[level] : undefined;
                  const searchOrder = primaryKey ? [primaryKey, ...orderedKeys.filter(k => k !== primaryKey)] : orderedKeys;
                  for (const key of searchOrder) {
                    const v = hrci?.[key];
                    if (v && typeof v === 'object' && v.name) { locationLabel = v.name; break; }
                    if (v && typeof v === 'string') { locationLabel = humanize(v) || v; break; }
                  }
                  if (!locationLabel) locationLabel = '';
                  let levelPrefix: string | null = null;
                  if (level) {
                    const prettyLevel = humanize(level);
                    if (prettyLevel && locationLabel) levelPrefix = `${prettyLevel}: ${locationLabel}`;
                    else if (prettyLevel) levelPrefix = prettyLevel;
                  }
                  return (
                    <>
                      <Text style={styles.profileName}>{fullName}</Text>
                      <Text style={styles.profileDesignation}>{designationName}</Text>
                      {designationCode ? <Text style={styles.profileCode}>{designationCode}</Text> : null}
                      {cellName ? <Text style={styles.profileLocation}>{cellName}</Text> : null}
                      {locationLabel ? <Text style={styles.profileLocation}>{levelPrefix || locationLabel}</Text> : null}
                      {usingFallbackMembership ? (
                        <Text style={styles.profileFallbackNote}>Temporary membership (offline / cached)</Text>
                      ) : null}
                      {cardInfo?.cardNumber ? (
                        <Text style={styles.profileCardNumber}>{cardInfo.cardNumber}</Text>
                      ) : null}
                    </>
                  );
                })()}
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push('/hrci/id-card' as any)} style={styles.idCardFullBtn}>
                <MaterialCommunityIcons name="card-account-details" size={22} color="#ffffff" />
                <Text style={styles.idCardFullText}>View ID Card</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* Smart Stats Mini-Cards */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Case Statistics</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
            <View style={styles.statMiniCard}>
              <Text style={styles.statMiniLabel}>Total</Text>
              <Text style={styles.statMiniValue}>{summary?.total ?? stats.total}</Text>
            </View>
            {(['NEW','TRIAGED','IN_PROGRESS','LEGAL_REVIEW','ACTION_TAKEN','RESOLVED','REJECTED','ESCALATED','CLOSED'] as const).map((k) => (
              <View key={k} style={styles.statMiniCard}>
                <View style={[styles.statDot, dotStyleForStatus(k)]} />
                <Text style={styles.statMiniLabel}>{k.replace('_',' ')}</Text>
                <Text style={styles.statMiniValue}>{summary?.breakdown?.[k] ?? 0}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <ActionCard
              title="New Case"
              subtitle="File a new case"
              icon="plus-circle"
              onPress={async () => {
                try {
                  const res = await canCreateHrciCase();
                  if (!res.allowed) {
                    Alert.alert('Not allowed', res.reason || 'Only Member or HRCI Admin can create cases');
                    return;
                  }
                  // Directly open Create Case page
                  router.push('/hrci/cases/new' as any);
                } catch (e:any) {
                  Alert.alert('Error', e?.message || 'Unable to open create case');
                }
              }}
            />
            {/* Show Legal Advise card only for LEGAL_SECRETARY designation (member scope) */}
            {(() => {
              const desigCode = typeof membership?.designation === 'string' ? String(membership?.designation) : String((membership as any)?.designation?.code || '');
              const show = desigCode.toUpperCase() === 'LEGAL_SECRETARY';
              if (!show) return null;
              return (
                <ActionCard
                  title="Legal Advise"
                  subtitle="Review and advise"
                  icon="scale-balance"
                  onPress={() => router.push('/hrci/legal' as any)}
                />
              );
            })()}
            <ActionCard
              title="My Cases"
              subtitle="View all cases"
              icon="folder-open"
              onPress={() => router.push('/hrci/cases' as any)}
            />
            <ActionCard
              title="Meetings"
              subtitle="Join upcoming"
              icon="video-outline"
              onPress={() => router.push('/hrci/meet' as any)}
            />
            <ActionCard
              title="Donations"
              subtitle="Manage & create"
              icon="cash-multiple"
              onPress={() => router.push('/hrci/donations' as any)}
            />
            <ActionCard
              title="Reports"
              subtitle="Generate reports"
              icon="chart-bar"
              onPress={() => Alert.alert('Coming Soon', 'Reports feature will be available soon!')}
            />
            <ActionCard
              title="Support"
              subtitle="Get help"
              icon="help-circle"
              onPress={() => Alert.alert('Support', 'Contact: support@hrcitodaynews.in')}
            />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// Reusable pulsing skeleton block
function SkeletonBox({ style }: { style?: any }) {
  const opacity = useRef(new Animated.Value(0.6));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity.current, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity.current, { toValue: 0.6, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[{ backgroundColor: '#e5e7eb' }, style, { opacity: opacity.current }]} />
  );
}

function ActionCard({ title, subtitle, icon, onPress }: {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <MaterialCommunityIcons name={icon as any} size={28} color="#FE0002" />
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 16, color: '#6b7280', fontWeight: '600' },
  scrollContent: { paddingBottom: 32 },
  header: { paddingTop: 16, paddingBottom: 32 },
  headerContent: { paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff', flex: 1, textAlign: 'center' },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  settingsBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  profileCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 16, 
    padding: 16, 
    flexDirection: 'column',
    alignItems: 'stretch',
    ...makeShadow(4, { opacity: 0.1, y: 2, blur: 20 })
  },
  profileTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatarContainer: { marginRight: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  kycBadge: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1D0DA1', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 },
  profileDesignation: { fontSize: 14, fontWeight: '600', color: '#FE0002', marginBottom: 2 },
  profileCode: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 2 },
  profileLocation: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  profileFallbackNote: { fontSize: 10, color: '#9ca3af', fontStyle: 'italic', marginTop: 2 },
  profileCardNumber: { fontSize: 11, fontWeight: '600', color: '#111827', marginTop: 2 },
  profileMeta: { flexDirection: 'row', alignItems: 'center' },
  profileMetaText: { fontSize: 12, color: '#6b7280' },
  idCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4
  },
  idCardText: { fontSize: 12, fontWeight: '700', color: '#FE0002' },
  idCardFullBtn: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FE0002', paddingVertical: 12, borderRadius: 12, gap: 8 },
  idCardFullText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  statsContainer: { padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 16 },
  // Smart mini-cards styling
  statsScroll: { paddingHorizontal: 16, gap: 8 },
  statMiniCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', minWidth: 84 },
  statMiniLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statMiniValue: { color: '#111', fontSize: 16, fontWeight: '800', marginTop: 2 },
  statDot: { width: 8, height: 8, borderRadius: 999, marginBottom: 6 },
  actionsContainer: { paddingHorizontal: 16 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    ...makeShadow(2, { opacity: 0.05, y: 1, blur: 12 })
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 8, textAlign: 'center' },
  actionSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2, textAlign: 'center' }
});
