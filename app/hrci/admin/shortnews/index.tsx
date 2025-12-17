import { Colors } from '@/constants/Colors';
import { listAdminShortNews, ShortNewsItem, updateAdminShortNewsStatus } from '@/services/hrciAdmin';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATUS_OPTIONS = ['PENDING', 'AI_APPROVED', 'DESK_PENDING', 'DESK_APPROVED', 'REJECTED'] as const;

export default function AdminShortNewsList() {
  const router = useRouter();
  const [items, setItems] = useState<ShortNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('DESK_PENDING'); // default
  const [busyId, setBusyId] = useState<string | null>(null);
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);
  const [remarkForId, setRemarkForId] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalIndex, setImageModalIndex] = useState(0);
  const [imageModalImages, setImageModalImages] = useState<string[]>([]);
  const [articleModalOpen, setArticleModalOpen] = useState(false);
  const [articleItem, setArticleItem] = useState<ShortNewsItem | null>(null);
  const [articleRemark, setArticleRemark] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const load = useCallback(async (reset = false, cursorArg?: string | null) => {
    try {
      if (reset) { setLoading(true); setItems([]); setNextCursor(null); }
      const res = await listAdminShortNews({ languageId: 'te', status: status || undefined, limit: 12, cursor: reset ? undefined : cursorArg ?? undefined });
      if (reset) {
        setItems(res.data || []);
      } else {
        setItems(prev => [...prev, ...(res.data || [])]);
      }
      setNextCursor(res.nextCursor ?? null);
    } catch (e: any) {
      Alert.alert('Short News', e?.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hourStr = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} : ${hourStr}:${minutes} ${ampm}`;
  };

  useEffect(() => { load(true); }, [load, status]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loading) return;
    // pass nextCursor explicitly to avoid relying on stale state
    load(false, nextCursor);
  }, [nextCursor, loading, load]);

  const openRemarkFor = (id: string) => {
    setRemarkForId(id);
    setRemarkText('');
    setRemarkModalOpen(true);
  };

  const performUpdate = async (id: string, newStatus: string, remark?: string | null) => {
    if (!id) return;
    try {
      setBusyId(id);
      await updateAdminShortNewsStatus(id, newStatus, remark ?? undefined);
      Alert.alert('Short News', 'Status updated');
      // refresh list
      setNextCursor(null);
      await load(true);
    } catch (e: any) {
      Alert.alert('Short News', e?.message || 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const flushPendingAction = async (commitImmediately = true) => {
    if (!pendingAction) return;
    const action = pendingAction;
    try {
      if ((action.timeoutId as any) != null) clearTimeout(action.timeoutId);
    } catch (e) {}
    setPendingAction(null);
    setSnackbarVisible(false);
    if (commitImmediately) {
      await performUpdate(action.id, action.newStatus, action.remark ?? undefined);
    }
  };

  const scheduleUpdateWithUndo = (item: ShortNewsItem, newStatus: string, remark?: string | null) => {
    if (!item?.id) return;
    // if there's an existing pending action, commit it immediately before scheduling another
    if (pendingAction) {
      void flushPendingAction(true);
    }

    const prevStatus = String(item.status || '').toUpperCase();

    // optimistic update in UI
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: newStatus } : it));

    const timeoutId = setTimeout(async () => {
      // commit to backend
      await performUpdate(item.id!, newStatus, remark ?? undefined);
      setPendingAction(null);
      setSnackbarVisible(false);
    }, 6000);

    setPendingAction({ id: item.id!, prevStatus, newStatus, remark: remark ?? undefined, timeoutId });
    setSnackbarVisible(true);
  };

  const undoPending = () => {
    if (!pendingAction) return;
    try { if ((pendingAction.timeoutId as any) != null) clearTimeout(pendingAction.timeoutId); } catch (e) {}
    // revert optimistic update
    setItems(prev => prev.map(it => it.id === pendingAction.id ? { ...it, status: pendingAction.prevStatus } : it));
    setPendingAction(null);
    setSnackbarVisible(false);
  };

  const onApprove = (item: ShortNewsItem) => {
    // If status is PENDING or DESK_PENDING, open remark input for optional remark and then call DESK_APPROVED
    if (!item?.id) return;
    if (String(item.status || '').toUpperCase().includes('PENDING')) {
      openRemarkFor(item.id);
    } else {
      Alert.alert('Approve', 'Mark as DESK_APPROVED?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => scheduleUpdateWithUndo(item, 'DESK_APPROVED') },
      ]);
    }
  };

  const onReject = (item: ShortNewsItem) => {
    if (!item?.id) return;
    // Use Alert.prompt on platforms that support it (iOS). Otherwise fall back to confirm alert.
    if (typeof (Alert as any).prompt === 'function') {
      (Alert as any).prompt('Reject item', 'Enter remark (optional)', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', onPress: (text?: string) => scheduleUpdateWithUndo(item, 'REJECTED', String(text || '')) },
      ], 'plain-text');
    } else {
      Alert.alert('Reject', 'Are you sure you want to reject?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, reject', onPress: () => scheduleUpdateWithUndo(item, 'REJECTED') },
      ]);
    }
  };

  const renderItem = ({ item }: { item: ShortNewsItem }) => {
    const statusUpper = String(item.status || '').toUpperCase();
    const showApprove = statusUpper === 'REJECTED' || ['PENDING', 'DESK_PENDING'].includes(statusUpper);
    const showReject = statusUpper !== 'REJECTED';

    // Build images array from available fields on the item
    const images: string[] = [];
    if ((item as any).primaryImageUrl) images.push((item as any).primaryImageUrl);
    if ((item as any).images && Array.isArray((item as any).images)) images.push(...(item as any).images.filter(Boolean));

    const isExpanded = expandedId === item.id;

    const swipeRef = React.createRef<Swipeable>();

    const canApprove = (status: string) => ['PENDING', 'DESK_PENDING', 'REJECTED'].includes(status);

    const renderLeftAction = () => (
      <View style={[styles.leftAction, {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start'}]}>
        <Text style={styles.actionText}>❌ Reject</Text>
      </View>
    );

    const renderRightAction = () => (
      <View style={[styles.rightAction, {flexDirection: 'row', alignItems: 'center'}]}>
        <Text style={styles.actionText}>✅ Approve</Text>
      </View>
    );

    return (
        <Swipeable
          ref={swipeRef}
          renderLeftActions={showReject ? renderLeftAction : undefined}
          renderRightActions={showApprove ? renderRightAction : undefined}
          onSwipeableLeftOpen={() => { scheduleUpdateWithUndo(item, 'REJECTED'); }}
          onSwipeableRightOpen={() => {
            if (canApprove(statusUpper)) {
              onApprove(item);
            } else {
              // Shouldn't happen because action isn't rendered when not allowed,
              // but keep graceful fallback.
              swipeRef.current?.close();
            }
          }}
        >
          <View style={styles.card}>
        <Pressable onPress={() => { setArticleItem(item); setArticleRemark(''); setArticleModalOpen(true); }} style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingRight: 56 }}>
          {images.length ? (
            <Pressable onPress={() => { setArticleItem(item); setArticleRemark(''); setArticleModalOpen(true); }} style={styles.thumbWrap}>
              <Image source={{ uri: images[0] }} style={styles.thumb} resizeMode="cover" />
            </Pressable>
          ) : <View style={styles.thumbPlaceholder} /> }

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title || (item.content ? String(item.content).slice(0, 80) + '…' : 'Untitled')}</Text>
            <Text style={styles.meta}>{(item as any).authorName || item.author?.mobileNumber || '—'} • {formatDateTime((item as any).createdAt || (item as any).updatedAt)}</Text>
            {
              (() => {
                const s = String(item.status || '').toUpperCase();
                let label = item.status || '—';
                let color = '#111';
                let icon = '';
                if (s.includes('APPROVED')) { label = 'Approved'; color = '#10b981'; icon = '✅'; }
                else if (s === 'REJECTED') { label = 'Rejected'; color = '#ef4444'; icon = '❌'; }
                else { label = s.replace('_', ' '); color = '#6b7280'; icon = '⏳'; }
                return (
                  <View style={styles.statusRow}>
                    <Text style={[styles.statusIcon, { color }]}>{icon}</Text>
                    <Text style={[styles.status, { color, marginLeft: 8 }]}>{label}</Text>
                  </View>
                );
              })()
            }
            {/* content hidden on card per design */}
          </View>
        </Pressable>
        {/* Right-side in-card action removed: swipe-only updates per requested design */}
        </View>
      </Swipeable>
    );
  };

  // Bottom-sheet style modal for reading and updating
  const screenH = Dimensions.get('window').height;
  const ArticleModal = () => {
    if (!articleItem) return null;
    const imgs: string[] = [];
    if ((articleItem as any).primaryImageUrl) imgs.push((articleItem as any).primaryImageUrl);
    if ((articleItem as any).images && Array.isArray((articleItem as any).images)) imgs.push(...(articleItem as any).images.filter(Boolean));

    return (
      <Modal visible={articleModalOpen} transparent animationType="slide" onRequestClose={() => setArticleModalOpen(false)}>
        <View style={styles.sheetOverlay}>
          <View style={[styles.sheet, { maxHeight: screenH * 0.92 }]}> 
            <View style={styles.sheetHeader}>
              <Text numberOfLines={2} style={styles.sheetTitle}>{articleItem.title}</Text>
              <Pressable onPress={() => setArticleModalOpen(false)} style={styles.sheetClose}><Text style={{color:'#111'}}>Close</Text></Pressable>
            </View>

            {imgs.length ? (
              <FlatList
                data={imgs}
                horizontal
                pagingEnabled
                keyExtractor={(u,i) => String(u)+String(i)}
                renderItem={({item: uri}) => (
                  <View style={styles.sheetImageWrap}><Image source={{uri}} style={styles.sheetImage} resizeMode="cover" /></View>
                )}
              />
            ) : null}

            <ScrollView style={styles.sheetBody} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.sheetMeta}>{articleItem.authorName || articleItem.author?.mobileNumber}</Text>
              <Text style={styles.sheetContent}>{articleItem.content}</Text>

              <View style={{height:16}} />
              <Text style={{fontWeight:'800', marginBottom:8}}>Remark (optional)</Text>
              <TextInput value={articleRemark} onChangeText={setArticleRemark} placeholder="Add a remark" multiline style={styles.remarkInput} />
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable onPress={() => { setArticleModalOpen(false); }} style={styles.sheetBtnGhost}><Text style={styles.sheetBtnGhostTxt}>Close</Text></Pressable>
              <Pressable onPress={async () => { if (!articleItem) return; scheduleUpdateWithUndo(articleItem, 'DESK_APPROVED', articleRemark || undefined); setArticleModalOpen(false); }} style={styles.sheetBtn}><Text style={styles.sheetBtnTxt}>Approve</Text></Pressable>
              <Pressable onPress={async () => { if (!articleItem) return; scheduleUpdateWithUndo(articleItem, 'REJECTED', articleRemark || undefined); setArticleModalOpen(false); }} style={styles.sheetBtnDanger}><Text style={styles.sheetBtnDangerTxt}>Reject</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>‹</Text></Pressable>
        <Text style={styles.heading}>Short News</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterRow}>
        <FlatList
          data={STATUS_OPTIONS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(s) => s}
          renderItem={({ item: s }) => {
            const active = s === status;
            return (
              <Pressable onPress={() => { setStatus(s); setItems([]); setNextCursor(null); setLoading(true); }} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.9 }]}>
                <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{s.replace('_', ' ')}</Text>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        />
      </View>

      {loading && !items.length ? (
        <View style={{ padding: 16 }}><ActivityIndicator size="large" color={Colors.light.primary} /></View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(it) => String(it.id)}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={!loading ? <View style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: '#64748b' }}>No items</Text></View> : null}
        />
      )}

      <Modal visible={remarkModalOpen} transparent animationType="slide" onRequestClose={() => setRemarkModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Approve — Remark (optional)</Text>
            <TextInput placeholder="Enter remark" value={remarkText} onChangeText={setRemarkText} style={styles.remarkInput} multiline />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable onPress={() => setRemarkModalOpen(false)} style={styles.modalBtnGhost}><Text style={styles.modalBtnGhostTxt}>Cancel</Text></Pressable>
              <Pressable onPress={async () => {
                if (!remarkForId) return;
                setRemarkModalOpen(false);
                const item = items.find(it => it.id === remarkForId);
                if (item) scheduleUpdateWithUndo(item, 'DESK_APPROVED', remarkText || undefined);
                setRemarkForId(null);
                setRemarkText('');
              }} style={styles.modalBtn}><Text style={styles.modalBtnTxt}>Approve</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={imageModalOpen} transparent animationType="slide" onRequestClose={() => setImageModalOpen(false)}>
        <View style={styles.imageModalOverlay}>
          <View style={styles.imageModalBox}>
            <Pressable onPress={() => setImageModalOpen(false)} style={styles.imageClose}><Text style={{color:'#fff'}}>Close</Text></Pressable>
            <FlatList
              data={imageModalImages}
              horizontal
              pagingEnabled
              initialScrollIndex={imageModalIndex}
              keyExtractor={(u, i) => String(u) + String(i)}
              renderItem={({ item: uri }) => (
                <View style={styles.imageFullWrap}>
                  <Image source={{ uri }} style={styles.imageFull} resizeMode="contain" />
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
      {snackbarVisible && pendingAction ? (
        <View style={[styles.snackbar, { pointerEvents: 'box-none' }]}>
          <Text style={styles.snackbarText}>{pendingAction.newStatus === 'REJECTED' ? 'Rejected' : pendingAction.newStatus === 'DESK_APPROVED' ? 'Approved' : pendingAction.newStatus} — Action pending</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={undoPending} style={styles.snackbarBtn}><Text style={styles.snackbarBtnTxt}>Undo</Text></Pressable>
            <Pressable onPress={() => { void flushPendingAction(true); }} style={styles.snackbarBtnGhost}><Text style={styles.snackbarBtnGhostTxt}>Commit</Text></Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  backBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22 },
  heading: { fontWeight: '900', color: '#111' },
  filterRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', marginHorizontal: 6 },
  chipActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  chipTxt: { color: '#111', fontWeight: '700' },
  chipTxtActive: { color: '#fff' },
  card: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 12, padding: 12 },
  title: { fontWeight: '800', color: '#0f172a' },
  meta: { color: '#6b7280', fontSize: 12, marginTop: 6 },
  status: { marginTop: 6, fontSize: 12, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  statusIcon: { fontSize: 14 },
  actions: { width: 120, alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800' },
  btnGhost: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', marginTop: 8 },
  btnGhostTxt: { color: '#0f172a', fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '92%', backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#eef2f7' },
  modalTitle: { fontWeight: '900', marginBottom: 8 },
  remarkInput: { minHeight: 80, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, textAlignVertical: 'top' },
  modalBtn: { flex: 1, backgroundColor: Colors.light.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalBtnTxt: { color: '#fff', fontWeight: '900' },
  modalBtnGhost: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  modalBtnGhostTxt: { color: '#0f172a', fontWeight: '900' },
  thumbWrap: { width: 88, height: 88, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f8fafc' },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: { width: 88, height: 88, borderRadius: 8, backgroundColor: '#f1f5f9' },
  content: { marginTop: 8, color: '#334155', lineHeight: 20 },
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  imageModalBox: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  imageFullWrap: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  imageFull: { width: '100%', height: '100%' },
  imageClose: { position: 'absolute', top: 36, right: 16, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 8 },
  actionsRight: { position: 'absolute', right: 12, top: 12, bottom: 12, justifyContent: 'center' },
  verticalActions: { alignItems: 'center', gap: 8 },
  actionsLeft: { position: 'absolute', left: 12, top: 12, bottom: 12, justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  iconBtnTxt: { color: '#fff', fontWeight: '900' },
  iconBtnGhost: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  iconBtnGhostTxt: { color: '#0f172a', fontWeight: '900' },
  leftAction: { backgroundColor: '#ef4444', justifyContent: 'center', flex: 1, borderRadius: 12, paddingHorizontal: 20 },
  rightAction: { backgroundColor: '#10b981', justifyContent: 'center', flex: 1, borderRadius: 12, paddingHorizontal: 20 },
  actionText: { color: '#fff', fontWeight: '900', padding: 16 },
  // bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  sheetTitle: { fontWeight: '900', fontSize: 16, flex: 1, marginRight: 12 },
  sheetClose: { padding: 8 },
  sheetImageWrap: { width: Dimensions.get('window').width, height: 220, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  sheetImage: { width: '100%', height: '100%' },
  sheetBody: { paddingHorizontal: 16, paddingTop: 12, maxHeight: 320 },
  sheetMeta: { color: '#6b7280', marginBottom: 8 },
  sheetContent: { color: '#0f172a', lineHeight: 20 },
  sheetFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderTopWidth: 1, borderTopColor: '#eef2f7' },
  sheetBtn: { flex: 1, backgroundColor: Colors.light.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  sheetBtnTxt: { color: '#fff', fontWeight: '900' },
  sheetBtnDanger: { flex: 1, backgroundColor: '#ef4444', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  sheetBtnDangerTxt: { color: '#fff', fontWeight: '900' },
  sheetBtnGhost: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  sheetBtnGhostTxt: { color: '#0f172a', fontWeight: '700' },
  snackbar: { position: 'absolute', left: 12, right: 12, bottom: 20, backgroundColor: '#0f172a', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 60 },
  snackbarText: { color: '#fff', fontWeight: '700', marginRight: 12 },
  snackbarBtn: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 8 },
  snackbarBtnTxt: { color: '#0f172a', fontWeight: '800' },
  snackbarBtnGhost: { borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 8 },
  snackbarBtnGhostTxt: { color: '#fff', fontWeight: '700' },
});
