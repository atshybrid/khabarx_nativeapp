import { getCachedCommentsByShortNews, getComments, getCommentsByShortNews, getMockMode, postComment, postCommentByShortNews } from '@/services/api';
import { loadTokens } from '@/services/auth';
import { emit } from '@/services/events';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform, StyleSheet, Text, TextInput, ToastAndroid, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type User = { id: string; name: string; avatar: string };
type CommentNode = {
  id: string;
  user: User;
  text: string;
  createdAt: string;
  likes: number;
  liked?: boolean;
  replies?: CommentNode[];
  parentId?: string | null;
};

const SAMPLE_USERS: User[] = [
  { id: 'u1', name: 'Ravi Kumar', avatar: 'https://randomuser.me/api/portraits/men/31.jpg' },
  { id: 'u2', name: 'Priya Sharma', avatar: 'https://randomuser.me/api/portraits/women/65.jpg' },
  { id: 'u3', name: 'Sunil Reddy', avatar: 'https://randomuser.me/api/portraits/men/55.jpg' },
  { id: 'u4', name: 'Anita Verma', avatar: 'https://randomuser.me/api/portraits/women/22.jpg' },
];

const initialComments: CommentNode[] = [
  {
    id: 'c1',
    user: SAMPLE_USERS[0],
    text: 'Great write-up! Loved the local details. 👏',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    likes: 12,
    replies: [
      {
        id: 'r1',
        user: SAMPLE_USERS[1],
        text: 'Agree! The images were on point too.',
        createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
        likes: 4,
      },
      {
        id: 'r2',
        user: SAMPLE_USERS[2],
        text: 'Can someone share the source link?',
        createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        likes: 1,
      },
    ],
  },
  {
    id: 'c2',
    user: SAMPLE_USERS[3],
    text: 'Informative article. Looking forward to follow-ups.',
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    likes: 7,
  },
];

// Note: setLayoutAnimationEnabledExperimental is deprecated/no-op on New Architecture.
// Modern RN/Expo no longer requires enabling it explicitly on Android.

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
};

export default function CommentsScreen() {
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<CommentNode>>(null);
  const insets = useSafeAreaInsets();
  // no explicit loading UI needed; fetch is quick
  const params = useLocalSearchParams<{ articleId?: string; shortNewsId?: string; id?: string }>();
  const shortNewsId = (params.shortNewsId || params.articleId || params.id) as string | undefined;
  const articleId = (!shortNewsId ? (params.articleId || params.id || 'sample-1') : undefined) as string | undefined;
  const [kbVisible, setKbVisible] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);
  const INPUT_BAR_BASE_HEIGHT = 72; // base height; actual measured below
  const [inputBarHeight, setInputBarHeight] = useState<number>(INPUT_BAR_BASE_HEIGHT);
  const [meName, setMeName] = useState<string>('You');
  const [meAvatar, setMeAvatar] = useState<string | undefined>(undefined);
  const [meId, setMeId] = useState<string | undefined>(undefined);
  const [hasRootByMe, setHasRootByMe] = useState<boolean>(false);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKbVisible(true);
      setKbHeight(e.endCoordinates?.height ?? 0);
      // keep newest messages visible when keyboard opens
      requestAnimationFrame(() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60));
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKbVisible(false);
      setKbHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load current user avatar/name for the input bar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await loadTokens();
        const u: any = t?.user || {};
        const name: string = u.name || u.fullName || u.profile?.fullName || 'You';
        let avatar: string | undefined = u.profilePhotoUrl || u.profile?.profilePhotoUrl || u.avatar || undefined;
  const rawId = u.id || u._id || u.userId;
  const id: string | undefined = rawId ? String(rawId) : undefined;
        if (!avatar) {
          try {
            const saved = await AsyncStorage.getItem('profile_photo_url');
            if (saved) avatar = saved;
          } catch {}
        }
        if (!cancelled) {
          setMeName(name);
          setMeAvatar(avatar);
          setMeId(id);
        }
      } catch {
        // keep defaults
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalCount = useMemo(() => {
    const countReplies = (nodes?: CommentNode[]): number =>
      (nodes ?? []).reduce((acc, n) => acc + 1 + countReplies(n.replies), 0);
    return countReplies(comments);
  }, [comments]);

  const Avatar = ({ name, uri, size = 36 }: { name: string; uri?: string; size?: number }) => {
    const initial = (name || '').trim().charAt(0).toUpperCase() || '?';
    if (uri) {
      return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    }
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' }}>
        <Text style={{ color: '#111', fontWeight: '700' }}>{initial}</Text>
      </View>
    );
  };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  };

  // Hydrate from backend
  const loadComments = useCallback(async (): Promise<CommentNode[]> => {
    const isMock = await getMockMode().catch(() => false);
    try {
      // Use cached comments for instant paint if available
      if (shortNewsId) {
        const cached = getCachedCommentsByShortNews(String(shortNewsId));
        if (cached && !cached.length) {
          // empty is valid; still show empty state quickly
          setComments(cached as any);
        } else if (cached && cached.length) {
          setComments(cached as any);
        }
      }
      setLoading(true);
      const data = shortNewsId
        ? await getCommentsByShortNews(String(shortNewsId))
        : await getComments(String(articleId));
      const list = (Array.isArray(data) ? data : []) as unknown as CommentNode[];
      setComments(list); // show empty array if no comments yet
      // detect if current user already has a root (parentId null) comment on this article
      if (meId) {
        const mine = list.find((c) => (!c.parentId || c.parentId === null) && String(c.user?.id) === String(meId));
        setHasRootByMe(!!mine);
        setHint(!!mine ? 'You already posted a comment. Tap Reply on a message to continue the thread.' : null);
      } else {
        setHasRootByMe(false);
        setHint(null);
      }
      if (__DEV__) {
        console.log('[Comments] loaded', { articleId, shortNewsId, length: list.length, mock: isMock });
      }
      setLoading(false);
      return list;
    } catch (e) {
      if (__DEV__) {
        console.warn('[Comments] load failed', (e as any)?.message || e);
      }
      // Only fall back to samples in mock mode; otherwise show empty
      const fallback = isMock ? initialComments : [];
      setComments(fallback);
      setLoading(false);
      return fallback;
    }
  }, [articleId, shortNewsId, meId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);
  // Defensive: ensure hasRootByMe remains true if comments change and my id matches a root
  useEffect(() => {
    if (!meId) return;
    const mine = comments.find(c => (!c.parentId || c.parentId === null) && String(c.user?.id) === String(meId));
    setHasRootByMe(!!mine);
  }, [comments, meId]);

  // Optionally: refresh on focus could be added with useFocusEffect

  // Likes disabled in UI per request (keeping data fields for compatibility)

  // Replies are posted to the backend; no local tree op needed beyond UI

  const onSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    // Rule: only one direct/root comment per user per shortNews
    if (!replyTo && hasRootByMe) {
      const msg = 'You have already posted a comment. Please reply to an existing comment.';
      if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT); else Alert.alert('Reply required', msg);
      return;
    }
    try {
      setSending(true);
      if (shortNewsId) {
        await postCommentByShortNews(String(shortNewsId), text, replyTo?.id);
      } else {
        await postComment(String(articleId!), text, replyTo?.id, SAMPLE_USERS[0]);
      }
      // Broadcast update so other screens (e.g., ArticlePage) can refresh counters immediately
      try {
        const total = (prev => {
          const countReplies = (nodes?: CommentNode[]): number => (nodes ?? []).reduce((acc, n) => acc + 1 + countReplies(n.replies), 0);
          return countReplies(comments) + 1; // optimistic: new comment
        })();
        emit('comments:updated', { shortNewsId: String(shortNewsId || articleId), total });
      } catch {}
      setInput('');
      setReplyTo(null);
      const refreshed = await loadComments();
      // Emit exact total after refresh
      try {
        const countReplies = (nodes?: CommentNode[]): number => (nodes ?? []).reduce((acc, n) => acc + 1 + countReplies(n.replies), 0);
        emit('comments:updated', { shortNewsId: String(shortNewsId || articleId), total: countReplies(refreshed) });
      } catch {}
      // Scroll to bottom where the new comment likely is
      requestAnimationFrame(() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100));
    } finally {
      setSending(false);
    }
  };

  const startReply = (id: string, name: string) => {
    // Optional rule: prevent replying to your own root comment
    if (meId) {
      const target = comments.find(c => c.id === id) || null;
      if (target && target.user?.id === meId) {
        const msg = "You can't reply to your own comment. Reply to someone else.";
        if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT); else Alert.alert('Not allowed', msg);
        return;
      }
    }
    setReplyTo({ id, name });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    });
  };

  const renderComment = (item: CommentNode, depth = 0, inThread = false): React.ReactNode => {
    const isExpanded = !!expanded[item.id];
    const hasReplies = (item.replies?.length ?? 0) > 0;
    return (
      <View key={item.id} style={[styles.commentRow, depth > 0 && { marginLeft: 28 }]}>        
  <Avatar name={item.user.name} uri={item.user.avatar} size={depth > 0 ? 28 : 36} />
        <View style={styles.bubbleArea}>
          <View style={[styles.bubble, depth > 0 && styles.replyBubble]}>
            <View style={styles.headerRow}>
              <Text style={styles.name}>{item.user.name}</Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Text style={styles.text}>{item.text}</Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => startReply(item.id, item.user.name)} style={styles.actionBtn}>
              <Feather name="message-circle" size={16} color="#666" />
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>
            {hasReplies && (
              <TouchableOpacity onPress={() => toggleExpand(item.id)} style={styles.actionBtn}>
                <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#666" />
                <Text style={styles.actionText}>
                  {isExpanded ? 'Hide replies' : `View replies (${item.replies!.length})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {hasReplies && isExpanded && (
            <View style={depth === 0 ? styles.repliesBlock : styles.repliesBlockNested}>
              {item.replies!.map((r) => renderComment(r, 1, true))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const kvOffset = Platform.OS === 'ios' ? 88 : 0;
  const bottomPad = (kbVisible ? kbHeight : Math.max(12, insets.bottom || 0)) + inputBarHeight + 24;
  const sendDisabled = sending || input.trim().length === 0 || (hasRootByMe && !replyTo);
  const SkeletonRow = () => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <View style={{ backgroundColor: '#F1F5F9', height: 16, borderRadius: 4, width: '40%', marginBottom: 8 }} />
        <View style={{ backgroundColor: '#F1F5F9', height: 14, borderRadius: 4, width: '95%', marginBottom: 6 }} />
        <View style={{ backgroundColor: '#F1F5F9', height: 14, borderRadius: 4, width: '85%', marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ backgroundColor: '#F1F5F9', height: 12, borderRadius: 6, width: 60 }} />
          <View style={{ backgroundColor: '#F1F5F9', height: 12, borderRadius: 6, width: 90 }} />
        </View>
      </View>
    </View>
  );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={kvOffset}
    >
      <Stack.Screen options={{ title: `Comments (${totalCount})` }} />
      <FlatList
        ref={listRef}
        data={loading ? Array.from({ length: 6 }).map((_, i) => ({ id: `s-${i}` })) as any : comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => loading ? <SkeletonRow /> : <>{renderComment(item)}</>}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
      {false && hint && !replyTo && (
        <View />
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(12, insets.bottom || 0), bottom: kbVisible ? kbHeight : 0 }]} onLayout={(e) => setInputBarHeight(e.nativeEvent.layout.height)}>
        {hint && !replyTo && (
          <View style={styles.hintChip}>
            <Text style={styles.hintChipText}>{hint}</Text>
          </View>
        )}
        {replyTo && (
          <View style={styles.replyChip}>
            <Text style={styles.replyChipText}>Replying to {replyTo.name}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Feather name="x" size={16} color="#475569" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <Avatar name={meName} uri={meAvatar} size={28} />
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder={replyTo ? `Reply to ${replyTo.name}…` : (hasRootByMe ? 'Reply to someone…' : 'Add a comment…')}
            placeholderTextColor="#9AA0A6"
            style={styles.input}
            editable={!hasRootByMe || !!replyTo}
            selectTextOnFocus={!hasRootByMe || !!replyTo}
            onTouchStart={() => {
              if (hasRootByMe && !replyTo) {
                const msg = 'You already posted a comment. Tap Reply on a message to continue the thread.';
                if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT); else Alert.alert('Reply required', msg);
              }
            }}
            onFocus={() => requestAnimationFrame(() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60))}
            multiline
            maxLength={500}
          />
          <TouchableOpacity onPress={onSend} disabled={sendDisabled} style={[styles.sendBtn, sendDisabled && styles.sendBtnDisabled]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  bubbleArea: { flex: 1 },
  bubble: {
    backgroundColor: '#F6F7F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  replyBubble: {
    backgroundColor: '#F9FAFB',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontWeight: '600', color: '#111', fontSize: 14 },
  time: { color: '#777', fontSize: 12, marginLeft: 8 },
  text: { color: '#222', fontSize: 15, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 4 },
  actionText: { color: '#666', fontSize: 13 },
  repliesBlock: { marginTop: 8, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E7EB', paddingLeft: 12 },
  repliesBlockNested: { marginTop: 8, paddingLeft: 0, borderLeftWidth: 0 },

  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    padding: 12,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  meAvatar: { width: 28, height: 28, borderRadius: 14 },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F6F7F9',
    borderRadius: 18,
    color: '#111',
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  hintChip: {
    backgroundColor: '#FFF7ED',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FDBA74',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  hintChipText: { color: '#9A3412', fontSize: 12 },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D7EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  replyChipText: { color: '#334155', fontSize: 12 },
});
