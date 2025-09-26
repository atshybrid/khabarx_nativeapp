import { VideoWrapper } from '@/components/VideoWrapper';
import { WEB_BASE_URL } from '@/config/appConfig';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { useReaction } from '@/hooks/useReaction';
import { Article } from '@/types';
import { Ramabhadra_400Regular, useFonts } from '@expo-google-fonts/ramabhadra';
// Vector icons from @expo/vector-icons no longer used for engagement rail
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useVideoPlayer } from 'expo-video';
// Removed LinearGradient (no branded card rendering now)
import { useThemeColor } from '@/hooks/useThemeColor';
import { useTransliteration } from '@/hooks/useTransliteration';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Share as RnShare,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Prefer static import; add runtime guard below in case native module isn't linked yet
import { getCachedCommentsByShortNews, getCommentsByShortNews, prefetchCommentsByShortNews } from '@/services/api';
import { on } from '@/services/events';
import ShareLib from 'react-native-share';
import ViewShot from 'react-native-view-shot';
// Lightweight guard: if module didn't load (shouldn't happen after rebuild) fallbacks will kick in.
const shareRuntime: typeof ShareLib | undefined = ShareLib || undefined;

interface ArticlePageProps {
  article: Article;
  index: number;
  totalArticles: number;
}

type EngagementButtonProps = {
  icon: React.ReactNode;
  text?: number | string;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  textStyle?: any;
  layout?: 'row' | 'column';
};

const EngagementButton: React.FC<EngagementButtonProps> = ({ icon, text, onPress, onLongPress, accessibilityLabel, disabled, textStyle, layout = 'column' }) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const bounce = React.useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.12, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }),
    ]).start();
  }, [scale]);
  const handlePress = React.useCallback(() => {
    if (disabled) return;
    bounce();
    try { onPress(); } catch {}
  }, [disabled, bounce, onPress]);
  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={onLongPress}
      style={[styles.engagementButton, layout === 'row' && { flexDirection: 'row', alignItems: 'center' }, disabled && { opacity: 0.5 }]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {icon}
      </Animated.View>
      {text !== undefined && text !== '' && (
        <Text style={[styles.engagementButtonText, layout === 'row' && { marginLeft: 8 }, textStyle]}>{text}</Text>
      )}
    </TouchableOpacity>
  );
};

const ArticlePage: React.FC<ArticlePageProps> = ({ article, index, totalArticles }) => {
  // ...existing code...
  // ...existing code...
  // Prepare video players for each video slide
  // Global translation map for brand tagline parts (kept inside module but above usage)
  const GLOBAL_TAG_PARTS = React.useMemo(() => ({
    latestNews: {
      te: 'తాజా వార్తలు', hi: 'ताज़ा खबरें', bn: 'সর্বশেষ খবর', ta: 'சமீபத்திய செய்திகள்', kn: 'ತಾಜಾ ಸುದ್ದಿ', ml: 'പുതിയ വാർത്തകൾ', en: 'Latest News'
    },
    download: {
      te: 'డౌన్‌లోడ్', hi: 'डाउनलोड', bn: 'ডাউনলোড', ta: 'பதிவிறக்கு', kn: 'ಡೌನ್‌ಲೋಡ್', ml: 'ഡൗൺലോഡ്', en: 'Download'
    },
    app: {
      te: 'అప్', hi: 'ऐप', bn: 'অ্যাপ', ta: 'அப்', kn: 'ಆಪ್', ml: 'ആപ്പ്', en: 'App'
    }
  }) , []);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Reaction state (server authoritative). We start with article initial counts; hook will fetch actual.
  const reaction = useReaction({
    articleId: article.id,
  });
  const heroRef = useRef<ScrollView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const heroCaptureRef = useRef<ViewShot>(null); // wraps hero media for image capture
  const fullShareRef = useRef<ViewShot>(null); // off-screen full article capture (hero + title + body, no engagement)
  const [shareMode, setShareMode] = useState(false); // toggled briefly during capture (could show watermark if desired)
  // Transliteration for place + tagline
  // Language handling: we keep both the article's original language and the user's selected app language.
  // resolvedLang is what we use for branding/translation (user preference wins).
  const [articleLang] = useState<string | undefined>((article as any)?.languageCode);
  const [resolvedLang, setResolvedLang] = useState<string | undefined>(undefined);
  const placeTx = useTransliteration({ languageCode: resolvedLang, enabled: true, mode: 'immediate', debounceMs: 120 });
  const [brandLine, setBrandLine] = useState('');
  const [userPlace, setUserPlace] = useState('');

  const lang = resolvedLang || 'en';
  // Load selected language from storage; override article language if present.
  useEffect(() => {
    let mounted = true;
    const normalize = (c?: string): string | undefined => {
      if (!c) return undefined;
      const k = String(c).toLowerCase();
      const map: Record<string,string> = {
        'te': 'te', 'telugu': 'te', 'te-in': 'te', 'te_in': 'te',
        'hi': 'hi', 'hindi': 'hi',
        'bn': 'bn', 'bengali': 'bn',
        'ta': 'ta', 'tamil': 'ta',
        'kn': 'kn', 'kannada': 'kn',
        'ml': 'ml', 'malayalam': 'ml',
        'en': 'en', 'english': 'en'
      };
      return map[k] || undefined;
    };
    (async () => {
      let selCode: string | undefined;
      try {
        const raw = await AsyncStorage.getItem('selectedLanguage');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const candidates = [parsed?.id, parsed?.code, parsed?.lang, parsed?.languageCode, parsed?.value];
            for (const c of candidates) {
              const norm = normalize(c);
              if (norm) { selCode = norm; break; }
            }
          } catch {}
        }
      } catch {}
      if (!mounted) return;
      const finalLang = selCode || normalize(articleLang) || 'en';
      setResolvedLang(finalLang);
      if (__DEV__) {
        console.log('[BrandLang] selected raw ->', selCode, 'articleLang ->', articleLang, 'resolved ->', finalLang);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id]);
  const tPart = React.useCallback(<K extends keyof typeof GLOBAL_TAG_PARTS>(k: K) => GLOBAL_TAG_PARTS[k][lang as keyof typeof GLOBAL_TAG_PARTS[K]] || GLOBAL_TAG_PARTS[k].en, [lang, GLOBAL_TAG_PARTS]);
  // Load user place from storage; fallback to article author place if none
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const locObjRaw = await AsyncStorage.getItem('profile_location_obj');
        let candidate = '';
        if (locObjRaw) {
          try { candidate = JSON.parse(locObjRaw)?.name || ''; } catch {}
        }
        if (!candidate) {
          candidate = (await AsyncStorage.getItem('profile_location')) || '';
        }
        if (!candidate) {
          candidate = (article as any)?.author?.placeName || '';
        }
        if (mounted) {
          setUserPlace(candidate);
          if (candidate) placeTx.onChangeText(candidate);
        }
      } catch {}
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id]);

  // Build phrase: PlaceName Download for the Latest News (translated parts)
  useEffect(() => {
  const p = placeTx.value || userPlace || '';
    const translatedPhrase = `${tPart('download')} ${/* for the */ ''} ${tPart('latestNews')} ${tPart('app')}`.replace(/\s+/g,' ').trim();
    // If no place, show only phrase`
    const combined = p ? `${p} ${translatedPhrase}` : translatedPhrase;
    setBrandLine(combined);
  }, [placeTx.value, userPlace, lang, tPart]);

  // Removed language confirmation pills per user request.
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

  // Footer fixed at device bottom within safe area (does not move with tab bar)
  const footerBottomOffset = Math.max(insets.bottom, 0);

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

    // Call useVideoPlayer for the first three slides at the top level, unconditionally
    const videoPlayer0 = useVideoPlayer({ uri: heroSlides[0]?.type === 'video' ? heroSlides[0].src : '' });
    const videoPlayer1 = useVideoPlayer({ uri: heroSlides[1]?.type === 'video' ? heroSlides[1].src : '' });
    const videoPlayer2 = useVideoPlayer({ uri: heroSlides[2]?.type === 'video' ? heroSlides[2].src : '' });


  const [slideIndex, setSlideIndex] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [titleHeight, setTitleHeight] = useState(0);
  const [maxBodyLines, setMaxBodyLines] = useState<number | undefined>(undefined);
  // Toggle for right-side rail (now disabled; engagement is in footer)
  const SHOW_RIGHT_RAIL = false;
  // Comments count hidden on rail (icons only); keep logic minimal
  // Small-screen adjustments
  const isSmallScreen = width <= 360 || Dimensions.get('window').height <= 680;
  // (Removed appUrl since we rely on canonical or fallback web domain for sharing.)
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
    reaction.like();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDislike = () => {
    reaction.dislike();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleComment = () => {
    // Align with upstream main params while keeping compatibility with our comments screen
    router.push({
      pathname: '/comments',
      params: {
        articleId: article.id,
        shortNewsId: article.id,
        authorId: (article as any)?.author?.id || (article as any)?.author?.name || undefined,
      },
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Prefetch comments for faster open
  useEffect(() => {
    prefetchCommentsByShortNews(String(article.id)).catch(() => {});
  }, [article?.id]);

  // Comments count: hydrate from cache/server and live update via events
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const countReplies = React.useCallback((nodes?: { replies?: any[] }[]): number => {
    const list = Array.isArray(nodes) ? nodes : [];
    let total = 0;
    const walk = (arr: any[]) => {
      for (const n of arr) {
        total += 1;
        if (Array.isArray(n?.replies) && n.replies.length) walk(n.replies);
      }
    };
    walk(list as any[]);
    return total;
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = getCachedCommentsByShortNews(String(article.id));
        if (cached) {
          if (!cancelled) setCommentsCount(countReplies(cached));
          // still refresh in background to ensure accuracy
        }
        const fresh = await getCommentsByShortNews(String(article.id));
        if (!cancelled) setCommentsCount(countReplies(fresh));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [article?.id, countReplies]);

  // Listen for live comment updates from comments screen
  useEffect(() => {
    const off = on('comments:updated', (p) => {
      if (String(p.shortNewsId) === String(article.id)) {
        setCommentsCount(p.total);
      }
    });
    return () => off();
  }, [article?.id]);

  // Build share text (metadata prioritized). Separate function so we can reuse.
  const buildSharePayload = () => {
    // Assume canonicalUrl already normalized server-side. If missing, fall back to configured WEB_BASE_URL.
    const fallbackWeb = `${WEB_BASE_URL.replace(/\/$/, '')}/article/${encodeURIComponent(article.id)}`;
    const canonical = article.canonicalUrl || fallbackWeb;
    const deepLink = `khabarx://article/${article.id}`;
    const shareTitle = article.metaTitle || article.title;
    // Meta description intentionally removed per user request
    const messageLines = [
      shareTitle,
      `\nRead: ${canonical}`,
      `Open in App: ${deepLink}`
    ];
    const message = messageLines.filter(Boolean).join('\n');
    return { shareTitle, message, canonical, deepLink };
  };

  // Tap share: capture hero image ONLY (no text baked) and attempt to send image + caption.
  const handleShareTap = async () => {
    try {
      setShareMode(true);
      // allow any pending hero rendering (video poster/image) to stabilize
      await new Promise(r => setTimeout(r, 80));
  const { shareTitle, message } = buildSharePayload();
  // Capture full article (hero + title + body) from off-screen composition
  const capturedUri = await fullShareRef.current?.capture?.();
      if (!capturedUri) {
        await RnShare.share({ title: shareTitle, message }, { dialogTitle: 'Share article' });
        return;
      }
      // Normalize URI (react-native-share expects file://)
      const imgUri = capturedUri.startsWith('file://') ? capturedUri : `file://${capturedUri}`;
      // Prefer react-native-share (supports EXTRA_STREAM + EXTRA_TEXT properly on Android)
      try {
        if (shareRuntime?.open) {
          await shareRuntime.open({
          url: imgUri,
          type: 'image/jpeg',
          message,
          title: shareTitle,
          failOnCancel: false,
          // subject could be added for email clients
          });
        } else {
          throw new Error('react-native-share not available');
        }
        // Android: still copy caption so user can paste if target strips it
        if (Platform.OS === 'android') {
          try { await Clipboard.setStringAsync(message); ToastAndroid.show('Caption copied (paste if missing)', ToastAndroid.SHORT); } catch {}
        }
        return; // success path
      } catch (primaryErr) {
        console.warn('[Share] react-native-share open failed, fallback to RN Share', primaryErr);
      }
      if (Platform.OS === 'ios') {
        await RnShare.share({ title: shareTitle, url: imgUri, message }, { dialogTitle: 'Share article' });
      } else {
        // Android fallback chain: RN Share -> expo-sharing image-only
        try {
          await RnShare.share({ title: shareTitle, message, url: imgUri }, { dialogTitle: 'Share article' });
        } catch (err2) {
          console.warn('[Share] RN Share fallback failed, trying expo-sharing', err2);
          const available = await Sharing.isAvailableAsync();
          if (available) {
            try { await Sharing.shareAsync(imgUri, { mimeType: 'image/jpeg', dialogTitle: shareTitle }); } catch (ee) { console.error('expo-sharing failed', ee); }
          }
        }
        try { await Clipboard.setStringAsync(message); ToastAndroid.show('Caption copied (paste if missing)', ToastAndroid.SHORT); } catch {}
      }
    } catch (e) {
      console.error('Tap share failed', e);
    } finally {
      setShareMode(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // Don't block rendering while fonts load; fall back gracefully


  const bg = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const card = useThemeColor({}, 'card');
  const muted = useThemeColor({}, 'muted');
  const countColor = muted;

  const formatCount = React.useCallback((n?: number) => {
    const v = typeof n === 'number' ? n : 0;
    if (v < 1000) return String(v);
    if (v < 1000000) return `${(v / 1000).toFixed(v % 1000 >= 100 ? 1 : 0)}K`;
    return `${(v / 1000000).toFixed(v % 1000000 >= 100000 ? 1 : 0)}M`;
  }, []);

  // Compute max lines for body text so page fits the screen without scrolling
  useEffect(() => {
    const winH = Dimensions.get('window').height;
    const heroH = width * 0.8;
    // paddings and spacing in content area (approx): 15 (container pad) + 10 (title margin) + 15 (bottom padding)
    const extraPad = 15 + (isSmallScreen ? 8 : 10) + 15;
    const available = winH - heroH - footerBottomOffset - footerHeight - extraPad;
  const lineHeight = isSmallScreen ? 26 : 30; // updated to match increased body lineHeight
    const remainingForBody = Math.max(0, available - titleHeight);
    const lines = Math.floor(remainingForBody / lineHeight);
    // Guard against negative or excessively large counts
    const clamped = Math.max(0, Math.min(lines, 18));
    setMaxBodyLines(clamped);
  }, [footerBottomOffset, footerHeight, titleHeight, isSmallScreen]);
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
  <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={{ flex: 1 }}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
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
          <ViewShot ref={heroCaptureRef} options={{ format: 'jpg', quality: 0.9 }} style={styles.heroContainer}>
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
                    <Image source={{ uri: s.src }} style={styles.heroMediaImage} cachePolicy="memory-disk" />
                  ) : (
                    <VideoWrapper
                      player={i === 0 ? videoPlayer0 : i === 1 ? videoPlayer1 : videoPlayer2}
                      style={styles.heroMedia}
                      contentFit="cover"
                      nativeControls={true}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
            {/* Overlays: author info and dots */}
            <View style={[styles.header, shareMode ? styles.headerShare : null]}>
              {/* Light minimal overlay removed for simpler look */}
              {shareMode ? (
                <View style={styles.promoAuthor}>
                  <View style={[styles.brandCard, { width: '90%', justifyContent:'space-between' }]}>
                    <Text style={styles.brandSingleLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {brandLine || 'Latest News'}
                    </Text>
                    <Image
                      source={require('../assets/images/icon.png')}
                      style={styles.brandLogo}
                      contentFit="contain"
                    />
                  </View>
                </View>
              ) : article.author ? (() => {
                const a: any = article.author;
                const fullName: string = a.fullName || a.name || 'Reporter';
                const photo: string | null = a.profilePhotoUrl || a.avatar || null;
                const roleName: string | null = a.roleName || null;
                const placeName: string | null = a.placeName || null;
                const initials = fullName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0,2)
                  .map((p: string) => p[0]?.toUpperCase())
                  .join('');
                const humanRole = roleName ? String(roleName).replace(/_/g,' ').toLowerCase().replace(/\b([a-z])/g,(m)=>m.toUpperCase()) : null;
                return (
                  <View style={styles.authorCompact}>
                    {photo ? (
                      <Image source={{ uri: photo }} style={styles.avatarSmallImg} cachePolicy="memory-disk" />
                    ) : (
                      <View style={[styles.avatarSmall, styles.avatarFallbackSmall]}>
                        <Text style={styles.avatarInitialsSmall}>{initials || 'R'}</Text>
                      </View>
                    )}
                    <Text style={styles.authorNameCompact} numberOfLines={1}>{fullName}</Text>
                    {humanRole && (
                      <Text style={styles.roleTiny} numberOfLines={1}>{humanRole}</Text>
                    )}
                    {placeName && (
                      <View style={styles.dotSep} />
                    )}
                    {placeName && (
                      <Text style={styles.placeTiny} numberOfLines={1}>{placeName}</Text>
                    )}
                  </View>
                );
              })() : null}
            </View>
            {heroSlides.length > 1 && (
              <View style={styles.dotsContainer}>
                {heroSlides.map((_, i) => (
                  <View key={i} style={[styles.dot, i === slideIndex ? styles.dotActive : undefined]} />
                ))}
              </View>
            )}
          </ViewShot>

          <View style={[styles.articleArea, { backgroundColor: bg }] }>
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
                { color: textColor, letterSpacing: 0.2, textAlign: 'left' },
                isSmallScreen ? { fontSize: 24, marginBottom: 10 } : { fontSize: 26 },
              ]}
                numberOfLines={2}
                ellipsizeMode="tail"
                onLayout={(e) => setTitleHeight(e.nativeEvent.layout.height)}
              >
                {article.title}
              </Text>
              <Text style={[
                styles.body,
                { color: textColor, letterSpacing: 0.1, textAlign: 'left' },
                isSmallScreen ? { fontSize: 17, lineHeight: 26 } : { fontSize: 19, lineHeight: 30 },
              ]} numberOfLines={maxBodyLines || undefined} ellipsizeMode="tail">
                {article.body}
              </Text>
              {/* Gallery moved to top hero; no inline gallery here */}
            </View>
            {/* Right-side vertical engagement rail (disabled in favor of footer) */}
            {SHOW_RIGHT_RAIL && !shareMode && (
              <>
                <View style={[styles.railDivider, { borderLeftColor: border }]} />
                <View style={styles.engagementRail}>
                  <EngagementButton
                    icon={<Feather name="thumbs-up" size={24} color={reaction.reaction === 'LIKE' ? '#fa7c05' : textColor} />}
                    onPress={handleLike}
                    accessibilityLabel={`Like this article.`}
                    disabled={reaction.updating || reaction.loading}
                  />
                  <EngagementButton
                    icon={<Feather name="thumbs-down" size={24} color={reaction.reaction === 'DISLIKE' ? '#fa7c05' : textColor} />}
                    onPress={handleDislike}
                    accessibilityLabel={`Dislike this article.`}
                    disabled={reaction.updating || reaction.loading}
                  />
                  <EngagementButton
                    icon={<Feather name="message-circle" size={24} color={textColor} />}
                    onPress={handleComment}
                  />
                  <EngagementButton
                    icon={<Feather name="share-2" size={24} color={textColor} />}
                    onPress={handleShareTap}
                  />
                </View>
              </>
            )}
          </View>
      </ScrollView>
  <View style={[styles.footerContainer, { bottom: footerBottomOffset, backgroundColor: card }]} onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
        <View style={[styles.footerInfo, { borderTopColor: border }]}>
          <View style={styles.footerLeft}>
            <Feather name="clock" size={14} color={muted} />
            <Text style={[styles.infoText, { color: muted }]}>{formatRelativeTime(article.createdAt)} • {index + 1} of {totalArticles}</Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.categoryPill, { backgroundColor: card, color: textColor, borderColor: border, borderWidth: 1 }]}
            accessibilityLabel={`Category ${article.category || 'General'}`}
          >
            {article.category || 'General'}
          </Text>
        </View>
        {/* Footer engagement row: icons-only, evenly spaced */}
        {!shareMode && (
          <View style={[styles.footerEngagement, { borderTopColor: border }] }>
            <EngagementButton
              icon={<Feather name="thumbs-up" size={24} color={reaction.reaction === 'LIKE' ? '#fa7c05' : textColor} />}
              onPress={handleLike}
              accessibilityLabel={`Like this article.`}
              disabled={reaction.updating || reaction.loading}
              text={formatCount(reaction.likes)}
              textStyle={{ color: countColor, fontSize: 12, fontWeight: '600' }}
              layout="row"
            />
            <EngagementButton
              icon={<Feather name="thumbs-down" size={24} color={reaction.reaction === 'DISLIKE' ? '#fa7c05' : textColor} />}
              onPress={handleDislike}
              accessibilityLabel={`Dislike this article.`}
              disabled={reaction.updating || reaction.loading}
              text={formatCount(reaction.dislikes)}
              textStyle={{ color: countColor, fontSize: 12, fontWeight: '600' }}
              layout="row"
            />
            <EngagementButton
              icon={<Feather name="message-circle" size={24} color={textColor} />}
              onPress={handleComment}
              text={formatCount(commentsCount)}
              textStyle={{ color: countColor, fontSize: 12, fontWeight: '600' }}
              layout="row"
            />
            <EngagementButton
              icon={<Feather name="share-2" size={24} color={textColor} />}
              onPress={handleShareTap}
              layout="row"
            />
          </View>
        )}
      </View>
      {/* Small watermark shown only during share */}
      {/* No bottom promo banner; promo appears in the author area during shareMode */}
      {/* Off-screen branded card for sharing */}
      {/* Card composition removed: sharing hero image + real text caption */}
      </ViewShot>
      {/* Off-screen full share composition (no engagement bar, no footer) */}
      <View style={{ position: 'absolute', top: -99999, left: -99999 }} pointerEvents="none">
        <ViewShot ref={fullShareRef} options={{ format: 'jpg', quality: 0.9 }}>
          <View style={{ width, backgroundColor: bg }}>
            <View style={styles.heroContainer}>
              {heroSlides.length > 0 ? (
                heroSlides[slideIndex].type === 'image' ? (
                  <Image source={{ uri: heroSlides[slideIndex].src }} style={styles.heroMediaImage} cachePolicy="memory-disk" />
                ) : (
                  <Image source={{ uri: heroSlides[slideIndex].src }} style={styles.heroMediaImage} cachePolicy="memory-disk" />
                )
              ) : (
                <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ color: muted }}>No media</Text>
                </View>
              )}
              {/* Brand card overlay also in capture */}
              {brandLine ? (
                <View style={{ position:'absolute', left:10, right:10, bottom:10 }}>
                  <View style={[styles.brandCard, { width: '100%', justifyContent:'space-between' }]}>
                    <Text style={styles.brandSingleLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{brandLine}</Text>
                    <Image
                      source={require('../assets/images/icon.png')}
                      style={styles.brandLogo}
                      contentFit="contain"
                    />
                  </View>
                </View>
              ) : null}
            </View>
            <View style={{ padding: 15 }}>
              <Text style={[styles.title, { color: textColor }, fontsLoaded ? { fontFamily: 'Ramabhadra_400Regular' } : null]}>{article.title}</Text>
              <Text style={[styles.body, { color: textColor }]}>{article.body}</Text>
            </View>
          </View>
        </ViewShot>
      </View>
    </View>
  );
};

const { width } = Dimensions.get('window');

type Styles = {
  container: ViewStyle;
  scrollContainer: ViewStyle;
  scrollContentContainer: ViewStyle;
  image: ViewStyle;
  heroContainer: ViewStyle;
  heroMedia: ViewStyle; // for Video/View usages
  heroMediaImage: ImageStyle; // for Image usages
  dotsContainer: ViewStyle;
  dot: ViewStyle;
  dotActive: ViewStyle;
  authorCompact: ViewStyle;
  avatarSmall: ViewStyle; // used on View fallback
  avatarSmallImg: ImageStyle; // used on Image
  avatarFallbackSmall: ViewStyle;
  avatarInitialsSmall: TextStyle;
  authorNameCompact: TextStyle;
  roleTiny: TextStyle;
  dotSep: ViewStyle;
  placeTiny: TextStyle;
  header: ViewStyle;
  headerGradient: ViewStyle;
  authorInfo: ViewStyle;
  authorPanel: ViewStyle;
  avatar: ImageStyle;
  avatarWrapper: ViewStyle;
  avatarRing: ViewStyle;
  avatarInitials: TextStyle;
  authorName: TextStyle;
  authorMetaRow: ViewStyle;
  roleBadge: ViewStyle;
  roleBadgeText: TextStyle;
  placeName: TextStyle;
  placePill: ViewStyle;
  avatarFallback: ViewStyle;
  authorDesignation: TextStyle;
  brandInfo: ViewStyle;
  publisherLogo: ImageStyle;
  brandName: TextStyle;
  brandLocation: TextStyle;
  headerShare: ViewStyle;
  promoAuthor: ViewStyle;
  promoFiller: ViewStyle;
  promoLogo: ImageStyle;
  brandCard: ViewStyle;
  brandCardLeft: ViewStyle;
  brandLogo: ImageStyle;
  brandSingleLine: TextStyle;
  brandPlace: TextStyle;
  brandTagline: TextStyle;
  articleArea: ViewStyle;
  articleContent: ViewStyle;
  title: TextStyle;
  body: TextStyle;
  engagementBar: ViewStyle;
  engagementButton: ViewStyle;
  engagementButtonText: TextStyle;
  engagementRail: ViewStyle;
  railDivider: ViewStyle;
  footerEngagement: ViewStyle;
  footerContainer: ViewStyle;
  footerInfo: ViewStyle;
  footerLeft: ViewStyle;
  infoText: TextStyle;
  categoryPill: TextStyle;
  watermark: ViewStyle;
  watermarkText: TextStyle;
  languageRow: ViewStyle;
  languagePill: TextStyle;
};

const styles = StyleSheet.create<Styles>({
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
    backgroundColor: '#f8f8f8',
  },
  heroMedia: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#f2f2f2',
  },
  heroMediaImage: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#f2f2f2',
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
  authorCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    // Removed pill background to avoid obstructing hero image
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 6,
    maxWidth: '92%',
  },
  avatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eee',
  },
  avatarSmallImg: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eee',
  },
  avatarFallbackSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e2e2',
  },
  avatarInitialsSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: '#444'
  },
  authorNameCompact: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
    maxWidth: 120,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  roleTiny: {
    fontSize: 11,
    color: '#666',
    maxWidth: 90,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  dotSep: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#bbb',
  },
  placeTiny: {
    fontSize: 11,
    color: '#666',
    maxWidth: 90,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: 'transparent',
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#fff',
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    zIndex: -1,
    opacity: 0.9,
  },
  avatarInitials: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  authorName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  authorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,215,121,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,215,121,0.45)'
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5
  },
  placeName: {
    color: '#eee',
    fontSize: 11,
    maxWidth: 120
  },
  placePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: 130,
    gap: 2,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center'
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
    backgroundColor: 'rgba(255,255,255,0.85)',
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
  brandCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    maxWidth: '86%',
    gap: 10,
  },
  brandCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  brandLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  brandSingleLine: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 0.2,
  },
  brandPlace: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  brandTagline: {
    fontSize: 12,
    color: '#f3f3f3',
    letterSpacing: 0.5,
  },
  articleArea: {
    flexDirection: 'row',
    padding: 15,
    paddingRight: 10,
    backgroundColor: '#fff',
    alignItems: 'flex-start',
  },
  articleContent: {
    // Let content take natural height so engagement bar sits right below
    flex: 1,
    paddingRight: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
    lineHeight: 30,
  },
  body: {
    fontSize: 18,
    lineHeight: 28,
    color: '#333',
  },
  engagementBar: {
    paddingLeft: 0,
    paddingRight: 15,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 0,
  },
  engagementButton: {
    alignItems: 'flex-end',
    paddingLeft: 0,
  },
  engagementButtonText: {
    color: '#555',
    marginTop: 0,
    fontSize: 0,
  },
  engagementRail: {
    // Remove fixed width so the rail hugs the icons
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 0,
    paddingTop: 0,
    // small gutter between content and icons
    marginLeft: 4,
    gap: 30,
  },
  railDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginHorizontal: 6,
    opacity: 0.6,
  },
  footerEngagement: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    zIndex: 10,
    elevation: 10,
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
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  languagePill: {
    backgroundColor: '#eef2ff',
    color: '#1e3a8a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
    maxHeight: 26,
  },
  // share card composite styles removed
  // previously used bottom promo banner styles removed
});

export default ArticlePage;
