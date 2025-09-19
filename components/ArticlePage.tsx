
import { Article } from '@/types';
import { Ramabhadra_400Regular, useFonts } from '@expo-google-fonts/ramabhadra';
import { AntDesign, Feather } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    ToastAndroid,
    TouchableOpacity,
    View,
} from 'react-native';
// Bottom sheet removed for full page navigation
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

interface ArticlePageProps {
  article: Article;
  index: number;
  totalArticles: number;
}

type EngagementButtonProps = {
  icon: React.ReactNode;
  text?: number | string;
  onPress: () => void;
};

const EngagementButton = ({ icon, text, onPress }: EngagementButtonProps) => (
  <TouchableOpacity onPress={onPress} style={styles.engagementButton}>
    {icon}
    {text !== undefined && text !== '' && (
      <Text style={styles.engagementButtonText}>{text}</Text>
    )}
  </TouchableOpacity>
);

const ArticlePage: React.FC<ArticlePageProps> = ({ article, index, totalArticles }) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [likes, setLikes] = useState<number>(article.likes ?? 0);
  const [dislikes, setDislikes] = useState<number>(article.dislikes ?? 0);
  const heroRef = useRef<ScrollView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const [shareMode, setShareMode] = useState(false);
  const { isTabBarVisible, setTabBarVisible } = useTabBarVisibility();
  const { show, hide } = useAutoHideBottomBar(
    () => setTabBarVisible(true),
    () => setTabBarVisible(false),
    { timeout: 5000, minVisible: 500, debug: true }
  );
  const lastScrollAtRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const scrollThrottle = 200;
  const lastTouchYRef = useRef(0);
  const lastTouchStartAtRef = useRef(0);
  const lastTouchMovedRef = useRef(false);

  const [fontsLoaded] = useFonts({
    Ramabhadra_400Regular,
  });

  // Footer should sit above the tab bar (when visible) and within safe area
  const TAB_BAR_HEIGHT = 62; // matches AutoHideTabBar minHeight
  const footerBottomOffset = Math.max(insets.bottom, 0) + (isTabBarVisible ? TAB_BAR_HEIGHT : 0);

  // Relative time helper for createdAt: Xm, Xh (<=24h), then X day(s)
  const formatRelativeTime = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)}m`;
    const hours = Math.floor(minutes / 60);
    if (hours <= 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  // Build hero slides (video first if present, then images)
  const heroSlides = useMemo(() => {
    const slides: { type: 'image' | 'video'; src: string }[] = [];
    if (article.videoUrl) slides.push({ type: 'video', src: article.videoUrl });
    const imgs = Array.isArray(article.images) && article.images.length ? article.images : (article.image ? [article.image] : []);
    imgs.forEach((u) => slides.push({ type: 'image', src: u }));
    return slides;
  }, [article.videoUrl, article.images, article.image]);

  const [slideIndex, setSlideIndex] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  // Precompute deep link used in banner/message
  const appUrl = useMemo(() => Linking.createURL(`/article/${encodeURIComponent(article.id)}`), [article.id]);
  // Auto-advance hero slides
  useEffect(() => {
    if (heroSlides.length < 2) return;
    let i = slideIndex;
    const id = setInterval(() => {
      i = (i + 1) % heroSlides.length;
      setSlideIndex(i);
      const x = i * width;
      heroRef.current?.scrollTo({ x, y: 0, animated: true });
    }, 3500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroSlides.length]);

  const handleLike = () => {
    setLikes((v) => v + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleDislike = () => {
    setDislikes((v) => v + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleComment = () => {
  router.push({ pathname: '/comments', params: { articleId: article.id } });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleShare = async () => {
    try {
      // For a cleaner capture, hide the engagement bar and show a subtle watermark
      setShareMode(true);
      await new Promise((r) => setTimeout(r, 80)); // allow UI to update
  const uri = await viewShotRef.current?.capture?.();
      // Deep link to this article inside the app (khabarx://article/<id>)
      const message = `${article.title}\n\nRead: ${appUrl}`;

      if (uri) {
        if (Platform.OS === 'android') {
          // On Android, RN Share ignores `url` for files; use expo-sharing for image share
          const available = await Sharing.isAvailableAsync();
          if (available) {
            await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share article' });
            // Also copy title + link so user can paste it in the target app
            try {
              await Clipboard.setStringAsync(message);
              ToastAndroid.show('Title and link copied', ToastAndroid.SHORT);
            } catch {}
          } else {
            await Share.share({ title: article.title, message }, { dialogTitle: 'Share article' });
          }
        } else {
          // iOS: Share supports `url` and will include the image
          await Share.share(
            { title: article.title, url: uri, message },
            { dialogTitle: 'Share article' }
          );
        }
      } else {
        // Fallback: share just the link
        await Share.share({ title: article.title, message });
      }
    } catch (error) {
      console.error('Failed to share', error);
    } finally {
      setShareMode(false);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Don't block rendering while fonts load; fall back gracefully


  return (
    <View style={styles.container}>
  <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={{ flex: 1 }}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.scrollContentContainer,
          { paddingBottom: Math.max(footerHeight, 8) + footerBottomOffset },
        ]}
        scrollEnabled={false}
        onScrollBeginDrag={() => { console.log('[Article] onScrollBeginDrag -> hide'); hide(); setTabBarVisible(false); }}
        onScroll={(e) => {
          const now = Date.now();
          const y = e.nativeEvent.contentOffset.y;
          const dy = y - (lastScrollYRef.current || 0);
          lastScrollYRef.current = y;
          // If bar is visible and even a tiny upward swipe (content moves up => dy>0) happens, hide immediately
          if (isTabBarVisible && dy > 1) {
            hide();
            setTabBarVisible(false);
            return;
          }
          // console.log('[Article] onScroll dy=', dy);
          if (Math.abs(dy) < 12) return; // ignore micro scroll noise when bar hidden
          if (now - (lastScrollAtRef.current || 0) > scrollThrottle) {
            lastScrollAtRef.current = now;
            // Hide when swiping (scrolling)
            hide();
            setTabBarVisible(false);
          }
        }}
        scrollEventThrottle={16}
      >
          {/* Hero carousel: images and optional video */}
          <View style={styles.heroContainer}>
            {heroSlides.length === 0 && (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff' }}>No media</Text>
              </View>
            )}
            <ScrollView
              ref={heroRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / width);
                setSlideIndex(i);
              }}
            >
              {heroSlides.map((s, i) => (
                <View key={`${s.type}-${i}`} style={{ width, height: width * 0.8 }}>
                  {s.type === 'image' ? (
                    <Image source={{ uri: s.src }} style={styles.heroMedia} cachePolicy="memory-disk" />
                  ) : (
                    <Video
                      source={{ uri: s.src }}
                      style={styles.heroMedia}
                      resizeMode={ResizeMode.COVER}
                      useNativeControls
                      shouldPlay={false}
                      isLooping={false}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
            {/* Overlays: author info and dots */}
            <View style={[styles.header, shareMode ? styles.headerShare : null]}>
              {shareMode ? (
                <View style={styles.promoAuthor}>
                  <View style={styles.promoFiller} />
                  <Image
                    source={require('../assets/images/icon.png')}
                    style={styles.promoLogo}
                    contentFit="contain"
                  />
                </View>
              ) : (
                article.author?.name ? (
                  <View style={styles.authorInfo}>
                    <Image source={{ uri: article.author.avatar }} style={styles.avatar} cachePolicy="memory-disk" />
                    <View>
                      <Text style={styles.authorName}>{article.author.name}</Text>
                    </View>
                  </View>
                ) : <View />
              )}
            </View>
            {heroSlides.length > 1 && (
              <View style={styles.dotsContainer}>
                {heroSlides.map((_, i) => (
                  <View key={i} style={[styles.dot, i === slideIndex ? styles.dotActive : undefined]} />
                ))}
              </View>
            )}
          </View>

          <View style={styles.articleArea}>
            <View
              style={styles.articleContent}
              onTouchStart={(e) => {
                lastTouchYRef.current = e.nativeEvent.pageY;
                lastTouchStartAtRef.current = Date.now();
                lastTouchMovedRef.current = false;
              }}
              onTouchMove={(e) => {
                const y = e.nativeEvent.pageY;
                const dy = y - (lastTouchYRef.current || y);
                if (Math.abs(dy) > 2) lastTouchMovedRef.current = true;
                lastTouchYRef.current = y;
                // If visible and user slightly swipes up, hide immediately
                if (isTabBarVisible && dy < -2) {
                  console.log('[Article] small upward glide -> hide');
                  hide();
                  setTabBarVisible(false);
                }
              }}
              onTouchEnd={() => {
                const dt = Date.now() - (lastTouchStartAtRef.current || 0);
                const isTap = !lastTouchMovedRef.current && dt < 300;
                if (isTap) {
                  // Toggle on content tap only
                  if (isTabBarVisible) {
                    hide();
                    setTabBarVisible(false);
                  } else {
                    show();
                    setTabBarVisible(true);
                  }
                }
              }}
            >
              <Text style={[
                styles.title,
                fontsLoaded ? { fontFamily: 'Ramabhadra_400Regular' } : null,
              ]}>
                {article.title}
              </Text>
              <Text style={styles.body}>{article.body}</Text>
              {/* Gallery moved to top hero; no inline gallery here */}
            </View>
            {/* Engagement bar (does not affect bottom nav visibility) */}
            {!shareMode && (
            <View style={styles.engagementBar}>
              <EngagementButton
                icon={<AntDesign name="like" size={24} color="#555" />}
                text={likes}
                onPress={() => { handleLike(); }}
              />
              <EngagementButton
                icon={<AntDesign name="dislike" size={24} color="#555" />}
                text={dislikes}
                onPress={() => { handleDislike(); }}
              />
              <EngagementButton
                icon={<Feather name="message-square" size={24} color="#555" />}
                onPress={() => { handleComment(); }}
              />
              <EngagementButton
                icon={<Feather name="download" size={24} color="#555" />}
                text="Save"
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              />
              <EngagementButton
                icon={<Feather name="share" size={24} color="#555" />}
                text="Share"
                onPress={() => { handleShare(); }}
              />
            </View>
            )}
          </View>
      </ScrollView>
  <View style={[styles.footerContainer, { bottom: footerBottomOffset }]}>
        <View style={styles.footerInfo} onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
          <View style={styles.footerLeft}>
            <Feather name="clock" size={14} color="#888" />
            <Text style={styles.infoText}>{formatRelativeTime(article.createdAt)} • {index + 1} of {totalArticles}</Text>
          </View>
          <Text
            numberOfLines={1}
            style={styles.categoryPill}
            accessibilityLabel={`Category ${article.category || 'General'}`}
          >
            {article.category || 'General'}
          </Text>
        </View>
      </View>
      {/* Small watermark shown only during share */}
      {/* No bottom promo banner; promo appears in the author area during shareMode */}
      </ViewShot>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 60, // Space for the fixed footer
  },
  image: {
    width: '100%',
    height: width * 0.8,
    justifyContent: 'flex-end',
  },
  heroContainer: {
    width: '100%',
    height: width * 0.8,
    backgroundColor: '#000',
  },
  heroMedia: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#000',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#fff',
  },
  authorName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  authorDesignation: {
    color: '#fff',
    fontSize: 12,
  },
  brandInfo: {
    alignItems: 'flex-end',
  },
  publisherLogo: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  brandName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  brandLocation: {
    color: '#fff',
    fontSize: 12,
  },
  headerShare: {
    backgroundColor: '#000',
  },
  // Promo variant rendered in author header area during shareMode
  promoAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    gap: 12,
  },
  promoFiller: { flex: 1 },
  promoLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  articleArea: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
  },
  articleContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  body: {
    fontSize: 18,
    lineHeight: 28,
    color: '#333',
  },
  engagementBar: {
    paddingLeft: 15,
    alignItems: 'center',
    gap: 25,
  },
  engagementButton: {
    alignItems: 'center',
  },
  engagementButtonText: {
    color: '#555',
    marginTop: 5,
    fontSize: 12,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 11,
    color: '#888',
  },
  categoryPill: {
    maxWidth: '50%',
    backgroundColor: '#f3f4f6',
    color: '#444',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 11,
  },
  watermark: {
    position: 'absolute',
    bottom: 64,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  watermarkText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  // previously used bottom promo banner styles removed
});

export default ArticlePage;
