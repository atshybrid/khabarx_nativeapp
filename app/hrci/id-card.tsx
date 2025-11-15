import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import ViewShot from 'react-native-view-shot';


import { request } from '@/services/http';

type Profile = {
  id?: string;
  fullName?: string;
  profilePhotoUrl?: string;
  dob?: string;
  mobileNumber?: string;
  address?: { mandal?: string; district?: string; village?: string } | null;
};

type Membership = {
  kyc?: { hasKyc?: boolean; status?: string; updatedAt?: string } | null;
  cell?: { id?: string; name?: string } | null;
  designation?: { id?: string; code?: string; name?: string } | null;
  hrci?: { zone?: string | null } | null;
};

const CR80_WIDTH_IN_INCHES = 3.375;
const CR80_HEIGHT_IN_INCHES = 2.1264;
const LANDSCAPE_ASPECT = CR80_HEIGHT_IN_INCHES / CR80_WIDTH_IN_INCHES;

export default function IdCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ cardNumber?: string }>();
  const paramCardNumber = (params?.cardNumber as string | undefined)?.trim().toLowerCase();
  const { width: winWidth } = useWindowDimensions();
  const exactCardWidth = Math.min(Math.max(320, winWidth - 32), 720);
  const previewHeight = Math.round(exactCardWidth * LANDSCAPE_ASPECT);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [cardApi, setCardApi] = useState<any | null>(null);
  const [manualCardNumber, setManualCardNumber] = useState<string>('');
  const consolidatedWarnedRef = useRef(false);
  const [downloading, setDownloading] = useState(false);

  // Preload from env for convenience during testing
  const envCardNumber = ((process.env as any)?.EXPO_PUBLIC_HRCI_CARD_NUMBER
    || (process.env as any)?.EXPO_PUBLIC_CARD_NUMBER
    || (process.env as any)?.EXPO_PUBLIC_TEST_CARD_NUMBER) as string | undefined;

  useEffect(() => {
    // initialize manual input from param or env
    if (paramCardNumber && !manualCardNumber) setManualCardNumber(paramCardNumber);
    else if (!paramCardNumber && envCardNumber && !manualCardNumber) setManualCardNumber((envCardNumber || '').toLowerCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramCardNumber, envCardNumber]);

  const frontRef = useRef<ViewShot | null>(null);
  const backRef = useRef<ViewShot | null>(null);

  useEffect(() => {
    const load = async () => {
      setProfileError(null);
      try {
        const p = await request<any>('/profiles/me', { method: 'GET' });
        const prof = p?.data || p;
        setProfile(prof);
        try {
          const m = await request<any>('/memberships/me', { method: 'GET' });
          setMembership(m?.data || m || null);
        } catch (me: any) {
          console.warn('[ID Card] membership load failed', me?.message || me);
        }
        // Prefer explicit cardNumber endpoint if provided via route param
        if (paramCardNumber) {
          try {
            const r = await request<any>(`/hrci/idcard/${encodeURIComponent(paramCardNumber)}`, { method: 'GET' });
            if (r) setCardApi(r);
          } catch (cardErr: any) {
            const msg = cardErr?.message || String(cardErr);
            if (!/404/.test(msg)) console.warn('[ID Card] fetch by cardNumber failed', msg);
          }
        }

        // If not set by param, try env-provided card number (developer convenience)
        if (!paramCardNumber && !cardApi && envCardNumber) {
          try {
            const cn = (envCardNumber || '').trim().toLowerCase();
            if (cn) {
              const r = await request<any>(`/hrci/idcard/${encodeURIComponent(cn)}`, { method: 'GET' });
              if (r) setCardApi(r);
            }
          } catch (cardErr: any) {
            const msg = cardErr?.message || String(cardErr);
            if (!/404/.test(msg)) console.warn('[ID Card] fetch by env cardNumber failed', msg);
          }
        }

        // If not set by param fetch, try consolidated card + settings response fallbacks
        if (!cardApi && !paramCardNumber) {
          try {
            let r = await request<any>('/hrci/idcard/me', { method: 'GET' });
            if (!r?.data?.card && !r?.card) {
              try { r = await request<any>('/hrci/idcard', { method: 'GET' }); } catch {}
            }
            if (!r?.data?.card && !r?.card) {
              try { r = await request<any>('/hrci/id-card/me', { method: 'GET' }); } catch {}
            }
            if (r) setCardApi(r);
          } catch (cardErr: any) {
            const msg = cardErr?.message || String(cardErr);
            // Suppress noisy 404s; warn once for other failures
            if (!/404/.test(msg) && !consolidatedWarnedRef.current) {
              console.warn('[ID Card] consolidated card fetch failed', msg);
              consolidatedWarnedRef.current = true;
            }
          }
        }
        if (!prof?.profilePhotoUrl) {
          Alert.alert(
            'Profile Photo Required',
            'You need to upload your profile photo to view your ID card.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
              { text: 'Upload Photo', onPress: () => router.push('/hrci/profile-photo' as any) },
            ]
          );
        }
      } catch (e: any) {
        setProfileError(e?.message || 'Failed to load your profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router, paramCardNumber]);

  // Map consolidated API if present
  const apiData = (cardApi?.data ?? cardApi) || null;
  const apiCard = apiData?.card ?? null;
  const apiSetting = apiData?.setting ?? null;
  const apiVerifyUrl: string | undefined = apiData?.verifyUrl ?? undefined;
  const apiQrUrl: string | undefined = apiData?.qrUrl ?? undefined;
  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    } catch { return iso as string; }
  };
  const memberName = apiCard?.fullName ?? profile?.fullName ?? '';
  const designation = apiCard?.designationNameFormatted ?? apiCard?.designationDisplay ?? membership?.designation?.name ?? '';
  const designationLevel = apiCard?.levelTitle ?? membership?.designation?.code ?? undefined;
  const cellName = apiCard?.cellName ?? membership?.cell?.name ?? '';
  const workPlace = apiCard?.memberLocationName ?? apiCard?.locationTitle ?? profile?.address?.mandal ?? profile?.address?.district ?? profile?.address?.village ?? '';
  const idNumber = apiCard?.cardNumber ?? profile?.id ?? '';
  const contactNumber = apiCard?.mobileNumber ?? profile?.mobileNumber ?? '';
  const validUpto = fmtDate(apiCard?.expiresAt ?? membership?.kyc?.updatedAt);
  // Default assets for logo and stamp to ensure visuals even if not provided by API
  const defaultLogoUri = Image.resolveAssetSource(require('../../assets/images/hrci_logo.png'))?.uri;
  const defaultStampUri = Image.resolveAssetSource(require('../../assets/images/brand_icon.jpg'))?.uri;
  const cardLogoUri = apiSetting?.frontLogoUrl ?? defaultLogoUri;
  const photoUri = apiCard?.profilePhotoUrl ?? profile?.profilePhotoUrl ?? undefined;
  const stampUri = apiSetting?.hrciStampUrl ?? defaultStampUri;
  const authorSignUri = apiSetting?.authorSignUrl ?? undefined;
  // Prefer server-provided QR image URL if available; otherwise build from verifyUrl
  const frontQrUri = apiQrUrl || (apiVerifyUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(apiVerifyUrl)}` : undefined);

  // Helper: base64 encode from ArrayBuffer (no Buffer/btoa assumptions)
  const toBase64 = (buffer: ArrayBuffer): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const bytes = new Uint8Array(buffer);
    const len = bytes.length;
    let base64 = '';
    let i = 0;
    while (i < len) {
      const b1 = bytes[i++] ?? 0;
      const b2 = bytes[i++] ?? 0;
      const b3 = bytes[i++] ?? 0;
      const enc1 = b1 >> 2;
      const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
      const enc3 = ((b2 & 15) << 2) | (b3 >> 6);
      const enc4 = b3 & 63;
      if (isNaN(b2)) {
        base64 += chars.charAt(enc1) + chars.charAt(enc2) + '==';
      } else if (isNaN(b3)) {
        base64 += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + '=';
      } else {
        base64 += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
      }
    }
    return base64;
  };

  // New: server-side PDF generator call (POST) and save/share locally
  const onDownloadServerPdf = async () => {
    try {
      setDownloading(true);
      const cn = (paramCardNumber || apiCard?.cardNumber || manualCardNumber || '').trim().toLowerCase();
      if (!cn) {
        Alert.alert('Missing', 'No card number available to download.');
        return;
      }
      const jwt = await AsyncStorage.getItem('jwt');
      const url = `${require('@/services/http').getBaseUrl()}/hrci/idcard/pdf`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/pdf',
          'Content-Type': 'application/json',
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({ cardNumber: cn, side: 'both', design: 'poppins' }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const dispo = res.headers.get('content-disposition') || '';
      const m = dispo.match(/filename="?([^";]+)"?/i);
      const filename = m?.[1] || `${cn}-both.pdf`;
      const arr = await res.arrayBuffer();
      const b64 = toBase64(arr);
      // Try Android SAF first
      const SAF = (FileSystem as any).StorageAccessFramework;
      let savedUri: string | null = null;
      try {
        if (SAF) {
          const perm = await SAF.requestDirectoryPermissionsAsync();
          if (perm?.granted && perm.directoryUri) {
            const dest = await SAF.createFileAsync(perm.directoryUri, filename, 'application/pdf');
            await FileSystem.writeAsStringAsync(dest, b64, { encoding: 'base64' as any });
            savedUri = dest;
            Alert.alert('Saved', `PDF saved as ${filename}`);
          }
        }
      } catch (e) {
        console.warn('[ID Card] SAF save failed', e);
      }
      if (!savedUri) {
        // Save to app doc dir as fallback, then share
        const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '';
        const temp = `${baseDir}${filename}`;
        await FileSystem.writeAsStringAsync(temp, b64, { encoding: 'base64' as any });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(temp, { mimeType: 'application/pdf', dialogTitle: 'Share ID Card (PDF)', UTI: 'com.adobe.pdf' });
        } else {
          Alert.alert('PDF ready', temp);
        }
      }
    } catch (e: any) {
      console.warn('[ID Card] Server PDF download failed', e);
      Alert.alert('Download failed', e?.message || String(e));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <View style={styles.header}>
            <View style={{ width: 24 }} />
            <Text style={styles.headerTitle}>ID Card</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.frontContent} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (profileError) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>ID Card</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={[styles.frontContent, { alignItems: 'center', justifyContent: 'center' }]}> 
            <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: 16, borderRadius: 12, maxWidth: 560 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 }}>Unable to load your profile</Text>
              <Text style={{ color: '#e5e7eb', marginBottom: 12 }}>{profileError}</Text>
              <View style={{ flexDirection: 'row', columnGap: 12 }}>
                <TouchableOpacity onPress={() => { setLoading(true); setTimeout(() => { setLoading(false); }, 300); }} style={[styles.actionBtn, { backgroundColor: '#10b981' }]}>
                  <MaterialCommunityIcons name="reload" size={20} color="#fff" />
                  <Text style={styles.actionText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.back()} style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}>
                  <MaterialCommunityIcons name="close" size={20} color="#fff" />
                  <Text style={styles.actionText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ID Card</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.frontContent}>
          {/* Manual loader when no card data is available */}
          {!apiCard && (
            <View style={styles.loaderRow}>
              <TextInput
                placeholder="Enter card number (e.g. hrci-2511-00003)"
                placeholderTextColor="#94a3b8"
                value={manualCardNumber}
                onChangeText={(t) => setManualCardNumber(t.trim().toLowerCase())}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.loadBtn]}
                onPress={async () => {
                  const cn = manualCardNumber?.trim().toLowerCase();
                  if (!cn) return;
                  try {
                    setLoading(true);
                    const r = await request<any>(`/hrci/idcard/${encodeURIComponent(cn)}`, { method: 'GET' });
                    setCardApi(r);
                  } catch (e: any) {
                    Alert.alert('Not found', e?.message || 'Card not found');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
                <Text style={styles.loadBtnText}>Load</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Server-side direct download only (no preview) */}
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <Text style={{ color: '#e5e7eb', marginBottom: 8, textAlign: 'center' }}>
              Download a print-ready PDF generated by the server.
            </Text>
          </View>

          {/* Bottom actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#8b5cf6', opacity: downloading ? 0.85 : 1 }]} 
              onPress={onDownloadServerPdf}
              activeOpacity={0.8}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <MaterialCommunityIcons name="file-pdf-box" size={22} color="#ffffff" />
              )}
              <Text style={styles.actionText}>{downloading ? 'Downloading…' : 'Download ID Card'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  frontContent: { flex: 1, justifyContent: 'flex-start', paddingHorizontal: 20, paddingBottom: 28 },
  tabsRow: { 
    flexDirection: 'row', 
    alignSelf: 'center', 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    borderRadius: 16, 
    marginBottom: 16, 
    padding: 4 
  },
  tabBtn: { 
    paddingVertical: 12, 
    paddingHorizontal: 24, 
    borderRadius: 12, 
    minWidth: 80 
  },
  tabActive: { 
    backgroundColor: 'rgba(255,255,255,0.25)', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  tabInactive: { backgroundColor: 'transparent' },
  tabText: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  tabTextActive: { color: '#ffffff' },
  tabTextInactive: { color: '#cbd5e1' },
  cardContainer: { alignItems: 'center', borderRadius: 12, overflow: 'hidden' },
  stageVisible: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    top: 0, 
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8
  },
  stageHidden: { position: 'absolute', left: -9999, top: -9999, opacity: 0, width: 0, height: 0 },
  actionsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: 16, 
    marginTop: 12, 
    paddingHorizontal: 20 
  },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingVertical: 14, 
    borderRadius: 16, 
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 120
  },
  actionText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#e5e7eb',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)'
  },
  loadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0ea5e9'
  },
  loadBtnText: { color: '#fff', fontWeight: '800' },
});