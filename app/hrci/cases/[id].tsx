import { Button } from '@/components/ui/Button';
import { FullScreenLoader, Loader, LOADER_SIZES } from '@/components/ui/Loader';
import { Colors } from '@/constants/Colors';
import { getHrciCaseTimeline, HrciCaseTimelineEntry, uploadHrciCaseAttachment } from '@/services/hrciCases';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HrciCaseDetailsScreen() {
  const { id, caseNumber, status, priority } = useLocalSearchParams<{ id: string; caseNumber?: string; status?: string; priority?: string }>();
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<HrciCaseTimelineEntry[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Image gallery state for attachments
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryItems, setGalleryItems] = useState<{ url: string; name?: string }[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const { width: winW, height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const headerHeight = 56;
  const pageWidth = winW;
  const imageAreaHeight = Math.max(0, winH - headerHeight - (insets?.top || 0) - (insets?.bottom || 0));

  const onOpenGallery = useCallback((items: { url: string; name?: string }[], startIndex: number = 0) => {
    setGalleryItems(items);
    setGalleryIndex(startIndex);
    setGalleryOpen(true);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const t = await getHrciCaseTimeline(String(id));
      setTimeline(t);
    } catch (e: any) {
      try { Alert.alert('Error', e?.message || 'Failed to load timeline'); } catch {}
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  const [tlQuery, setTlQuery] = useState('');
  const filteredTimeline = useMemo(() => {
    const q = tlQuery.trim().toLowerCase();
    if (!q) return timeline;
    return timeline.filter((t) => {
      const typeStr = prettyType(t.type).toLowerCase();
      const dataStr = (() => { try { return JSON.stringify(t.data || {}).toLowerCase(); } catch { return String(t.data || '').toLowerCase(); } })();
      return typeStr.includes(q) || dataStr.includes(q);
    });
  }, [timeline, tlQuery]);

  const pickAndUpload = useCallback(async () => {
    if (!id) return;
    try {
      setUploading(true);
  const res = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
      if ((res as any)?.canceled) return;
      const file = Array.isArray((res as any)?.assets) ? (res as any).assets[0] : (res as any);
      const uri: string = file?.uri;
      if (!uri) return;
      const name: string = file?.name || uri.split('/').pop() || `file_${Date.now()}`;
      const mime: string = file?.mimeType || file?.mime || 'application/octet-stream';
  await uploadHrciCaseAttachment(String(id), { uri, name, mime });
  try { Alert.alert('Uploaded', 'Attachment added'); } catch {}
  // Reload timeline so the new attachment shows up immediately
  try { await load(); } catch {}
      setSheetOpen(false);
    } catch (e: any) {
      try { Alert.alert('Failed', e?.message || 'Could not upload file'); } catch {}
    } finally {
      setUploading(false);
    }
  }, [id, load]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#ffffff' }]}> 
        <Loader size={80} />
        <Text style={{ color: '#111' }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {/* Safe Area App Bar with Back + Search */}
      <SafeAreaView style={{ backgroundColor: '#ffffff' }}>
        <View style={[styles.appBar, { paddingHorizontal: 12, borderBottomColor: '#f2f2f2' }]}>
          <Pressable onPress={() => router.back()} style={styles.appBarBtn} hitSlop={8}>
            <Text style={[styles.appBarBtnText, { color: '#111' }]}>{'‹'}</Text>
          </Pressable>
          <TextInput
            value={tlQuery}
            onChangeText={setTlQuery}
            placeholder={caseNumber ? `Search timeline — ${caseNumber}` : 'Search timeline'}
            placeholderTextColor="#9CA3AF"
            style={styles.appBarSearch}
            returnKeyType="search"
          />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header chips */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          {status ? <Text style={[styles.chip, statusChipStyle(status)]}>{status}</Text> : null}
          {priority ? <Text style={[styles.chip, priorityChipStyle(priority)]}>{priority}</Text> : null}
        </View>
        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flexShrink: 0 }}>
            <Button title="Add Attachment" variant="primary" onPress={() => setSheetOpen(true)} disabled={uploading} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Refresh" variant="secondary" onPress={load} style={{ width: '100%' }} />
          </View>
        </View>

        {/* Timeline */}
        <Text style={[styles.sectionTitle, { color: '#111' }]}>Timeline</Text>
        {filteredTimeline.length === 0 ? (
          <Text style={[styles.empty, { color: '#6b7280' }]}>No updates yet.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredTimeline.map((t) => (
              <View key={t.id} style={styles.timelineItem}>
                <View style={[styles.timelineDot, dotStyleForType(t.type)]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.timelineType, { color: '#111' }]}>{prettyType(t.type)}</Text>
                  {renderTimelineData(t, onOpenGallery)}
                  <Text style={[styles.timelineWhen, { color: '#6b7280' }]}>{new Date(t.createdAt).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Image Gallery Modal (light) */}
      <Modal visible={galleryOpen} animationType="slide" onRequestClose={() => setGalleryOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
          {/* Header */}
          <SafeAreaView style={{ backgroundColor: '#ffffff' }}>
            <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' }}>
              <Pressable onPress={() => setGalleryOpen(false)} hitSlop={8} style={{ padding: 8 }}>
                <Text style={{ color: '#111', fontSize: 18 }}>Close</Text>
              </Pressable>
              <Text style={{ color: '#111', fontWeight: '700' }}>{galleryItems.length ? `${galleryIndex + 1} / ${galleryItems.length}` : ''}</Text>
              <View style={{ width: 60 }} />
            </View>
          </SafeAreaView>
          {/* Images */}
          <ScrollView
            style={{ flex: 1 }}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              try {
                const { contentOffset, layoutMeasurement } = e.nativeEvent;
                const baseW = layoutMeasurement?.width || pageWidth || 1;
                const idx = Math.round((contentOffset.x || 0) / baseW);
                if (!Number.isNaN(idx)) setGalleryIndex(Math.max(0, Math.min(idx, galleryItems.length - 1)));
              } catch {}
            }}
            scrollEventThrottle={16}
            contentContainerStyle={{ alignItems: 'center' }}
          >
            {galleryItems.map((it, i) => (
              <View key={`${it.url}_${i}`} style={{ width: pageWidth, height: imageAreaHeight, justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: it.url }} style={{ width: pageWidth, height: imageAreaHeight }} resizeMode="contain" />
                {it.name ? (
                  <View style={{ position: 'absolute', bottom: 8 + (insets?.bottom || 0), left: 16, right: 16, alignItems: 'center' }}>
                    <Text style={{ color: '#111', backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }} numberOfLines={1}>
                      {it.name}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Bottom sheet: upload (light) */}
      <Modal transparent visible={sheetOpen} animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} />
          <View style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: '#e5e7eb', marginBottom: 8 }} />
            <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 }}>Attachments</Text>
            <Pressable onPress={pickAndUpload} style={{ paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff', marginTop: 8, alignItems: 'center' }} disabled={uploading}>
              <Text style={{ color: '#111', fontWeight: '700' }}>Upload file</Text>
            </Pressable>
            <Pressable onPress={() => setSheetOpen(false)} style={{ paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8 }}>
              <Text style={{ color: '#6b7280' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Page overlay loader during upload */}
      {uploading ? (
        <Modal visible animationType="fade" transparent>
          <View style={{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
            <FullScreenLoader size={LOADER_SIZES.xxlarge} label="Uploading…" />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function safeJson(d: any): string {
  try { return JSON.stringify(d); } catch { return String(d); }
}

function prettyType(t: string): string {
  const m: Record<string, string> = {
    CREATED: 'Case created',
    STATUS_CHANGED: 'Status changed',
    LEGAL_STATUS_CHANGED: 'Legal status changed',
    ATTACHMENT_ADDED: 'Attachment added',
  };
  return m[t] || t.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function dotStyleForType(t: string) {
  switch (t) {
    case 'CREATED': return { backgroundColor: '#10B981' };
    case 'STATUS_CHANGED': return { backgroundColor: '#F59E0B' };
    case 'LEGAL_STATUS_CHANGED': return { backgroundColor: '#8B5CF6' };
    case 'ATTACHMENT_ADDED': return { backgroundColor: '#3B82F6' };
    default: return {};
  }
}

function statusChipStyle(s: string) {
  const u = s.toUpperCase();
  switch (u) {
    case 'NEW': return styles.stNew;
    case 'TRIAGED': return styles.stTriaged;
    case 'IN_PROGRESS': return styles.stInProgress;
    case 'LEGAL_REVIEW': return styles.stLegal;
    case 'ACTION_TAKEN': return styles.stAction;
    case 'RESOLVED': return styles.stResolved;
    case 'REJECTED': return styles.stRejected;
    case 'CLOSED': return styles.stClosed;
    case 'ESCALATED': return styles.stEscalated;
    default: return {} as any;
  }
}

function priorityChipStyle(p: string) {
  const k = (p || '').toLowerCase();
  switch (k) {
    case 'low': return { backgroundColor: '#DCFCE7' };
    case 'medium': return { backgroundColor: '#FEF9C3' };
    case 'high': return { backgroundColor: '#FEE2E2' };
    case 'critical':
    case 'urgent': return { backgroundColor: '#FECACA' };
    default: return {} as any;
  }
}

function renderTimelineData(
  t: HrciCaseTimelineEntry,
  onOpenGallery: (items: { url: string; name?: string }[], startIndex?: number) => void
) {
  const data = t.data as any;
  if (!data) return null;
  if (t.type === 'STATUS_CHANGED') {
    return (
      <Text style={[styles.timelineData, { color: '#6b7280' }]}>
        {`Status: ${data.from} → ${data.to}${data.note ? ` — ${data.note}` : ''}`}
      </Text>
    );
  }
  if (t.type === 'LEGAL_STATUS_CHANGED') {
    return (
      <Text style={[styles.timelineData, { color: '#6b7280' }]}>
        {`Legal: ${data.from} → ${data.to}${data.suggestion ? ` — ${data.suggestion}` : ''}`}
      </Text>
    );
  }
  if (t.type === 'ATTACHMENT_ADDED') {
    // Helper to detect image attachments in multiple shapes
    const toImages = (): { url: string; name?: string }[] => {
      const images: { url: string; name?: string }[] = [];
      const pushIfImg = (obj: any) => {
        const u = obj?.url || obj?.uri || (typeof obj === 'string' ? obj : undefined);
        const m = (obj?.mime || obj?.mimeType || '').toString().toLowerCase();
        const looksImg = m.startsWith('image') || (typeof u === 'string' && /\.(png|jpe?g|webp|gif|bmp|heic)(\?|#|$)/i.test(u));
        if (u && looksImg) images.push({ url: u, name: obj?.fileName || obj?.name });
      };
      if (Array.isArray(data?.attachments)) data.attachments.forEach(pushIfImg);
      if (Array.isArray(data?.urls)) data.urls.forEach((u: any) => pushIfImg(u));
      if (Array.isArray(data?.images)) data.images.forEach((u: any) => pushIfImg(u));
      if (!images.length && typeof data?.url === 'string' && typeof data?.mime === 'string' && data.mime.toLowerCase().startsWith('image')) {
        images.push({ url: data.url, name: data.fileName });
      }
      return images;
    };

    const images = toImages();
    const hasSingleFileUrl = typeof data?.url === 'string';
    const isSingleFileImage = hasSingleFileUrl && typeof data?.mime === 'string' && data.mime.toLowerCase().startsWith('image');

    return (
      <View style={{ marginTop: 4, gap: 6 }}>
        <Text style={[styles.timelineData, { color: '#6b7280' }]}>
          {`${data.fileName || (images.length ? 'Image(s)' : 'Attachment')}${data.mime ? ` (${data.mime})` : ''}`}
        </Text>
        {/* Show link(s) instead of inline images */}
        {images.length > 0 ? (
          <Pressable
            onPress={() => { onOpenGallery(images, 0); }}
            style={{ alignSelf: 'flex-start' }}
          >
            <Text style={{ color: Colors.light.primary, fontWeight: '700' }}>
              {images.length === 1 ? 'View image' : `View images (${images.length})`}
            </Text>
          </Pressable>
        ) : null}
        {/* Non-image single file link */}
        {hasSingleFileUrl && !isSingleFileImage ? (
          <Pressable onPress={() => openBrowserAsync(data.url)} style={{ alignSelf: 'flex-start' }}>
            <Text style={{ color: Colors.light.primary, fontWeight: '700' }}>View</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return <Text style={[styles.timelineData, { color: '#6b7280' }]} numberOfLines={4}>{safeJson(data)}</Text>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  appBarBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  appBarBtnText: { fontSize: 24, color: '#111' },
  appBarTitle: { color: '#111', fontSize: 18, fontWeight: '700' },
  appBarSearch: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: '#111', backgroundColor: '#fff' },
  caseNo: { color: Colors.light.primary, fontSize: 14, fontWeight: '800' },
  chip: { backgroundColor: '#f3f4f6', color: '#111', fontSize: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', fontWeight: '700' },
  stNew: { backgroundColor: '#E5E7EB' },
  stTriaged: { backgroundColor: '#DBEAFE' },
  stInProgress: { backgroundColor: '#FEF3C7' },
  stLegal: { backgroundColor: '#EDE9FE' },
  stAction: { backgroundColor: '#DBEAFE' },
  stResolved: { backgroundColor: '#DCFCE7' },
  stRejected: { backgroundColor: '#FEE2E2' },
  stClosed: { backgroundColor: '#E5E7EB' },
  stEscalated: { backgroundColor: '#FFE4E6' },
  // Button styles replaced by shared Button component
  sectionTitle: { color: '#111', fontWeight: '700', marginBottom: 8 },
  empty: { color: '#6b7280' },
  timelineItem: { flexDirection: 'row', gap: 12, backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderWidth: 1, padding: 12, borderRadius: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: Colors.light.primary, marginTop: 4 },
  timelineType: { color: '#111', fontWeight: '700' },
  timelineData: { color: '#6b7280', marginTop: 4 },
  timelineWhen: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  sheetGrabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 999, backgroundColor: '#e5e7eb', marginBottom: 8 },
  sheetTitle: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 8 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 16 },
});
