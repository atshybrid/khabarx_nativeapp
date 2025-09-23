import { getComments, postComment } from '@/services/api';
import { loadTokens } from '@/services/auth';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Updated types to match backend API response structure
type CommentNode = {
  id: string;
  userId: string;
  articleId: string | null;
  shortNewsId: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    profile: {
      fullName: string;
      profilePhotoUrl: string | null;
    };
  };
  replies: CommentNode[];
  // UI state for likes (not from backend)
  likes?: number;
  liked?: boolean;
};

// Get current user data from stored tokens
const getCurrentUserData = async () => {
  try {
    const tokens = await loadTokens();
    if (tokens?.user) {
      return {
        userId: tokens.user.userId,
        role: tokens.user.role,
        profile: tokens.user.profile || {}
      };
    }
    return null;
  } catch (error) {
    console.error('Error loading user data:', error);
    return null;
  }
};

// Default avatar colors for when profile photo is null
const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
  '#A55EEA', '#26DE81', '#FD79A8', '#FDCB6E', '#6C5CE7'
];

// Component for default avatar with initials
const DefaultAvatar: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => {
  const initials = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  
  const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const backgroundColor = AVATAR_COLORS[colorIndex];
  
  return (
    <View style={[
      styles.defaultAvatar,
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2, 
        backgroundColor 
      }
    ]}>
      <Text style={[
        styles.avatarInitials, 
        { 
          fontSize: size * 0.4,
          lineHeight: size * 0.9
        }
      ]}>
        {initials}
      </Text>
    </View>
  );
};


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
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; isDirectComment?: boolean } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<CommentNode>>(null);
  const insets = useSafeAreaInsets();
  // no explicit loading UI needed; fetch is quick
  // Accept both legacy articleId and new shortNewsId (preferred)
  const params = useLocalSearchParams<{ articleId?: string; shortNewsId?: string; authorId?: string }>();
  const targetId = params.shortNewsId || params.articleId || 'sample-1';
  const contentType: 'shortnews' | 'article' = params.shortNewsId ? 'shortnews' : (params.articleId ? 'article' : 'shortnews');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Current user state
  const [currentUser, setCurrentUser] = useState<{
    userId: string;
    role: string;
    profile: any;
  } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardHeight(e.endCoordinates.height);
        setKeyboardVisible(true);
        // keep newest messages visible when keyboard opens
        requestAnimationFrame(() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100));
      }
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setKeyboardHeight(0);
        setKeyboardVisible(false);
      }
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Load current user data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      const userData = await getCurrentUserData();
      if (userData) {
        setCurrentUser(userData);
        console.log('[Comments] Loaded user data:', userData);
      } else {
        console.warn('[Comments] No user data found - comments may not work correctly');
      }
    };
    
    loadUserData();
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
    setLoading(true);
    setError(null);
    try {
      const data = await getComments(String(targetId), { type: contentType });
      const list = (data as unknown as CommentNode[]) || [];
      setComments(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [targetId, contentType]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Optionally: refresh on focus could be added with useFocusEffect

  // Note: Like functionality removed as requested by user

  // Validation helper functions
  const checkCanPostDirectComment = useCallback(() => {
    // Check if user data is loaded
    if (!currentUser) {
      return {
        canPost: false,
        reason: "Please wait while we load your profile..."
      };
    }

    // Check if user has required role (CITIZEN_REPORTER)
    if (currentUser.role !== 'CITIZEN_REPORTER') {
      return {
        canPost: false,
        reason: "Only Citizen Reporters can post comments."
      };
    }
    
    // Rule: Each user can post only 1 direct comment per article
    const userDirectComments = comments.filter(comment => 
      comment.userId === currentUser.userId && comment.parentId === null
    );
    
    if (userDirectComments.length > 0) {
      return {
        canPost: false,
        reason: "You have already posted a comment on this article. You can reply to comments instead."
      };
    }
    
    return { canPost: true, reason: null };
  }, [currentUser, comments]);

  // Helper function to find the root comment (direct comment) of any comment/reply
  const findRootComment = useCallback((commentId: string): CommentNode | null => {
    // First check if it's a direct comment
    const directComment = comments.find(c => c.id === commentId && c.parentId === null);
    if (directComment) return directComment;
    
    // If not, find which direct comment this reply belongs to
    for (const comment of comments) {
      if (comment.parentId === null) { // This is a direct comment
        // Check if commentId is in this comment's reply tree
        const findInReplies = (replies: CommentNode[]): boolean => {
          for (const reply of replies) {
            if (reply.id === commentId) return true;
            if (reply.replies && findInReplies(reply.replies)) return true;
          }
          return false;
        };
        
        if (findInReplies(comment.replies || [])) {
          return comment;
        }
      }
    }
    return null;
  }, [comments]);

  const checkCanPostReply = useCallback(() => {
    // Check if user data is loaded
    if (!currentUser) {
      return {
        canPost: false,
        reason: "Please wait while we load your profile..."
      };
    }

    // Check if user has required role (CITIZEN_REPORTER)
    if (currentUser.role !== 'CITIZEN_REPORTER') {
      return {
        canPost: false,
        reason: "Only Citizen Reporters can post comments."
      };
    }
    
    // Check if we have a valid reply target
    if (!replyTo?.id) {
      return {
        canPost: false,
        reason: "Invalid reply target."
      };
    }
    
    // Find the root comment (direct comment) of this reply thread
    const rootComment = findRootComment(replyTo.id);
    
    if (!rootComment) {
      return {
        canPost: false,
        reason: "Could not find the original comment."
      };
    }
    
    // Rule: Users can reply to any comment (using any comment ID as parent ID)
    // No restrictions on replies - they can use any comment ID as parent
    return { canPost: true, reason: null };
  }, [currentUser, replyTo, findRootComment]);

  // Replies are posted to the backend; no local tree op needed beyond UI

  const onSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    
    // Validation logic
    const isReply = replyTo?.id != null;
    const validation = isReply ? checkCanPostReply() : checkCanPostDirectComment();
    
    if (!validation.canPost) {
      // Show error message to user
      setError(validation.reason);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    try {
      setSending(true);
      setError(null); // Clear any previous errors
      
      // Make sure we have current user data
      if (!currentUser?.userId) {
        throw new Error('User data not available. Please try again.');
      }
      
      await postComment(String(targetId), text, currentUser.userId, replyTo?.id);
      setInput('');
      setReplyTo(null);
      await loadComments();
      // Scroll to bottom where the new comment likely is
      requestAnimationFrame(() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100));
    } catch (err: any) {
      setError(err?.message || 'Failed to post comment. Please try again.');
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    } finally {
      setSending(false);
    }
  };

  const startReply = (id: string, name: string, isDirectComment = true) => {
    setReplyTo({ id, name, isDirectComment });
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    });
  };

  const renderComment = (item: CommentNode, depth = 0): React.ReactNode => {
    const isExpanded = !!expanded[item.id];
    const hasReplies = (item.replies?.length ?? 0) > 0;
    const marginLeft = depth > 0 ? Math.min(depth * 32, 64) : 0;
    
    return (
      <View key={item.id} style={[styles.commentContainer, { marginLeft }]}>
        {depth > 0 && <View style={styles.replyLine} />}
        
        <View style={styles.commentRow}>
          <View style={styles.avatarContainer}>
            {item.user.profile.profilePhotoUrl ? (
              <Image 
                source={{ uri: item.user.profile.profilePhotoUrl }} 
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <DefaultAvatar name={item.user.profile.fullName} size={depth > 0 ? 32 : 40} />
            )}
          </View>
          
          <View style={styles.commentContent}>
            <View style={styles.commentBubble}>
              <View style={styles.commentHeader}>
                <Text style={styles.userName}>{item.user.profile.fullName}</Text>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeText}>{timeAgo(item.createdAt)}</Text>
                </View>
              </View>
              <Text style={styles.commentText}>{item.content}</Text>
            </View>
            
            <View style={styles.commentActions}>
              <TouchableOpacity 
                onPress={() => startReply(item.id, item.user.profile.fullName, item.parentId === null)} 
                style={styles.replyButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="message-square" size={14} color="#007AFF" />
                <Text style={styles.replyText}>Reply</Text>
              </TouchableOpacity>
              
              {hasReplies && (
                <TouchableOpacity 
                  onPress={() => toggleExpand(item.id)} 
                  style={styles.expandButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather 
                    name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                    size={14} 
                    color="#007AFF" 
                  />
                  <Text style={styles.expandText}>
                    {isExpanded ? 'Hide' : `${item.replies!.length} ${item.replies!.length === 1 ? 'reply' : 'replies'}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        
        {hasReplies && isExpanded && (
          <View style={styles.repliesContainer}>
            {item.replies!.map((reply) => renderComment(reply, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  const kvOffset = Platform.OS === 'ios' ? 0 : 0; // Let's rely on our custom keyboard handling

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? kvOffset : 0}
    >
      <Stack.Screen options={{ title: `Comments (${totalCount})` }} />
      
      {/* Main content area */}
      <View style={{ flex: 1 }}>
        {loading && comments.length === 0 && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading comments…</Text>
          </View>
        )}
        
        {!loading && !error && comments.length === 0 && (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIconContainer}>
              <Feather name="message-square" size={48} color="#E1E8ED" />
            </View>
            <Text style={styles.emptyTitle}>No comments yet</Text>
            <Text style={styles.emptySubtitle}>Be the first to share your thoughts!</Text>
          </View>
        )}
        
        {error && (
          <View style={styles.centerContainer}>
            <View style={styles.errorIconContainer}>
              <Feather name="alert-circle" size={48} color="#FF3B30" />
            </View>
            <Text style={styles.errorTitle}>Unable to load comments</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <TouchableOpacity onPress={loadComments} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {comments.length > 0 && (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <>{renderComment(item)}</>}
            contentContainerStyle={[
              styles.listContent,
              keyboardVisible && Platform.OS === 'android' ? {
                paddingBottom: keyboardHeight + 100 // Extra space for input + keyboard
              } : {}
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={loadComments}
                tintColor="#007AFF"
                colors={['#007AFF']}
              />
            }
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          />
        )}
      </View>

      {/* Reply indicator bar */}
      {replyTo && (
        <View style={[
          styles.replyIndicator,
          keyboardVisible && Platform.OS === 'android' ? {
            position: 'absolute',
            bottom: keyboardHeight + 80, // Above the input area
            left: 0,
            right: 0,
          } : {}
        ]}>
          <View style={styles.replyIndicatorContent}>
            <Feather name="arrow-up-right" size={16} color="#007AFF" />
            <Text style={styles.replyIndicatorText}>
              Replying to <Text style={styles.replyIndicatorName}>{replyTo.name}</Text>
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setReplyTo(null)}
            style={styles.replyIndicatorClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={16} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      )}

      {/* Validation Error Message */}
      {error && (
        <View style={styles.errorBanner}>
          <View style={styles.errorContent}>
            <Feather name="alert-circle" size={16} color="#FF3B30" />
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
          <TouchableOpacity 
            onPress={() => setError(null)} 
            style={styles.errorClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={16} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}

      {/* Enhanced input area */}
      <View style={[
        styles.inputContainer,
        keyboardVisible && Platform.OS === 'android' ? {
          position: 'absolute',
          bottom: keyboardHeight,
          left: 0,
          right: 0,
          paddingBottom: 12,
        } : {
          paddingBottom: Math.max(12, insets.bottom || 0),
        }
      ]}>
        <View style={styles.inputRow}>
          <View style={styles.inputAvatarContainer}>
            <DefaultAvatar name="You" size={32} />
          </View>
          
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder={
                replyTo 
                  ? (() => {
                      const validation = checkCanPostReply();
                      if (!validation.canPost) {
                        return validation.reason || 'Cannot reply';
                      }
                      return replyTo.isDirectComment 
                        ? `Reply to ${replyTo.name}…`
                        : `Reply to ${replyTo.name}'s reply…`;
                    })()
                  : (() => {
                      const validation = checkCanPostDirectComment();
                      return validation.canPost 
                        ? 'Write a thoughtful comment…'
                        : validation.reason || 'You cannot post direct comments on this article';
                    })()
              }
              placeholderTextColor={
                (() => {
                  const isReply = replyTo != null;
                  const validation = isReply ? checkCanPostReply() : checkCanPostDirectComment();
                  return validation.canPost ? "#8E8E93" : "#FF6B6B";
                })()
              }
              style={[styles.textInput, input.length > 0 && styles.textInputActive]}
              onFocus={() => {
                requestAnimationFrame(() => 
                  setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
                );
              }}
              multiline
              maxLength={500}
              textAlignVertical="top"
              selectionColor="#007AFF"
              editable={
                (() => {
                  const isReply = replyTo != null;
                  const validation = isReply ? checkCanPostReply() : checkCanPostDirectComment();
                  return validation.canPost;
                })()
              }
            />
            
            <View style={styles.inputFooter}>
              <View style={styles.inputFooterLeft}>
                <Text style={styles.characterCount}>
                  {input.length}/500
                </Text>
                {(() => {
                  const isReply = replyTo != null;
                  const validation = isReply ? checkCanPostReply() : checkCanPostDirectComment();
                  if (!validation.canPost) {
                    return (
                      <Text style={styles.validationHint}>
                        💡 {validation.reason}
                      </Text>
                    );
                  }
                  return null;
                })()}
              </View>
              
              <TouchableOpacity 
                onPress={onSend} 
                style={[
                  styles.sendButton, 
                  input.trim().length > 0 && (() => {
                    const isReply = replyTo != null;
                    const validation = isReply ? checkCanPostReply() : checkCanPostDirectComment();
                    return validation.canPost;
                  })() && styles.sendButtonActive,
                  sending && styles.sendButtonSending
                ]}
                disabled={
                  input.trim().length === 0 || 
                  sending || 
                  (() => {
                    const isReply = replyTo != null;
                    const validation = isReply ? checkCanPostReply() : checkCanPostDirectComment();
                    return !validation.canPost;
                  })()
                }
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather 
                    name="send" 
                    size={16} 
                    color={input.trim().length > 0 ? '#fff' : '#8E8E93'} 
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Default Avatar Styles
  defaultAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },

  // List Content
  listContent: {
    padding: 20,
    paddingBottom: 20,
  },

  // Center Container for Empty/Loading/Error States
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1E21',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1E21',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
    elevation: 2,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Comment Container Styles
  commentContainer: {
    marginBottom: 4,
  },
  replyLine: {
    position: 'absolute',
    left: 20,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#E5E7EB',
    borderRadius: 1,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  userName: {
    fontWeight: '600',
    color: '#1C1E21',
    fontSize: 15,
    flex: 1,
  },
  timeBadge: {
    backgroundColor: '#E9ECEF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  timeText: {
    color: '#65676B',
    fontSize: 11,
    fontWeight: '500',
  },
  commentText: {
    color: '#1C1E21',
    fontSize: 15,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  replyText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  expandText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '500',
  },
  repliesContainer: {
    marginTop: 12,
  },

  // Reply Indicator Styles
  replyIndicator: {
    backgroundColor: '#F0F8FF',
    borderTopWidth: 1,
    borderTopColor: '#D0E8FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  replyIndicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  replyIndicatorText: {
    color: '#1C1E21',
    fontSize: 14,
  },
  replyIndicatorName: {
    fontWeight: '600',
    color: '#007AFF',
  },
  replyIndicatorClose: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
  },

  // Error Banner Styles
  errorBanner: {
    backgroundColor: '#FFF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 8,
  },
  errorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorMessage: {
    flex: 1,
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  errorClose: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },

  // Enhanced Input Styles
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    paddingHorizontal: 20,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  inputAvatarContainer: {
    marginTop: 4,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    overflow: 'hidden',
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1C1E21',
    maxHeight: 120,
    minHeight: 44,
    lineHeight: 20,
  },
  textInputActive: {
    borderColor: '#007AFF',
    backgroundColor: '#FFFFFF',
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    backgroundColor: '#F8F9FA',
  },
  inputFooterLeft: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  characterCount: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  validationHint: {
    color: '#007AFF',
    fontSize: 11,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E9ECEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#007AFF',
  },
  sendButtonSending: {
    backgroundColor: '#007AFF',
    opacity: 0.7,
  },

  // Legacy styles (kept for compatibility)
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
