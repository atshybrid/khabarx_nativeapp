// import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import { HrciIdCardExport, HrciIdCardExportHandle } from '../../components/HrciIdCardExport';
import { HrciIdCardFrontExact } from '../../components/HrciIdCardFrontExact';
import { request } from '../../services/http';


type Profile = {
  id?: string;
  fullName?: string;
  profilePhotoUrl?: string;
  dob?: string;
  mobileNumber?: string;
// AutoFitOneLine not used on back card redesign
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
  const exportRef = useRef<HrciIdCardExportHandle>(null);
  const frontShotRef = useRef<ViewShot>(null);
  const backShotRef = useRef<ViewShot>(null);
  const bothShotRef = useRef<ViewShot>(null);

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
  const secondLogoUrl = setting?.secondLogoUrl || setting?.frontLogoUrl || logoUri;
  const headOfficeAddress = setting?.headOfficeAddress || 'Vijayawada';
  const htmlPath: string | undefined = idCardData?.card?.html;
  // Use provided base URL from user context
  const APP_BASE_URL = 'https://app.hrcitodaynews.in/';
  const baseUrl = APP_BASE_URL.replace(/\/+$/,'');
  const idSlug = (idCardData?.card?.cardNumber || idNumber || '').toString().trim().toLowerCase();
  const joinUrl = (base: string, path: string) => `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const qrValue = htmlPath ? joinUrl(baseUrl, htmlPath) : (idSlug ? joinUrl(baseUrl, `/hrci/idcard/${idSlug}/html`) : baseUrl);

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
      <LinearGradient colors={['#1e3a8a', '#3b82f6']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ width: 24, height: 24 }} />
            <Text style={styles.headerTitle}>ID Card</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Skeleton content mimicking the card and bottom actions */}
          <View style={styles.frontContent}>
            <View style={styles.cardContainer}>
              <IdCardSkeleton width={exactCardWidth} />
            </View>

            <View style={styles.actionsContainerFixed}>
              <SkeletonBox style={{ width: 160, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.3)' }} />
              <SkeletonBox style={{ width: 140, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.3)' }} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
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

        {activeTab === 'front' ? (
          // Non-scroll front: fixed action bar at bottom
          <View style={styles.frontContent}>
            <View style={styles.cardContainer}>
              <HrciIdCardExport
                ref={exportRef}
                previewWidth={exactCardWidth}
                // Target physical size: 85mm x 55mm (portrait). Short edge = 55mm.
                widthInInches={55 / 25.4}
                dpi={600}
                // Custom aspect for 85mm x 55mm
                targetAspect={85 / 55}
                fitMode="cover"
                showExportInfo
                exportFormat="jpg"
                jpegQuality={1}
                disableTapToDownload
                showActions={false}
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
              />
            </View>

            {/* Hidden high-DPI render for Front capture (standalone) */}
            <FrontHiddenCapture
              shotRef={frontShotRef}
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
            />

            {/* Hidden high-DPI render for Back capture to allow two-image share from Front tab */}
            <BackHiddenCapture
              shotRef={backShotRef}
              secondLogoUrl={secondLogoUrl}
              headOfficeAddress={headOfficeAddress}
              qrValue={qrValue}
            />

            {/* Hidden high-DPI render for combined share (Front+Back) */}
            <BothHiddenCapture
              shotRef={bothShotRef}
              // Front props
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
              // Back props
              secondLogoUrl={secondLogoUrl}
              headOfficeAddress={headOfficeAddress}
              qrValue={qrValue}
            />

            {/* Download/Share Actions (fixed at bottom) */}
            <View style={styles.actionsContainerFixed}>
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => {
                  if (exportRef.current?.saveToPhotos) {
                    exportRef.current.saveToPhotos();
                  } else if (exportRef.current?.download) {
                    exportRef.current.download();
                  }
                }}
              >
                <MaterialCommunityIcons name="download" size={20} color="#ffffff" />
                <Text style={styles.actionText}>Save to Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => onShareTwoImages(frontShotRef, backShotRef, bothShotRef)}
              >
                <MaterialCommunityIcons name="share" size={20} color="#ffffff" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Back mirrors front: non-scroll with fixed bottom actions
          <View style={styles.frontContent}>
            <View style={styles.cardContainer}>
              <IdCardBack
                width={exactCardWidth}
                secondLogoUrl={secondLogoUrl}
                headOfficeAddress={headOfficeAddress}
                qrValue={qrValue}
              />
            </View>

            {/* Hidden high-DPI render for Back capture */}
            <BackHiddenCapture
              shotRef={backShotRef}
              secondLogoUrl={secondLogoUrl}
              headOfficeAddress={headOfficeAddress}
              qrValue={qrValue}
            />

            {/* Hidden high-DPI render for Front capture to allow two-image share from Back tab */}
            <FrontHiddenCapture
              shotRef={frontShotRef}
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
            />

            {/* Hidden high-DPI render for combined share (Front+Back) */}
            <BothHiddenCapture
              shotRef={bothShotRef}
              // Front props
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
              // Back props
              secondLogoUrl={secondLogoUrl}
              headOfficeAddress={headOfficeAddress}
              qrValue={qrValue}
            />

            {/* Download/Share Actions (fixed at bottom) */}
            <View style={styles.actionsContainerFixed}>
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => onBackSaveToPhotos(backShotRef)}
              >
                <MaterialCommunityIcons name="download" size={20} color="#ffffff" />
                <Text style={styles.actionText}>Save to Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => onShareTwoImages(frontShotRef, backShotRef, bothShotRef)}
              >
                <MaterialCommunityIcons name="share" size={20} color="#ffffff" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  frontContent: { flex: 1, justifyContent: 'flex-start', paddingHorizontal: 16, paddingBottom: 80 },
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
  actionsContainerFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
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
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  backContentPad: { padding: 24, paddingBottom: 64 },
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

// Simple pulsing skeleton block
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
    <Animated.View
      style={[
        { backgroundColor: '#e5e7eb' },
        style,
        { opacity: opacity.current },
      ]}
    />
  );
}

// Card-shaped skeleton mimicking ID card layout
function IdCardSkeleton({ width }: { width: number }) {
  const baseWidth = 720;
  const BASE_ASPECT = 1.42;
  const baseHeight = Math.round(baseWidth * BASE_ASPECT);
  const scale = width / baseWidth;
  const outHeight = Math.round(width * BASE_ASPECT);

  const bandH = 58;
  const blueH = 50;

  return (
    <View style={{ width, height: outHeight, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.backCard, { width: baseWidth, height: baseHeight, transform: [{ scale }], backgroundColor: '#ffffff' }]}>      
        {/* Top bands */}
        <View style={{ height: bandH + blueH }}>
          <SkeletonBox style={{ position: 'absolute', top: 0, left: 0, right: 0, height: bandH }} />
          <SkeletonBox style={{ position: 'absolute', top: bandH, left: 0, right: 0, height: blueH }} />
        </View>

        {/* Content pad */}
        <View style={{ padding: 24, paddingBottom: 64 }}>
          {/* Center logo/photo placeholder */}
          <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
            <SkeletonBox style={{ width: 200, height: 200, borderRadius: 12 }} />
          </View>

          {/* Headline lines */}
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <SkeletonBox style={{ height: 20, borderRadius: 4, marginBottom: 8 }} />
            <SkeletonBox style={{ height: 20, borderRadius: 4, width: '85%' }} />
          </View>

          {/* QR placeholder */}
          <View style={{ alignItems: 'center', marginVertical: 24 }}>
            <SkeletonBox style={{ width: 200, height: 200, borderRadius: 12 }} />
          </View>

          {/* Address/contact lines */}
          <View style={{ alignItems: 'center', marginTop: 4, paddingHorizontal: 16 }}>
            <SkeletonBox style={{ height: 18, borderRadius: 4, width: '60%', marginBottom: 8 }} />
            <SkeletonBox style={{ height: 16, borderRadius: 4, width: '90%', marginBottom: 6 }} />
            <SkeletonBox style={{ height: 16, borderRadius: 4, width: '80%', marginBottom: 6 }} />
            <SkeletonBox style={{ height: 16, borderRadius: 4, width: '70%', marginBottom: 6 }} />
          </View>

          {/* T&C lines */}
          <View style={{ marginTop: 16 }}>
            <SkeletonBox style={{ height: 18, borderRadius: 4, width: '45%', marginBottom: 8 }} />
            <SkeletonBox style={{ height: 12, borderRadius: 4, width: '100%', marginBottom: 6 }} />
            <SkeletonBox style={{ height: 12, borderRadius: 4, width: '95%', marginBottom: 6 }} />
            <SkeletonBox style={{ height: 12, borderRadius: 4, width: '90%', marginBottom: 6 }} />
            <SkeletonBox style={{ height: 12, borderRadius: 4, width: '85%', marginBottom: 6 }} />
          </View>

          {/* Bottom strip */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            <SkeletonBox style={{ height: 40 }} />
          </View>
        </View>
      </View>
    </View>
  );
}

function QRCodeMaybe({ value, size }: { value: string; size: number }) {
  const enc = encodeURIComponent(value);
  const uri = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${enc}`;
  return <Image source={{ uri }} style={{ width: size, height: size }} />;
}

function IdCardBack({ width, secondLogoUrl, headOfficeAddress, qrValue }: { width: number; secondLogoUrl: string | undefined; headOfficeAddress: string; qrValue: string; }) {
  const baseWidth = 720;
  const BASE_ASPECT = 1.42; // match front
  const baseHeight = Math.round(baseWidth * BASE_ASPECT);
  const scale = width / baseWidth;
  const outHeight = Math.round(width * BASE_ASPECT);

  const bandH = 58;
  const blueH = 50;
  const title = 'Human Rights Council for India (HRCI)';
  const logoSize = 200; // slightly smaller
  const qrSize = 200;   // slightly smaller

  return (
    <View style={{ width, height: outHeight, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.backCard, { width: baseWidth, height: baseHeight, transform: [{ scale }] }]}>      
        {/* Full-bleed top red + blue bands with title (vertically centered) */}
        <View style={{ backgroundColor: '#FE0002', height: bandH + blueH }}>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: bandH, backgroundColor: '#FE0002' }} />
          <View style={{ position: 'absolute', top: bandH, left: 0, right: 0, height: blueH, backgroundColor: '#17007A' }} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Text
              style={{ color: '#ffffff', fontSize: 36, fontWeight: '900', textAlign: 'center' }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {title}
            </Text>
          </View>
        </View>

        <View style={styles.backContentPad}>
        {/* Center logo */}
        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
        {secondLogoUrl ? (
          <Image source={{ uri: secondLogoUrl }} style={{ width: logoSize, height: logoSize, resizeMode: 'cover', backgroundColor: '#e5e7eb' }} />
        ) : (
          <View style={{ width: logoSize, height: logoSize, backgroundColor: '#d4d4d8', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#111827', fontWeight: '700' }}>HRCI Logo</Text>
          </View>
        )}
      </View>

      {/* Registration block */}
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', lineHeight: 20 }}>
          {"REGISTERED BY \" MINISTRY OF CORPORATE AFFAIRS, INDIA\"\n" +
           "REGD NO: CSR0036936 OF \"HRCI\", CSR 00038592 OF \"HRCI\"\n" +
           "REGD NO: BK-IV-46/2022 \"HRCI\" ISO CERTIFICATE NO: INO/AP12129/0922\n" +
           "REGD UNDER \"UDYAM\" NO: AP-21-0001051, AP-21-0001502 \"HRCI\"\n" +
           "REGD BY: MINISTRY OF SOCIAL JUSTICE AND EMPOWERMENT\n" +
           "GOVT OF INDIA REGD BY AP/00036080"}
        </Text>
      </View>

      {/* QR Code */}
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <QRCodeMaybe value={qrValue} size={qrSize} />
      </View>

      {/* Head Office and contacts */}
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: '#111827' }}>Head Office Address</Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', textAlign: 'center', marginTop: 4 }}>{headOfficeAddress}</Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 2 }}>Contact Numbers: 8906189999, 8885888778</Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 2 }}>Email: hrci.9@gmail.com</Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', marginTop: 2 }}>Website: www.hrcihe.com</Text>
      </View>

      {/* Terms & Conditions */}
      <View style={styles.backSection}>
        <Text style={styles.backSectionTitle}>Terms & Conditions</Text>
        <Text style={styles.backText}>
          1. This card is the property of HRCI and must be returned upon request to HRCI management.{"\n"}
          2. This card can be withdrawn anytime without notice.{"\n"}
          3. Use this card as per the terms and conditions of the cardholder agreement.{"\n"}
          4. If found, please return this card to the nearest police station or HRCI office.
        </Text>
      </View>

  {/* Bottom red strip (full-bleed, fixed) */}
  <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FE0002', height: 40 }} />
      </View>{/* backContentPad */}
    </View>
    </View>
  );
}

// Back capture helpers (same print sizing and fit as front: 85mm x 55mm @ 600DPI, cover)
const BACK_WIDTH_IN_INCHES = 55 / 25.4;
const BACK_DPI = 600;
const BASE_ASPECT = 1.42;
const TARGET_ASPECT = 85 / 55;

function BackHiddenCapture({ shotRef, secondLogoUrl, headOfficeAddress, qrValue }: { shotRef: React.RefObject<ViewShot | null>; secondLogoUrl?: string; headOfficeAddress: string; qrValue: string; }) {
  const widthInInches = BACK_WIDTH_IN_INCHES;
  const dpi = BACK_DPI;
  const effectiveExportWidth = Math.max(Math.round(widthInInches * dpi), 300);
  const doPad = Math.abs(TARGET_ASPECT - BASE_ASPECT) > 0.001;
  const exportHeightPx = Math.round(effectiveExportWidth * (doPad ? TARGET_ASPECT : BASE_ASPECT));

  // cover fit
  const innerW0 = effectiveExportWidth;
  const innerH0 = Math.round(effectiveExportWidth * BASE_ASPECT);
  const scale = exportHeightPx / innerH0;
  const scaledW = Math.round(innerW0 * scale);
  const scaledH = Math.round(innerH0 * scale);

  return (
    <View style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, opacity: 0 }}>
      <ViewShot
        ref={shotRef}
        options={{ format: 'jpg', quality: 1, result: 'tmpfile' }}
        style={{ width: effectiveExportWidth, height: exportHeightPx, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        <View style={{ width: scaledW, height: scaledH, alignItems: 'center', justifyContent: 'center' }}>
          <IdCardBack width={scaledW} secondLogoUrl={secondLogoUrl} headOfficeAddress={headOfficeAddress} qrValue={qrValue} />
        </View>
      </ViewShot>
    </View>
  );
}

// Front capture helpers (same sizing as back for consistency)
function FrontHiddenCapture(props: {
  shotRef: React.RefObject<ViewShot | null>;
  memberName: string;
  designation: string;
  cellName: string;
  idNumber: string;
  contactNumber: string;
  validUpto: string;
  logoUri?: string;
  photoUri?: string | undefined;
  stampUri?: string | undefined;
  authorSignUri?: string | undefined;
}) {
  const widthInInches = BACK_WIDTH_IN_INCHES;
  const dpi = BACK_DPI;
  const effectiveExportWidth = Math.max(Math.round(widthInInches * dpi), 300);
  const doPad = Math.abs(TARGET_ASPECT - BASE_ASPECT) > 0.001;
  const exportHeightPx = Math.round(effectiveExportWidth * (doPad ? TARGET_ASPECT : BASE_ASPECT));

  // cover fit
  const innerW0 = effectiveExportWidth;
  const innerH0 = Math.round(effectiveExportWidth * BASE_ASPECT);
  const scale = exportHeightPx / innerH0;
  const scaledW = Math.round(innerW0 * scale);
  const scaledH = Math.round(innerH0 * scale);

  return (
    <View style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, opacity: 0 }}>
      <ViewShot
        ref={props.shotRef}
        options={{ format: 'jpg', quality: 1, result: 'tmpfile' }}
        style={{ width: effectiveExportWidth, height: exportHeightPx, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
      >
        <View style={{ width: scaledW, height: scaledH, alignItems: 'center', justifyContent: 'center' }}>
          <HrciIdCardFrontExact
            width={scaledW}
            memberName={props.memberName}
            designation={props.designation}
            cellName={props.cellName}
            idNumber={props.idNumber}
            contactNumber={props.contactNumber}
            validUpto={props.validUpto}
            logoUri={props.logoUri}
            photoUri={props.photoUri}
            stampUri={props.stampUri}
            authorSignUri={props.authorSignUri}
          />
        </View>
      </ViewShot>
    </View>
  );
}

async function onBackCapture(ref: React.RefObject<ViewShot | null>): Promise<string | null> {
  try {
    const uri = await ref.current?.capture?.();
    return uri ?? null;
  } catch (e: any) {
    console.warn('Back capture failed', e);
    Alert.alert('Capture failed', e?.message ?? String(e));
    return null;
  }
}


async function onBackSaveToPhotos(ref: React.RefObject<ViewShot | null>) {
  const uri = await onBackCapture(ref);
  if (!uri) return;
  try {
    const ML: any = await import('expo-media-library');
    const requestPermissionsAsync = ML?.requestPermissionsAsync ?? ML?.default?.requestPermissionsAsync;
    const saveToLibraryAsync = ML?.saveToLibraryAsync ?? ML?.default?.saveToLibraryAsync;
    if (!requestPermissionsAsync || !saveToLibraryAsync) throw new Error('MediaLibrary native module not available');
    const { status } = await requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow Photos/Media permission to save the image.');
      return;
    }
    await saveToLibraryAsync(uri);
    Alert.alert('Saved', 'Back ID card saved to Photos.');
  } catch (e: any) {
    console.warn('Back save to Photos failed', e);
    Alert.alert('Save unavailable', 'The Save to Photos feature requires rebuilding the dev client with expo-media-library. Falling back to Share.');
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share Back ID Card (JPEG)', UTI: 'public.jpeg' });
    } catch {}
  }
}

// Combined Front+Back capture (stacked vertically) for sharing both at once
function BothHiddenCapture(props: {
  shotRef: React.RefObject<ViewShot | null>;
  // Front props
  memberName: string;
  designation: string;
  cellName: string;
  idNumber: string;
  contactNumber: string;
  validUpto: string;
  logoUri?: string;
  photoUri?: string | undefined;
  stampUri?: string | undefined;
  authorSignUri?: string | undefined;
  // Back props
  secondLogoUrl?: string;
  headOfficeAddress: string;
  qrValue: string;
}) {
  const widthInInches = BACK_WIDTH_IN_INCHES;
  const dpi = BACK_DPI;
  const effectiveExportWidth = Math.max(Math.round(widthInInches * dpi), 300);
  const doPad = Math.abs(TARGET_ASPECT - BASE_ASPECT) > 0.001;
  const exportHeightPx = Math.round(effectiveExportWidth * (doPad ? TARGET_ASPECT : BASE_ASPECT));

  // cover fit dimensions for inner cards
  const innerW0 = effectiveExportWidth;
  const innerH0 = Math.round(effectiveExportWidth * BASE_ASPECT);
  const scale = exportHeightPx / innerH0;
  const scaledW = Math.round(innerW0 * scale);
  const scaledH = Math.round(innerH0 * scale);

  return (
    <View style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, opacity: 0 }}>
      <ViewShot
        ref={props.shotRef}
        options={{ format: 'jpg', quality: 1, result: 'tmpfile' }}
        style={{ width: effectiveExportWidth, height: exportHeightPx * 2, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' }}
      >
        {/* Front (cover fit) */}
        <View style={{ width: effectiveExportWidth, height: exportHeightPx, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <View style={{ width: scaledW, height: scaledH, alignItems: 'center', justifyContent: 'center' }}>
            <HrciIdCardFrontExact
              width={scaledW}
              memberName={props.memberName}
              designation={props.designation}
              cellName={props.cellName}
              idNumber={props.idNumber}
              contactNumber={props.contactNumber}
              validUpto={props.validUpto}
              logoUri={props.logoUri}
              photoUri={props.photoUri}
              stampUri={props.stampUri}
              authorSignUri={props.authorSignUri}
            />
          </View>
        </View>

        {/* Back (cover fit) */}
        <View style={{ width: effectiveExportWidth, height: exportHeightPx, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <View style={{ width: scaledW, height: scaledH, alignItems: 'center', justifyContent: 'center' }}>
            <IdCardBack width={scaledW} secondLogoUrl={props.secondLogoUrl} headOfficeAddress={props.headOfficeAddress} qrValue={props.qrValue} />
          </View>
        </View>
      </ViewShot>
    </View>
  );
}

// Share two separate images (front and back) together if supported; falls back to combined tall image
async function onShareTwoImages(
  frontRef: React.RefObject<ViewShot | null>,
  backRef: React.RefObject<ViewShot | null>,
  bothRef: React.RefObject<ViewShot | null>
) {
  try {
    const [frontUriRaw, backUriRaw] = await Promise.all([
      frontRef.current?.capture?.(),
      backRef.current?.capture?.(),
    ]);

    const ensureFileUri = (u?: string | null) => {
      if (!u) return null;
      return u.startsWith('file://') ? u : `file://${u}`;
    };

    const frontUri = ensureFileUri(frontUriRaw);
    const backUri = ensureFileUri(backUriRaw);

    if (frontUri && backUri) {
      // Try to require react-native-share at runtime (only if available in Dev Client)
      let RNShare: any = null;
      try {
        const mod = require('react-native-share');
        RNShare = mod?.default ?? mod;
      } catch {}

      if (RNShare?.open) {
        await RNShare.open({
          urls: [frontUri, backUri],
          type: 'image/*',
          showAppsToView: true,
          failOnCancel: false,
          title: 'Share ID Card (Front & Back)'
        });
        return;
      }
    }

    // If either capture failed, fall back to sharing combined image
    await onShareBoth(bothRef);
  } catch (e: any) {
    console.warn('Multi-image share failed, falling back to combined image', e);
    await onShareBoth(bothRef);
  }
}

async function onShareBoth(ref: React.RefObject<ViewShot | null>) {
  try {
    const uri = await ref.current?.capture?.();
    if (!uri) return;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share Front + Back (JPEG)', UTI: 'public.jpeg' });
    } else {
      Alert.alert('Sharing not available', 'Your device does not support the native share sheet.');
    }
  } catch (e: any) {
    console.warn('Share both failed', e);
    Alert.alert('Share failed', e?.message ?? String(e));
  }
}