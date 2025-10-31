import { Colors } from '@/constants/Colors';
import { getDonationEvents, getDonationLinkById, getDonationReceiptUrl, getMemberDonationLinks, notifyDonationLink } from '@/services/hrciDonations';
import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATUS = ['PENDING','SUCCESS','FAILED','REFUND'] as const;

function formatAmount(n?: number) { return typeof n === 'number' ? `₹${n.toLocaleString('en-IN')}` : '₹0'; }
function formatAmountCompact(n?: number) {
  const num = typeof n === 'number' ? n : 0;
  const abs = Math.abs(num);
  let v = num; let s = '';
  if (abs >= 1e7) { v = num / 1e7; s = 'Cr'; }
  else if (abs >= 1e5) { v = num / 1e5; s = 'L'; }
  else if (abs >= 1e3) { v = num / 1e3; s = 'K'; }
  const fixed = Math.abs(v) < 10 && s ? v.toFixed(1) : Math.round(v).toString();
  return `₹${fixed}${s}`;
}
function toStartOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function toEndOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function iso(d: Date) { return d.toISOString(); }

export default function HrciDonationsListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [to, setTo] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string>(''); // default to ALL
  const [query, setQuery] = useState('');
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [events, setEvents] = useState<any[]>([]);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  // filters moved into app bar with native date pickers
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  // create donation moved to full page
  // details bottom sheet
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<any | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true); 
    }
    setError(null);
    try {
      const res = await getMemberDonationLinks({ from, to, status, eventId, limit, offset: 0 });
      setItems(res.data || []);
      setTotals(res.totals || {});
      const total = (res.total ?? res.count ?? (res.data?.length || 0)) as number;
      setHasNext((res.data?.length || 0) < total);
      setOffset(res.data?.length || 0);
      setLastRefresh(new Date()); // Track when data was last refreshed
    } catch (e:any) {
      setError(e?.message || 'Failed to load donations');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [from, to, status, eventId, limit]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasNext) return;
    setLoadingMore(true);
    try {
      const res = await getMemberDonationLinks({ from, to, status, eventId, limit, offset });
      const next = Array.isArray(res.data) ? res.data : [];
      setItems(prev => [...prev, ...next]);
      const total = (res.total ?? res.count ?? (offset + next.length)) as number;
      setOffset(offset + next.length);
      setHasNext(offset + next.length < total);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, loading, hasNext, from, to, status, eventId, limit, offset]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const loadEvents = useCallback(async () => {
    try {
      const list = await getDonationEvents(20);
      setEvents(list);
      // Do not auto-select an event; keep undefined to show all by default
    } catch {}
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { load(); }, [load]);

  // Quick lookup for event titles
  const eventTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of events) {
      if (e?.id) map[e.id] = e.title;
    }
    return map;
  }, [events]);

  // Auto-refresh every 30 seconds when page is focused
  useFocusEffect(
    useCallback(() => {
      console.log('📱 Donations page focused - setting up auto-refresh');
      
      // Initial refresh
      if (items.length > 0) {
        load(true); // Silent refresh if we have data
      } else {
        load(); // Show spinner if no data
      }
      
      // Set up periodic refresh every 30 seconds
      const interval = setInterval(() => {
        console.log('⏰ Auto-refreshing donations (30s interval)');
        load(true); // Always silent for periodic updates
      }, 30000); // 30 seconds
      
      // Cleanup interval when page loses focus
      return () => {
        console.log('📱 Donations page unfocused - clearing auto-refresh');
        clearInterval(interval);
      };
    }, [load, items.length])
  );

  const byStatus = useMemo(() => totals?.byStatus || {}, [totals]);
  // derived totals simplified for UI
  const fromShort = useMemo(() => from ? new Date(from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Start', [from]);
  const toShort = useMemo(() => to ? new Date(to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'End', [to]);

  const statusStyle = (s?: string) => {
    const k = String(s || '').toUpperCase();
    switch (k) {
      case 'SUCCESS': return styles.st_SUCCESS;
      case 'PENDING': return styles.st_PENDING;
      case 'FAILED': return styles.st_FAILED;
      case 'REFUND': return styles.st_REFUND;
      default: return styles.st_PENDING;
    }
  };

  // simplified UI removed open/copy/share actions

  const notifyLink = useCallback(async (item: any) => {
    try {
      const linkId = item?.providerOrderId; 
      if (!linkId) return;
      setNotifyingId(String(linkId));
      await notifyDonationLink(String(linkId), 'sms');
    } catch {}
    finally { setNotifyingId(null); }
  }, []);

  const copyLink = useCallback(async (item: any) => {
    try {
      const linkId = item?.providerOrderId || item?.provider_order_id || item?.id;
      if (!linkId) return;
      setCopyingId(String(linkId));
      let url: string | undefined = item?.shortUrl || item?.short_url;
      if (!url) {
        try {
          const details = await getDonationLinkById(String(linkId));
          url = details?.short_url || details?.shortUrl;
        } catch {}
      }
      if (url) {
        await Clipboard.setStringAsync(url);
        Alert.alert('Copied', 'Payment link copied to clipboard');
      } else {
        Alert.alert('Link not available', 'Could not find the payment link for this item');
      }
    } finally {
      setCopyingId(null);
    }
  }, []);

  const downloadReceipt = useCallback(async (item: any) => {
    try {
      const donationId = item?.id;
      if (!donationId) {
        console.log('Download receipt: No donation ID found');
        return;
      }
      
      setDownloadingId(String(donationId));
      
      // Use receiptPdfUrl if available, otherwise call API
      let url = item?.receiptPdfUrl;
      if (!url) {
        console.log(`Fetching receipt URL for donation: ${donationId}`);
        try {
          url = await getDonationReceiptUrl(String(donationId));
          console.log(`Receipt API response URL: ${url}`);
          
          // If API call successful, refresh the list to get updated receiptPdfUrl
          if (url) {
            console.log('✅ API call successful, refreshing list to get updated receiptPdfUrl');
            // Refresh the list in background to get updated data
            load(true).catch(() => {}); // Don't await, do it in background
          }
          
        } catch (apiError: any) {
          // Check if it's a known server configuration issue
          const errorMsg = apiError?.message || '';
          const isKnownServerIssue = errorMsg.includes('Chrome') || 
                                    errorMsg.includes('puppeteer') || 
                                    errorMsg.includes('Puppeteer') ||
                                    errorMsg.includes('browser') ||
                                    errorMsg.includes('render') ||
                                    errorMsg.includes('cache');
          
          // Only log unexpected errors to console
          if (!isKnownServerIssue) {
            console.error('Receipt API error:', apiError);
          } else {
            console.log('Receipt service temporarily unavailable (server configuration)');
          }
          
          // Check if it's the Chrome/Puppeteer server issue
          if (errorMsg.includes('Chrome') || errorMsg.includes('puppeteer') || errorMsg.includes('Puppeteer')) {
            console.log('🚨 Showing Chrome error alert for donation:', donationId);
            Alert.alert(
              'Receipt Unavailable',
              `Receipt service is temporarily unavailable due to server configuration.\n\nYour donation (ID: ${donationId}) is confirmed and valid.\n\nPlease contact support for your receipt, or try again later.`,
              [{ 
                text: 'OK',
                onPress: () => console.log('✅ User dismissed Chrome error alert')
              }]
            );
            return;
          }
          
          // Check for other server configuration issues
          if (errorMsg.includes('browser') || errorMsg.includes('render') || errorMsg.includes('cache')) {
            Alert.alert(
              'Service Temporarily Unavailable',
              'Receipt generation service is currently being configured. Your donation is confirmed and valid.\n\nPlease try again in a few minutes or contact support.',
              [{ text: 'OK' }]
            );
            return;
          }
          
          // If API fails, check if the item has any receipt-related fields
          if (item?.receiptNumber || item?.receiptId) {
            Alert.alert(
              'Receipt Unavailable',
              'Receipt generation is currently unavailable, but your donation is confirmed. Please contact support with your donation ID for assistance.',
              [{ text: 'OK' }]
            );
            return;
          }
          throw apiError; // Re-throw to handle in outer catch
        }
      } else {
        console.log(`Using direct receipt URL: ${url}`);
      }
      
      if (url) {
        try {
          console.log(`Opening receipt PDF: ${url}`);
          
          // Extract filename for user reference
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split('/');
          const filename = pathParts[pathParts.length - 1] || `Receipt_${donationId}.pdf`;
          
          // Open the PDF URL - this will download it in most browsers
          await Linking.openURL(url);
          
          // Show success message
          Alert.alert(
            'Receipt Opening',
            `Receipt is opening in your browser.\n\nFile: ${filename}\n\nThe PDF will be downloaded automatically in most browsers.`,
            [{ text: 'OK' }]
          );
          
        } catch (linkError: any) {
          console.error('Failed to open receipt URL:', linkError);
          Alert.alert(
            'Download Failed',
            'Failed to open receipt. Please check your internet connection and try again.',
            [{ text: 'OK' }]
          );
        }
      } else {
        console.log('No receipt URL available');
        Alert.alert(
          'Receipt Not Ready',
          'Receipt is not available yet. Please try again in a few minutes.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Download receipt error:', error);
      // Check if it's a server-side PDF generation error
      const errorMessage = error?.message || '';
      
      let alertTitle = 'Download Failed';
      let alertMessage = 'Failed to download receipt. Please check your connection and try again.';
      
      if (errorMessage.includes('Chrome') || errorMessage.includes('puppeteer') || errorMessage.includes('Puppeteer')) {
        alertTitle = 'Service Unavailable';
        alertMessage = 'Receipt generation is temporarily unavailable due to server configuration. Please contact support or try again later.';
      } else if (errorMessage.includes('browser') || errorMessage.includes('render')) {
        alertTitle = 'Service Issue';
        alertMessage = 'Server is temporarily unable to generate receipts. Please try again in a few minutes or contact support.';
      } else if (error?.status === 500) {
        alertTitle = 'Server Error';
        alertMessage = 'Server error while generating receipt. Please try again later.';
      } else if (error?.status === 404) {
        alertTitle = 'Receipt Not Found';
        alertMessage = 'Receipt not found. This donation may not be eligible for a receipt yet.';
      } else if (error?.status === 429) {
        alertTitle = 'Too Many Requests';
        alertMessage = 'Too many requests. Please wait a moment and try again.';
      }
      
      Alert.alert(alertTitle, alertMessage, [{ text: 'OK' }]);
    }
    finally { setDownloadingId(null); }
  }, [load]);

  const openDetails = useCallback(async (item: any) => {
    const linkId = item?.providerOrderId;
    if (!linkId) return;
    setDetailsOpen(true);
    setDetails(null);
    setDetailsLoading(true);
    try {
      const d = await getDonationLinkById(String(linkId));
      setDetails(d);
    } catch {}
    finally {
      setDetailsLoading(false);
    }
  }, []);
  const renderItem = ({ item }: { item: any }) => {
    const st = String(item?.status || '').toUpperCase();
    const isPending = st === 'PENDING';
    const isSuccess = st === 'SUCCESS';
  const isAnonymous = item?.isAnonymous === true;
    const canNotify = isPending && !!item?.providerOrderId;
    // Show receipt button for all SUCCESS donations
    const canReceipt = isSuccess;
  const evTitle = item?.eventId ? eventTitleById[item.eventId] : undefined;
    
    return (
      <Pressable onPress={() => openDetails(item)} style={styles.card}>
        <View style={[styles.accent, statusStyle(item.status)]} />
        <View style={{ flex: 1 }}>
          <View style={styles.cardHeader}>
            <Text style={styles.title}>{isAnonymous ? 'Anonymous Donor' : (item?.donorName || 'Donor')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.stBadgeWrap, statusStyle(item.status)]}>
                <MaterialCommunityIcons
                  name={isSuccess ? 'check-circle-outline' : isPending ? 'clock-outline' : (st === 'FAILED' ? 'close-circle-outline' : 'information-outline')}
                  size={14}
                  color="#111"
                />
                <Text style={styles.stBadgeTxt}>{item.status}</Text>
              </View>
              <Text style={styles.amountLg}>{formatAmount(item.amount)}</Text>
            </View>
          </View>
          <Text style={styles.metaSmall}>Created {new Date(item?.createdAt).toLocaleString()}</Text>
          {evTitle ? (
            <View style={styles.inlineChips}>
              <View style={styles.eventChip}>
                <MaterialCommunityIcons name="calendar-star" size={12} color="#6b7280" />
                <Text style={styles.infoChipTxt}>{evTitle}</Text>
              </View>
            </View>
          ) : null}
          
          {/* Show donor info only if not anonymous */}
          {!isAnonymous && (
            <>
              <View style={styles.inlineChips}>
                {item?.donorMobile ? (
                  <View style={styles.infoChip}><MaterialCommunityIcons name="phone" size={12} color="#6b7280" /><Text style={styles.infoChipTxt}>{item.donorMobile}</Text></View>
                ) : null}
                {item?.donorEmail ? (
                  <View style={styles.infoChip}><MaterialCommunityIcons name="email" size={12} color="#6b7280" /><Text style={styles.infoChipTxt}>{item.donorEmail}</Text></View>
                ) : null}
                {item?.donorPan ? (
                  <View style={styles.infoChip}><MaterialCommunityIcons name="card-account-details-outline" size={12} color="#6b7280" /><Text style={styles.infoChipTxt}>{item.donorPan}</Text></View>
                ) : null}
              </View>
              {item?.donorAddress ? (
                <Text numberOfLines={2} style={styles.addressTxt}>{item.donorAddress}</Text>
              ) : null}
            </>
          )}
          
          {/* Show shortUrl for pending donations */}
          {isPending && item?.shortUrl ? (
            <View style={styles.inlineChips}>
              <View style={styles.infoChip}>
                <MaterialCommunityIcons name="link-variant" size={12} color="#6b7280" />
                <Text style={styles.infoChipTxt}>Payment Link</Text>
              </View>
            </View>
          ) : null}
          
          {(canNotify || canReceipt) ? (
            <View style={styles.rowActions}>
              {isPending ? (
                <Pressable
                  onPress={() => copyLink(item)}
                  disabled={copyingId === (item?.providerOrderId || item?.id)}
                  style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.9 }]}
                >
                  <MaterialCommunityIcons name="content-copy" size={16} color="#111" />
                  <Text style={styles.actionTxt}>{copyingId === (item?.providerOrderId || item?.id) ? 'Copying…' : 'Copy Link'}</Text>
                </Pressable>
              ) : null}
              {canNotify ? (
                <Pressable
                  onPress={() => notifyLink(item)}
                  disabled={notifyingId === item?.providerOrderId}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    pressed && { opacity: 0.9 }
                  ]}
                >
                  <MaterialCommunityIcons name="bell-ring-outline" size={16} color="#111" />
                  <Text style={styles.actionTxt}>{notifyingId === item?.providerOrderId ? 'Notifying…' : 'Notify'}</Text>
                </Pressable>
              ) : null}
              {canReceipt ? (
                <Pressable
                  onPress={() => downloadReceipt(item)}
                  disabled={downloadingId === String(item?.id)}
                  style={({ pressed }) => [styles.actionBtnPrimary, pressed && { opacity: 0.9 }]}
                >
                  <MaterialCommunityIcons name="file-download-outline" size={16} color="#fff" />
                  <Text style={styles.actionTxtPrimary}>{downloadingId === String(item?.id) ? 'Downloading…' : '80G Receipt'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <SafeAreaView>
        <View style={styles.appBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#111" />
          </Pressable>
          <View style={[styles.searchBox, { flex: 1 }]}>
            <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search by name, mobile, address, link or id" placeholderTextColor="#9CA3AF" style={styles.searchInput} />
          </View>
          {/* Open Stories list */}
          <Pressable style={styles.iconBtn} onPress={() => router.push('/hrci/donations/stories' as any)}>
            <MaterialCommunityIcons name="image-multiple" size={18} color="#111" />
          </Pressable>
          <Pressable 
            style={[styles.iconBtn, refreshing && { opacity: 0.5 }]} 
            onPress={() => !refreshing && onRefresh()}
            disabled={refreshing}
          >
            <MaterialCommunityIcons 
              name={refreshing ? "loading" : "refresh"} 
              size={18} 
              color="#111" 
            />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => setEventPickerOpen(true)}>
            <MaterialCommunityIcons name="calendar" size={18} color="#111" />
          </Pressable>
        </View>
      </SafeAreaView>
      {/* Filters and Totals moved into list header so all below app bar scrolls */}

      {error ? (
        <View style={styles.center}> 
          <Text style={styles.errorTxt}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retry}><Text style={styles.retryTxt}>Retry</Text></Pressable>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <LottieView source={require('@/assets/lotti/hrci_loader_svg.json')} autoPlay loop style={{ width: 90, height: 90 }} />
        </View>
      ) : (
        <FlatList
          data={items.filter(x => {
            if (!query) return true;
            const q = query.toLowerCase();
            const name = String(x.donorName||'').toLowerCase();
            const mobile = String(x.donorMobile||'').toLowerCase();
            const address = String(x.donorAddress||'').toLowerCase();
            return (
              String(x.id).toLowerCase().includes(q) ||
              String(x.providerOrderId||'').toLowerCase().includes(q) ||
              name.includes(q) || mobile.includes(q) || address.includes(q)
            );
          })}
          keyExtractor={it => `${it.id}`}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onEndReachedThreshold={0.35}
          onEndReached={loadMore}
          ListHeaderComponent={(
            <View>
              <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <Pressable
                    style={[styles.chip, !status && styles.chipActive]}
                    onPress={() => { setStatus(''); if (from) setFrom(undefined); if (to) setTo(undefined); }}
                  >
                    <Text style={[styles.chipTxt, !status && styles.chipTxtActive]}>All</Text>
                    <Text style={[styles.chipAmt, !status && styles.chipAmtActive]}>{formatAmountCompact((totals as any)?.overall?.amount)}</Text>
                  </Pressable>
                  {STATUS.map(s => {
                    const amt = (byStatus as any)?.[s]?.amount;
                    const active = status === s;
                    return (
                      <Pressable key={s} style={[styles.chip, active && styles.chipActive]} onPress={() => setStatus(s)}>
                        <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{s}</Text>
                        <Text style={[styles.chipAmt, active && styles.chipAmtActive]}>{formatAmountCompact(amt)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={[styles.dateRange, { marginTop: 10, marginBottom: 12 }]}> 
                  <Pressable onPress={() => setShowFromPicker(true)} style={styles.dateSeg}>
                    <Text style={styles.dateLabel}>From</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialCommunityIcons name="calendar" size={16} color="#111" />
                      <Text style={styles.dateValue}>{from ? fromShort : 'Any'}</Text>
                    </View>
                  </Pressable>
                  <View style={styles.dateDivider} />
                  <Pressable onPress={() => setShowToPicker(true)} style={styles.dateSeg}>
                    <Text style={styles.dateLabel}>To</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialCommunityIcons name="calendar" size={16} color="#111" />
                      <Text style={styles.dateValue}>{to ? toShort : 'Any'}</Text>
                    </View>
                  </Pressable>
                  {(from || to) ? (
                    <Pressable onPress={() => { setFrom(undefined); setTo(undefined); load(); }} style={styles.clearDateBtn}>
                      <MaterialCommunityIcons name="close" size={14} color="#6b7280" />
                    </Pressable>
                  ) : null}
                </View>
                {eventId ? (
                  <Text style={styles.eventHint}>Event: {events.find(e => e.id === eventId)?.title}</Text>
                ) : null}
              </View>
              <View style={styles.summaryRow}> 
                <View style={styles.kpi}>
                  <View style={styles.kpiRow}><MaterialCommunityIcons name="cash" size={16} color="#6b7280" /><Text style={styles.kpiLbl}>Total</Text></View>
                  <Text style={styles.kpiVal}>{formatAmount((totals as any)?.overall?.amount)}</Text>
                </View>
                <View style={styles.kpi}>
                  <View style={styles.kpiRow}><MaterialCommunityIcons name="timer-sand" size={16} color="#6b7280" /><Text style={styles.kpiLbl}>Pending</Text></View>
                  <Text style={styles.kpiVal}>{formatAmount((totals as any)?.byStatus?.PENDING?.amount)}</Text>
                </View>
              </View>
              {lastRefresh && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                  <Text style={styles.lastRefreshHint}>
                    Last updated: {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              )}
            </View>
          )}
          ListFooterComponent={loadingMore ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <LottieView source={require('@/assets/lotti/hrci_loader_svg.json')} autoPlay loop style={{ width: 60, height: 60 }} />
            </View>
          ) : null}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="heart-plus-outline" size={42} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No donations yet</Text>
              <Text style={styles.emptySub}>Create a payment link and share it with a donor to get started.</Text>
              <Pressable style={styles.emptyCta} onPress={() => router.push('/hrci/donations/create')}>
                <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                <Text style={styles.emptyCtaTxt}>Create link</Text>
              </Pressable>
            </View>
          }
        />
      )}

      {/* FAB navigates to full create page */}
      <Pressable style={styles.fab} onPress={() => router.push('/hrci/donations/create')}>
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
      </Pressable>

      {eventPickerOpen && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontWeight: '800', color: '#111' }}>Select Event</Text>
              <Pressable onPress={() => setEventPickerOpen(false)} style={{ padding: 6 }}><MaterialCommunityIcons name="close" size={18} color="#111" /></Pressable>
            </View>
            <FlatList
              data={events}
              keyExtractor={(e:any) => e.id}
              renderItem={({ item }) => (
                <Pressable onPress={() => { setEventId(item.id); setEventPickerOpen(false); }} style={styles.eventRow}>
                  <Text style={{ color: '#111', fontWeight: item.id===eventId ? '800' : '600' }}>{item.title}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={{ color: '#6b7280' }}>No events</Text>}
            />
          </View>
        </View>
      )}

      {/* Details Bottom Sheet */}
      {detailsOpen && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontWeight: '800', color: '#111' }}>Donation Link Details</Text>
              <Pressable onPress={() => setDetailsOpen(false)} style={{ padding: 6 }}><MaterialCommunityIcons name="close" size={18} color="#111" /></Pressable>
            </View>
            {detailsLoading ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <LottieView source={require('@/assets/lotti/hrci_loader_svg.json')} autoPlay loop style={{ width: 80, height: 80 }} />
              </View>
            ) : details ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.meta}><Text style={styles.metaKey}>Link Id: </Text>{details.id}</Text>
                {details.short_url ? <Text style={styles.meta}><Text style={styles.metaKey}>Short URL: </Text>{details.short_url}</Text> : null}
                <Text style={styles.meta}><Text style={styles.metaKey}>Status: </Text>{details.status}</Text>
                <Text style={styles.meta}><Text style={styles.metaKey}>Amount: </Text>₹{Number((details.amount != null ? details.amount/100 : 0)).toLocaleString('en-IN')}</Text>
                {details.amount_paid != null ? <Text style={styles.meta}><Text style={styles.metaKey}>Paid: </Text>₹{Number((details.amount_paid != null ? details.amount_paid/100 : 0)).toLocaleString('en-IN')}</Text> : null}
                {details.currency ? <Text style={styles.meta}><Text style={styles.metaKey}>Currency: </Text>{details.currency}</Text> : null}
                {details.description ? <Text style={styles.meta}><Text style={styles.metaKey}>Description: </Text>{details.description}</Text> : null}
                {details.customer ? (
                  <View>
                    <Text style={[styles.meta, { marginTop: 4 }]}><Text style={styles.metaKey}>Customer</Text></Text>
                    {details.customer.name ? <Text style={styles.meta}>• {details.customer.name}</Text> : null}
                    {details.customer.contact ? <Text style={styles.meta}>• {details.customer.contact}</Text> : null}
                  </View>
                ) : null}
                {details.notes ? (
                  <View>
                    <Text style={[styles.meta, { marginTop: 4 }]}><Text style={styles.metaKey}>Notes</Text></Text>
                    {details.notes.donationId ? <Text style={styles.meta}>• Donation: {details.notes.donationId}</Text> : null}
                    {details.notes.eventId ? <Text style={styles.meta}>• Event: {details.notes.eventId}</Text> : null}
                  </View>
                ) : null}
                {details.short_url ? (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                    <Pressable onPress={() => { try { Linking.openURL(details.short_url); } catch {} }} style={[styles.actionBtn]}>
                      <MaterialCommunityIcons name="link-variant" size={16} color="#111" />
                      <Text style={styles.actionTxt}>Open Link</Text>
                    </Pressable>
                    <Pressable onPress={async () => { try { await Share.share({ message: details.short_url, url: details.short_url, title: 'Donation Link' }); } catch {} }} style={[styles.actionBtn]}>
                      <MaterialCommunityIcons name="share-variant" size={16} color="#111" />
                      <Text style={styles.actionTxt}>Share</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : (
              <Text style={styles.meta}>No details</Text>
            )}
          </View>
        </View>
      )}

      {/* Native Date Pickers */}
      {showFromPicker && (
        <DateTimePicker
          value={from ? new Date(from) : new Date()}
          mode="date"
          display="default"
          onChange={(e: any, d?: Date) => { setShowFromPicker(false); if (d) { setFrom(iso(toStartOfDay(d))); load(); } }}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={to ? new Date(to) : new Date()}
          mode="date"
          display="default"
          onChange={(e: any, d?: Date) => { setShowToPicker(false); if (d) { setTo(iso(toEndOfDay(d))); load(); } }}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  appBar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, backgroundColor: '#fff' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backTxt: { fontSize: 22, color: '#111' },
  appTitle: { color: '#111', fontWeight: '800' },
  appBarTools: { display: 'none' },
  toolbar: { padding: 16, gap: 12 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 0, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#f3f4f6', height: 44 },
  searchPill: { display: 'none' },
  searchInput: { color: '#111', flex: 1, fontSize: 15, paddingVertical: 0 },
  selectorBtn: { display: 'none' },
  selectorPill: { display: 'none' },
  selectorTxt: { display: 'none' },
  presetChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#f3f4f6' },
  presetTxt: { color: '#111', fontWeight: '700' },
  inlineDates: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  dateTxt: { color: '#111', fontWeight: '700' },
  dateRange: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', paddingHorizontal: 8, height: 44 },
  dateSeg: { flex: 1, paddingHorizontal: 8, paddingVertical: 6 },
  dateLabel: { color: '#6b7280', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  dateValue: { color: '#111', fontSize: 13, fontWeight: '800' },
  dateDivider: { width: 1, height: 28, backgroundColor: '#e5e7eb', marginHorizontal: 4 },
  clearDateBtn: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2f7', marginLeft: 6 },
  dateInput: { minWidth: 120, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#111' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#FE0002', borderColor: '#FE0002' },
  chipTxt: { color: '#6b7280', fontWeight: '700' },
  chipTxtActive: { color: '#fff' },
  chipAmt: { color: '#9CA3AF', fontWeight: '800', marginLeft: 6, fontSize: 11 },
  chipAmtActive: { color: '#fff' },
  summaryRow: { paddingHorizontal: 16, flexDirection: 'row', gap: 8, marginBottom: 6 },
  kpi: { flex: 1, backgroundColor: '#f9fafb', borderWidth: 0, borderColor: 'transparent', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, alignItems: 'flex-start' },
  kpiRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiLbl: { color: '#6b7280', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  kpiVal: { color: '#111', fontSize: 18, fontWeight: '900', marginTop: 2 },
  eventHint: { color: '#6b7280', fontSize: 12, marginTop: -6, marginBottom: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorTxt: { color: '#b91c1c' },
  retry: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginTop: 8 },
  retryTxt: { color: '#111', fontWeight: '700' },
  card: { borderWidth: 1, borderColor: '#f4f5f7', backgroundColor: '#fff', padding: 14, borderRadius: 14, marginBottom: 12, flexDirection: 'row', gap: 12, ...makeShadow(4, { opacity: 0.06, blur: 12, y: 4 }) },
  accent: { width: 4, borderRadius: 999, backgroundColor: '#f3f4f6' },
  amount: { color: '#111', fontSize: 16, fontWeight: '800' },
  amountLg: { color: '#111', fontSize: 18, fontWeight: '900' },
  title: { color: '#111', fontSize: 16, fontWeight: '800', flexShrink: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inlineChips: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  infoChipTxt: { color: '#4b5563', fontWeight: '700', fontSize: 12 },
  addressTxt: { color: '#6b7280', fontSize: 12, marginTop: 8 },
  meta: { color: '#4b5563', fontSize: 12 },
  metaKey: { color: '#6b7280', fontWeight: '700' },
  metaSmall: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  stBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '800', color: '#111' },
  stBadgeSmall: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', fontSize: 11, fontWeight: '800', color: '#111' },
  stBadgeWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  stBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#111' },
  st_SUCCESS: { backgroundColor: '#DCFCE7' },
  st_PENDING: { backgroundColor: '#FEF9C3' },
  st_FAILED: { backgroundColor: '#FEE2E2' },
  st_REFUND: { backgroundColor: '#E0E7FF' },
  rowActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eef0f4', backgroundColor: '#fff' },
  actionBtnPrimary: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: Colors.light.primary },
  btnDisabled: { opacity: 0.6 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#eef0f4', backgroundColor: '#fff' },
  actionTxt: { color: '#111', fontWeight: '700', fontSize: 12 },
  actionTxtPrimary: { color: '#fff', fontWeight: '800', fontSize: 12 },
  empty: { color: '#6b7280', textAlign: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { color: '#111', fontWeight: '900', fontSize: 16, marginTop: 2 },
  emptySub: { color: '#6b7280', fontSize: 12, textAlign: 'center', paddingHorizontal: 24 },
  emptyCta: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.light.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  emptyCtaTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  eventChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eef2f7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  modalBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', width: '100%', maxHeight: '60%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, ...makeShadow(8, { opacity: 0.1, blur: 20, y: -4 }) },
  eventRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  notifyBtn: { display: 'none' },
  notifyBtnDisabled: { display: 'none' },
  notifyTxt: { display: 'none' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.light.primary, ...makeShadow(6, { opacity: 0.08, blur: 16, y: 4 }) },
  selChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  selChipActive: { backgroundColor: '#FE0002', borderColor: '#FE0002' },
  selChipTxt: { color: '#6b7280', fontWeight: '700' },
  selChipTxtActive: { color: '#fff' },
  inputRow: { gap: 6 },
  inputLbl: { color: '#6b7280', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#111' },
  lastRefreshHint: { color: '#9CA3AF', fontSize: 10, textAlign: 'center', fontWeight: '600' },
});
