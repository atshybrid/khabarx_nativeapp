import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';


type StatusType = '' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DESK_APPROVED' | 'AI_APPROVED' | 'DESK_PENDING';
type ChipType = { label: string; value: StatusType };
type ArticleType = {
  id: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  mediaUrls?: string[];
  status: StatusType;
  authorName?: string;
};

const STATUS_CHIPS: ChipType[] = [
  { label: 'All', value: '' },
  { label: 'Desk Pending', value: 'DESK_PENDING' },
  { label: 'Desk Approved', value: 'DESK_APPROVED' },
  { label: 'AI Approved', value: 'AI_APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];


interface Props {
  visible: boolean;
  onClose: () => void;
  token: string;
}


function CitizenReporterArticles({ visible, onClose, token }: Props) {
  const [status, setStatus] = useState<StatusType>('');
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<ArticleType[]>([]);
  const [allArticles, setAllArticles] = useState<ArticleType[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const baseurl = 'https://ai-kaburlu-backend.onrender.com/api/v1';
      const url = `${baseurl}/shortnews`;
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      setAllArticles(json.data || []);
      setArticles(json.data || []);
      setHasMore(!!json.pageInfo?.hasMore);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (visible) {
      setArticles([]);
      setAllArticles([]);
      setLoading(true);
      fetchArticles();
    }
  }, [visible, fetchArticles]);

  const getChipStyle = (chip: ChipType) => {
    if (chip.value === '') return status === '' ? styles.chipActiveAll : styles.chip;
    if (!status || status !== chip.value) return styles.chip;
    switch (chip.value) {
      case 'PENDING': return styles.chipActivePending;
      case 'DESK_PENDING': return styles.chipActiveDeskPending;
      case 'APPROVED': return styles.chipActiveApproved;
      case 'DESK_APPROVED': return styles.chipActiveDeskApproved;
      case 'AI_APPROVED': return styles.chipActiveAIApproved;
      case 'REJECTED': return styles.chipActiveRejected;
      default: return styles.chipActiveAll;
    }
  };
  const getChipTextStyle = (chip: ChipType) => (status === chip.value ? styles.chipTextActive : styles.chipText);

  const handleChipPress = (chip: ChipType) => {
    setStatus(chip.value);
    if (chip.value === '') {
      setArticles(allArticles);
    } else {
      setArticles(allArticles.filter(a => a.status === chip.value));
    }
  };

  const renderChip = (chip: ChipType, idx: number) => (
    <TouchableOpacity
      key={chip.value}
      style={[styles.chip, getChipStyle(chip)]}
      onPress={() => handleChipPress(chip)}
    >
      <Text style={getChipTextStyle(chip)}>{chip.label}</Text>
    </TouchableOpacity>
  );

  // Removed invalid renderItem function. Only use the correct version below.
  const renderItem: ListRenderItem<ArticleType> = ({ item, index }) => {
    return (
      <View style={styles.card}>
        {item.mediaUrls?.length ? (
          <Image source={{ uri: item.mediaUrls[0] }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}><Feather name="image" size={32} color="#ccc" /></View>
        )}
        <View style={styles.cardContent}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.summary} numberOfLines={2}>{item.content || item.summary}</Text>
          <View style={styles.chipRow}>
            <View style={[styles.statusChip, (styles as any)[`status${item.status}`]]}>
              <Text style={styles.statusChipText}>{item.status}</Text>
            </View>
            <Text style={styles.author}>{item.authorName}</Text>
          </View>
        </View>
      </View>
    );
  };

  const closeBtnRef = useRef(null);
  // Removed Copilot onboarding logic

  if (!visible) return null;
  return (
    <View style={styles.sheetBackdrop}>
      <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Citizen Reporter Articles</Text>
          <TouchableOpacity onPress={onClose} ref={closeBtnRef}>
            <Feather name="x" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.chipBarScroll}>
          <FlatList
            data={STATUS_CHIPS}
            renderItem={({ item, index }) => renderChip(item, index)}
            keyExtractor={item => item.value}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
          />
        </View>
        {loading && !articles.length ? (
          <ActivityIndicator size="large" color="#DB4437" style={{ marginTop: 32 }} />
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              data={articles}
              renderItem={renderItem}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              contentContainerStyle={{ paddingBottom: 24 }}
              onEndReached={() => hasMore && fetchArticles()}
              onEndReachedThreshold={0.5}
            />
          </View>
        )}
      </View>
    </View>
  );
}


export default function CitizenReporterArticlesSheet(props: Props) {
  return <CitizenReporterArticles {...props} />;
}

const styles = StyleSheet.create({
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, height: '80%', zIndex: 2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  chipBarScroll: { marginBottom: 12 },
  chip: { backgroundColor: '#f3f4f6', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
  chipActiveAll: { backgroundColor: '#DB4437' },
  chipActivePending: { backgroundColor: '#fbbf24' },
  chipActiveDeskPending: { backgroundColor: '#ef4444' }, // red
  chipActiveApproved: { backgroundColor: '#22c55e' },
  chipActiveDeskApproved: { backgroundColor: '#38bdf8' },
  chipActiveAIApproved: { backgroundColor: '#a3e635' },
  chipActiveRejected: { backgroundColor: '#ef4444' },
  chipText: { color: '#333', fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  card: { flexDirection: 'row', backgroundColor: '#f9fafb', borderRadius: 12, marginBottom: 14, overflow: 'hidden', elevation: 2 },
  image: { width: 90, height: 90, borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  imagePlaceholder: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5e7eb', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  cardContent: { flex: 1, padding: 12, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 4 },
  summary: { fontSize: 13, color: '#555', marginBottom: 8 },
  chipRow: { flexDirection: 'row', alignItems: 'center' },
  statusChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, marginRight: 8 },
  statusPENDING: { backgroundColor: '#fbbf24' },
  statusDESK_PENDING: { backgroundColor: '#ef4444' }, // red
  statusAPPROVED: { backgroundColor: '#22c55e' },
  statusDESK_APPROVED: { backgroundColor: '#38bdf8' },
  statusAI_APPROVED: { backgroundColor: '#a3e635' },
  statusREJECTED: { backgroundColor: '#ef4444' },
  statusChipText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  author: { fontSize: 12, color: '#666' },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 1,
  },
});
