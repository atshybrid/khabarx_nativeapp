import { getComments, postComment } from '@/services/api';
import { AntDesign, Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const { articleId = 'sample-1' } = useLocalSearchParams<{ articleId?: string }>();
  const [kbVisible, setKbVisible] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

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

  const totalCount = useMemo(() => {
    const countReplies = (nodes?: CommentNode[]): number =>
      (nodes ?? []).reduce((acc, n) => acc + 1 + countReplies(n.replies), 0);
    return countReplies(comments);
  }, [comments]);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  };

  // Hydrate from backend
  const loadComments = useCallback(async () => {
    try {
      const data = await getComments(String(articleId));
  const list = (data as unknown as CommentNode[]) || [];
  setComments(list.length ? list : initialComments);
    } catch {
      // Fallback to sample if nothing
      setComments(initialComments);
    }
  }, [articleId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Optionally: refresh on focus could be added with useFocusEffect

  const toggleLike = (id: string) => {
    const toggle = (nodes: CommentNode[]): CommentNode[] =>
      nodes.map((n) =>
        n.id === id
          ? { ...n, liked: !n.liked, likes: n.liked ? Math.max(0, n.likes - 1) : n.likes + 1 }
          : { ...n, replies: n.replies ? toggle(n.replies) : n.replies }
      );
    setComments((prev) => toggle(prev));
  };

  // Replies are posted to the backend; no local tree op needed beyond UI

  const onSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    try {
      setSending(true);
      await postComment(String(articleId), text, replyTo?.id, SAMPLE_USERS[0]);
      setInput('');
      setReplyTo(null);
      await loadComments();
      // Scroll to bottom where the new comment likely is
      requestAnimationFrame(() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100));
    } finally {
      setSending(false);
    }
  };

  const startReply = (id: string, name: string) => {
    setReplyTo({ id, name });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    });
  };

  const renderComment = (item: CommentNode, depth = 0): React.ReactNode => {
    const isExpanded = !!expanded[item.id];
    const hasReplies = (item.replies?.length ?? 0) > 0;
    return (
      <View key={item.id} style={[styles.commentRow, depth > 0 && { marginLeft: 48 }]}>        
        <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
        <View style={styles.bubbleArea}>
          <View style={styles.bubble}>
            <View style={styles.headerRow}>
              <Text style={styles.name}>{item.user.name}</Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Text style={styles.text}>{item.text}</Text>
          </View>
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={() => toggleLike(item.id)} style={styles.actionBtn}>
              <AntDesign name="like" size={16} color={item.liked ? '#0a84ff' : '#666'} />
              <Text style={[styles.actionText, item.liked && { color: '#0a84ff' }]}>{item.likes}</Text>
            </TouchableOpacity>
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
            <View style={styles.repliesBlock}>
              {item.replies!.map((r) => renderComment(r, depth + 1))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const kvOffset = Platform.OS === 'ios' ? 88 : 0;
  const bottomPad = (kbVisible ? kbHeight : Math.max(12, insets.bottom || 0)) + 80;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.select({ ios: 'padding', android: 'position' })}
      keyboardVerticalOffset={kvOffset}
    >
      <Stack.Screen options={{ title: `Comments (${totalCount})` }} />
      <FlatList
        ref={listRef}
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <>{renderComment(item)}</>}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      {replyTo && (
        <View style={styles.replyingToBar}>
          <Text style={styles.replyingToText}>Replying to {replyTo.name}</Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Feather name="x" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      )}

    <View style={[styles.inputBar, { paddingBottom: Math.max(12, insets.bottom || 0), bottom: kbVisible ? kbHeight : 0 }]}>
        <Image source={{ uri: SAMPLE_USERS[0].avatar }} style={styles.meAvatar} />
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          placeholder={replyTo ? `Reply to ${replyTo.name}…` : 'Add a comment…'}
          placeholderTextColor="#9AA0A6"
          style={styles.input}
      onFocus={() => requestAnimationFrame(() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60))}
          multiline
          maxLength={500}
        />
        <TouchableOpacity onPress={onSend} style={styles.sendBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="send" size={20} color="#fff" />
        </TouchableOpacity>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontWeight: '600', color: '#111', fontSize: 14 },
  time: { color: '#777', fontSize: 12, marginLeft: 8 },
  text: { color: '#222', fontSize: 15, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 4 },
  actionText: { color: '#666', fontSize: 13 },
  repliesBlock: { marginTop: 8 },

  replyingToBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 64,
    backgroundColor: '#EEF2FF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D0D7EA',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyingToText: { color: '#334155', fontSize: 13 },

  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
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
});
