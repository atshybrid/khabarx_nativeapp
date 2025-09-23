import { WEB_BASE_URL } from '@/config/appConfig';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { useReaction } from '@/hooks/useReaction';
import { Article } from '@/types';
import { Ramabhadra_400Regular, useFonts } from '@expo-google-fonts/ramabhadra';
import { AntDesign, Feather } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
// Removed LinearGradient (no branded card rendering now)
import { useTransliteration } from '@/hooks/useTransliteration';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    Platform,
    Share as RnShare,
    ScrollView,
    StyleSheet,
    Text,
    ToastAndroid,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Prefer static import; add runtime guard below in case native module isn't linked yet
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
};

const EngagementButton = ({ icon, text, onPress, onLongPress, accessibilityLabel, disabled }: EngagementButtonProps) => (
  <TouchableOpacity
    onPress={onPress}
    onLongPress={onLongPress}
    style={[styles.engagementButton, disabled && { opacity: 0.5 }]}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    disabled={disabled}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  >
    {icon}
    {text !== undefined && text !== '' && (
      <Text style={styles.engagementButtonText}>{text}</Text>
    )}
  </TouchableOpacity>
);

const ArticlePage: React.FC<ArticlePageProps> = ({ article, index, totalArticles }) => {
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
    router.push({ 
      pathname: '/comments', 
      params: { 
        shortNewsId: article.id,
        authorId: article.author.id || article.author.name // Use author ID or fallback to name
      } 
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

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
                      <Image source={{ uri: photo }} style={styles.avatarSmall} cachePolicy="memory-disk" />
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
                icon={<AntDesign name="heart" size={24} color={reaction.reaction === 'LIKE' ? '#FF6B6B' : '#C7C7CC'} />}
                text={reaction.likes}
                onPress={handleLike}
                accessibilityLabel={`Like this article. Current likes ${reaction.likes}. ${reaction.reaction === 'LIKE' ? 'Selected' : 'Not selected'}`}
                disabled={reaction.updating || reaction.loading}
              />
              <EngagementButton
                icon={<AntDesign name="frown" size={24} color={reaction.reaction === 'DISLIKE' ? '#FF4757' : '#C7C7CC'} />}
                text={reaction.dislikes}
                onPress={handleDislike}
                accessibilityLabel={`Dislike this article. Current dislikes ${reaction.dislikes}. ${reaction.reaction === 'DISLIKE' ? 'Selected' : 'Not selected'}`}
                disabled={reaction.updating || reaction.loading}
              />
              <EngagementButton
                icon={<Feather name="message-circle" size={24} color="#5B5B5E" />}
                onPress={() => { handleComment(); }}
              />
              <EngagementButton
                icon={<Feather name="bookmark" size={24} color="#5B5B5E" />}
                text="Save"
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              />
              <EngagementButton
                icon={<Feather name="share-2" size={24} color="#5B5B5E" />}
                text="Share"
                onPress={handleShareTap}
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
      {/* Off-screen branded card for sharing */}
      {/* Card composition removed: sharing hero image + real text caption */}
      </ViewShot>
      {/* Off-screen full share composition (no engagement bar, no footer) */}
      <View style={{ position: 'absolute', top: -99999, left: -99999 }} pointerEvents="none">
        <ViewShot ref={fullShareRef} options={{ format: 'jpg', quality: 0.9 }}>
          <View style={{ width, backgroundColor: '#fff' }}>
            <View style={styles.heroContainer}>
              {heroSlides.length > 0 ? (
                heroSlides[slideIndex].type === 'image' ? (
                  <Image source={{ uri: heroSlides[slideIndex].src }} style={styles.heroMedia} cachePolicy="memory-disk" />
                ) : (
                  <Image source={{ uri: heroSlides[slideIndex].src }} style={styles.heroMedia} cachePolicy="memory-disk" />
                )
              ) : (
                <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ color:'#666' }}>No media</Text>
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
              <Text style={[styles.title, fontsLoaded ? { fontFamily: 'Ramabhadra_400Regular' } : null]}>{article.title}</Text>
              <Text style={styles.body}>{article.body}</Text>
            </View>
          </View>
        </ViewShot>
      </View>
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
    backgroundColor: '#f8f8f8',
  },
  heroMedia: {
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
