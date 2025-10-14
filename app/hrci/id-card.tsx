import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HrciIdCardFrontExact } from '../../components/HrciIdCardFrontExact';
import { request } from '../../services/http';

type Profile = {
  id?: string;
  fullName?: string;
  profilePhotoUrl?: string;
  dob?: string;
  mobileNumber?: string;
  address?: any;
  createdAt?: string;
};

type Membership = {
  kyc?: { hasKyc?: boolean; status?: string; updatedAt?: string } | null;
  cell?: { id?: string; name?: string } | null;
  designation?: { id?: string; code?: string; name?: string } | null;
  hrci?: { zone?: string | null } | null;
};

export default function HrciIdCardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [idCardData, setIdCardData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');
  // Responsive width: scale down to fit mobile screens, never exceed design base (720) nor stretch too small
  const { width: screenWidth } = useWindowDimensions();
  const exactCardWidth = Math.max(Math.min(screenWidth - 32, 720), 320); // clamp for readability

  // Helper: derive Valid Upto (assumption: 3 year validity from KYC update or profile creation)
  const computeValidity = (): string => {
    const baseIso = membership?.kyc?.updatedAt || profile?.createdAt;
    if (!baseIso) return 'MARCH 2027'; // fallback legacy static
    try {
      const base = new Date(baseIso);
      if (isNaN(base.getTime())) return 'MARCH 2027';
      const valid = new Date(base);
      valid.setFullYear(valid.getFullYear() + 3); // +3 years (assumption) TODO: replace with server supplied validity
      const month = valid.toLocaleString('en-US', { month: 'long' }).toUpperCase();
      const year = valid.getFullYear();
      return `${month} ${year}`;
    } catch {
      return 'MARCH 2027';
    }
  };

  // Resolve local bundled assets (logo). We keep stamp & signature undefined until assets available.
  let logoUri: string | undefined;
  try {
    // Using resolveAssetSource so we can still pass a URI to component expecting remote style
    const resolved = Image.resolveAssetSource(require('../../assets/images/hrci_logo.png'));
    logoUri = resolved?.uri;
  } catch {}

  // Fetch composite ID card data AFTER membership/profile load
  useEffect(() => {
    const loadIdCard = async () => {
      try {
        const start = Date.now();
        const res = await request<any>(`/memberships/me/idcard`, { method: 'GET' });
        const dur = Date.now() - start;
        const data = res?.data || res;
        console.log(`[ID Card] ✅ /memberships/me/idcard (${dur}ms)`, {
          hasCard: data?.hasCard,
          status: data?.card?.status,
          num: data?.card?.cardNumber,
        });
        setIdCardData(data || null);
      } catch (e:any) {
        console.warn('[ID Card] ⚠️ ID card composite failed:', e?.message || e);
      }
    };
    loadIdCard();
  }, []);

  const holder = idCardData?.card?.holder || {};
  const setting = idCardData?.setting || {};
  const memberName = (holder.fullName || profile?.fullName || 'Member Name').toUpperCase();
  const designation = (holder.designationName || membership?.designation?.name || 'Designation').toUpperCase();
  const cellName = (holder.cellName || membership?.cell?.name || 'Cell Name').toUpperCase();
  const idNumber = (idCardData?.card?.cardNumber || (profile?.id ? `HRCI-${profile.id.slice(-8)}` : 'N/A')).toUpperCase();
  const contactNumber = holder.mobileNumber || profile?.mobileNumber || 'N/A';
  const validUpto = idCardData?.card?.expiresAt ? (() => { try { const d=new Date(idCardData.card.expiresAt); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;} catch { return computeValidity(); } })() : computeValidity();
  const cardLogoUri = setting.frontLogoUrl || logoUri;
  const stampUri = setting.hrciStampUrl || undefined;
  const authorSignUri = setting.authorSignUrl || undefined;
  const photoUri = profile?.profilePhotoUrl;

  useEffect(() => {
  const loadProfile = async () => {
      console.log('[ID Card] 🆔 ID Card view opened');
      console.log('[ID Card] 🔗 API Call: GET /profiles/me for ID card data');
      
      try {
        const startTime = Date.now();
  const res = await request<any>(`/profiles/me`, { method: 'GET' });
        const endTime = Date.now();
        
        console.log(`[ID Card] ✅ Profile data loaded (${endTime - startTime}ms)`);
        console.log('[ID Card] 📄 ID Card Data:', {
          hasFullName: !!(res?.data?.fullName || res?.fullName),
          hasPhoto: !!(res?.data?.profilePhotoUrl || res?.profilePhotoUrl),
          hasDOB: !!(res?.data?.dob || res?.dob),
          hasAddress: !!(res?.data?.address || res?.address),
          profileId: (res?.data?.id || res?.id)?.slice(-8) || 'N/A',
          timestamp: new Date().toISOString()
        });
        
        const profileData = res?.data || res;
        setProfile(profileData);

        // Load membership details for designation, cell and zone
        try {
          const mStart = Date.now();
          const mRes = await request<any>(`/memberships/me`, { method: 'GET' });
          const mDur = Date.now() - mStart;
          const mData = mRes?.data || mRes;
          console.log(`[ID Card] ✅ Membership data loaded (${mDur}ms)`, {
            kyc: mData?.kyc?.status,
            cell: mData?.cell?.name,
            designation: mData?.designation?.name,
            zone: mData?.hrci?.zone,
          });
          setMembership(mData || null);
        } catch (me: any) {
          console.warn('[ID Card] ⚠️ Failed to load membership data:', me?.message || me);
        }
        
        if (!profileData?.profilePhotoUrl) {
          console.log('[ID Card] ⚠️  Profile photo missing - blocking ID card access');
          Alert.alert(
            'Profile Photo Required',
            'You need to upload your profile photo to view your ID card.',
            [
              { text: 'Cancel', onPress: () => {
                console.log('[ID Card] 🔙 User cancelled, returning to dashboard');
                router.back();
              }},
              { text: 'Upload Photo', onPress: () => {
                console.log('[ID Card] 📸 Redirecting to photo upload');
                router.push('/hrci/profile-photo' as any);
              }}
            ]
          );
        } else {
          console.log('[ID Card] ✅ ID card ready to display');
        }
      } catch (e: any) {
        console.error('[ID Card] ❌ Profile Load Failed:', {
          error: e?.message || 'Unknown error',
          status: e?.status || 'N/A',
          timestamp: new Date().toISOString()
        });
        Alert.alert('Error', 'Failed to load your profile. Please try again.');
        router.back();
      } finally {
        setLoading(false);
        console.log('[ID Card] 🏁 Loading state completed');
      }
    };

    loadProfile();
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="loading" size={32} color="#ffffff" />
          <Text style={styles.loadingText}>Loading your ID card...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LinearGradient colors={['#1e3a8a', '#3b82f6']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ID Card</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'front' && styles.activeTab]}
            onPress={() => setActiveTab('front')}
          >
            <Text style={[styles.tabText, activeTab === 'front' && styles.activeTabText]}>Front</Text>
          </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'back' && styles.activeTab]}
              onPress={() => setActiveTab('back')}
            >
              <Text style={[styles.tabText, activeTab === 'back' && styles.activeTabText]}>Back</Text>
            </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.cardContainer}>
            {activeTab === 'front' ? (
              <HrciIdCardFrontExact
                width={exactCardWidth}
                memberName={memberName}
                designation={designation}
                cellName={cellName}
                idNumber={idNumber}
                contactNumber={contactNumber}
                validUpto={validUpto}
                logoUri={cardLogoUri}
                photoUri={photoUri}
                stampUri={stampUri}
                authorSignUri={authorSignUri}
                style={{
                  ...makeShadow(18, { opacity: 0.35, blur: 40, y: 16 }),
                  borderWidth: 0,
                }}
              />
            ) : (
              <IdCardBack
                width={exactCardWidth}
                profile={profile}
                membership={membership}
              />
            )}
          </View>

          {/* Download/Share Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => Alert.alert('Coming Soon', 'Download feature will be available soon!')}
            >
              <MaterialCommunityIcons name="download" size={20} color="#ffffff" />
              <Text style={styles.actionText}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => Alert.alert('Coming Soon', 'Share feature will be available soon!')}
            >
              <MaterialCommunityIcons name="share" size={20} color="#ffffff" />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 16, color: '#ffffff', fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: { backgroundColor: '#ffffff' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  activeTabText: { color: '#1e3a8a' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  cardContainer: { alignItems: 'center', marginBottom: 24 },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  backCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    padding: 24,
    overflow: 'hidden',
  },
  backHeading: { fontSize: 26, fontWeight: '900', color: '#1e3a8a', textAlign: 'center', marginBottom: 12 },
  backSection: { marginTop: 16 },
  backSectionTitle: { fontSize: 18, fontWeight: '800', color: '#162c58', marginBottom: 8 },
  backText: { fontSize: 14, lineHeight: 20, color: '#374151', fontWeight: '600' },
  backRow: { flexDirection: 'row', marginBottom: 6 },
  backRowLabel: { width: 120, fontSize: 14, fontWeight: '700', color: '#111827' },
  backRowValue: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  signatureBlock: { marginTop: 32, alignItems: 'flex-end' },
  signatureLine: { width: 180, height: 2, backgroundColor: '#111827', marginBottom: 6 },
  signatureCaption: { fontSize: 14, fontWeight: '800', color: '#111827' },
});

function IdCardBack({ width, profile, membership }: { width: number; profile: Profile | null; membership: Membership | null }) {
  // scale back card proportionally similar to front width (front base width = 720)
  const baseWidth = 720;
  const scale = width / baseWidth;
  const issuedDate = profile?.createdAt ? new Date(profile.createdAt) : null;
  const issuedStr = issuedDate ? issuedDate.toLocaleDateString('en-IN') : 'N/A';
  const zone = membership?.hrci?.zone || 'N/A';

  return (
    <View style={[styles.backCard, { width, transform: [{ scale }], transformOrigin: 'top left' as any }]}>      
      <Text style={styles.backHeading}>HRCI CARD INFORMATION</Text>
      <View style={styles.backSection}>
        <Text style={styles.backSectionTitle}>Member Contact</Text>
        <View style={styles.backRow}>
          <Text style={styles.backRowLabel}>Mobile</Text>
          <Text style={styles.backRowValue}>{profile?.mobileNumber || 'N/A'}</Text>
        </View>
        <View style={styles.backRow}>
          <Text style={styles.backRowLabel}>Zone</Text>
          <Text style={styles.backRowValue}>{zone}</Text>
        </View>
      </View>
      <View style={styles.backSection}>
        <Text style={styles.backSectionTitle}>Terms & Conditions</Text>
        <Text style={styles.backText}>
          • This card is non-transferable.{"\n"}
          • Valid only for official HRCI duties.{"\n"}
          • Report loss/theft immediately.{"\n"}
          • Misuse is subject to cancellation.
        </Text>
      </View>
      <View style={styles.backSection}>
        <Text style={styles.backSectionTitle}>Issue Info</Text>
        <View style={styles.backRow}>
          <Text style={styles.backRowLabel}>Issued</Text>
          <Text style={styles.backRowValue}>{issuedStr}</Text>
        </View>
        <View style={styles.backRow}>
          <Text style={styles.backRowLabel}>Reg. No</Text>
          <Text style={styles.backRowValue}>4396/2022</Text>
        </View>
      </View>
      <View style={styles.signatureBlock}>
        <View style={styles.signatureLine} />
        <Text style={styles.signatureCaption}>Authorized Signature</Text>
      </View>
    </View>
  );
}