// CLEAN REBUILD OF ARTICLEPAGE WITH EXACT SCREEN SHARE (SIMPLIFIED)
import { WEB_BASE_URL } from '@/config/appConfig';
import { Colors } from '@/constants/Colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { useReaction } from '@/hooks/useReaction';
import { Article } from '@/types';
import { Ramabhadra_400Regular, useFonts as useFontsRam } from '@expo-google-fonts/ramabhadra';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, InteractionManager, Platform, Share as RnCoreShare, ScrollView, StyleSheet, Text, ToastAndroid, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BRAND_LOGO from '../assets/images/brand_icon_hrci.png';
// NOTE: react-native-share and react-native-view-shot are native modules.
// Importing them at module scope can crash Expo web/SSR bundles.
// We load them lazily only on native platforms.
// Removed WebView composer; user wants exact native screen style capture.

interface ArticlePageProps { article: Article; index: number; totalArticles: number; }
type EngagementButtonProps = { icon: React.ReactNode; text?: number | string; onPress: () => void; disabled?: boolean; };
const EngagementButton = ({ icon, text, onPress, disabled }: EngagementButtonProps) => (
  <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.engagementButton, disabled && { opacity: 0.5 }]} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
    {icon}
    {text !== undefined && text !== '' && (<Text style={styles.engagementButtonText}>{text}</Text>)}
  </TouchableOpacity>
);

const BRAND_TEXT = 'DESH KI DHADKAN KHABAR X';
// Brand banner configuration (easy to tweak)
const BRAND_STRIP_BG = '#000000'; // full black, no transparency
const BRAND_TEXT_SIZE = 18; // brand text size
const BRAND_LOGO_LARGE = 64; // large logo size in banner
const BRAND_STRIP_HEIGHT = 40; // banner strip height under text
// Export tuning
const SHARE_EXPORT_SCALE = 1.6; // multiply output pixels (1.0 = screen size)
// Hero height tuning (EDIT THIS ONE LINE):
// Bigger value = taller image.
// 16:9 => 9/16 (~0.5625)
// Big hero (Waynews-like feel) => ~0.75
const HERO_HEIGHT_RATIO = 0.90;
// Extra fixed pixels added to hero height.
// Set to 30 for +30px, or 0 to disable.
const HERO_HEIGHT_EXTRA_PX = 0;
// Back-compat: older builds referenced these names.
// Keep + actively use them to avoid runtime crashes during Fast Refresh / stale bundles.
const OVERLAY_HERO_RATIO = HERO_HEIGHT_RATIO;
const RUNTIME_HERO_RATIO = HERO_HEIGHT_RATIO;
const MIN_HERO_RATIO = HERO_HEIGHT_RATIO;
const OVERLAY_BODY_WORDS = 60; // number of words to show fully in share image
// Author chip configuration
const AUTHOR_CHIP_VARIANT: string = 'text'; // 'avatar' or 'text'
const AUTHOR_CHIP_POSITION: string = 'top-left'; // 'top-left' or 'bottom-left'
const { width } = Dimensions.get('window');
const { height: windowHeight } = Dimensions.get('window');

// Title colors: stable “random” per article.
// Uses the provided color codes (excluding very light colors that won't be readable on white).
const TITLE_COLOR_PALETTE = [
  '#C62828',
  '#0D1B2A',
  '#1C1C1C',
  '#E65100',
  '#1B5E20',
  '#616161',
] as const;

const ArticlePage: React.FC<ArticlePageProps> = ({ article, index, totalArticles }) => {
  const insets = useSafeAreaInsets();
  const reaction = useReaction({ articleId: article.id });
  const heroRef = useRef<ScrollView>(null);
  const viewShotRef = useRef<any>(null);
  const scrollCaptureRef = useRef<View>(null); // capture content area (title + body) to avoid white screen
  const overlayRef = useRef<View>(null); // overlay capture ref
  const rootRef = useRef<View>(null);
  const [shareMode, setShareMode] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  // Removed titleHeight tracking
  // Note: runtime shows full article; no maxBodyLines needed
  const [loadedImages, setLoadedImages] = useState(0);
  const [overlayHeroLoaded, setOverlayHeroLoaded] = useState(false);
  const [ViewShotComponent, setViewShotComponent] = useState<any>(null);
  const captureRefFnRef = useRef<any>(null);
  // Removed viewShot layout tracking (unused after overlay capture reinstated)
  const { isTabBarVisible, setTabBarVisible } = useTabBarVisibility();
  const { show, hide } = useAutoHideBottomBar(() => setTabBarVisible(true), () => setTabBarVisible(false), { timeout: 5000, minVisible: 500 });
  const lastScrollAtRef = useRef(0); const lastScrollYRef = useRef(0); const scrollThrottle = 200;
  const lastTouchYRef = useRef(0); const lastTouchStartAtRef = useRef(0); const lastTouchMovedRef = useRef(false);
  const [fontsLoaded] = useFontsRam({ Ramabhadra_400Regular });
  // Removed HTML composer state

  // Lazy-load native-only modules without require() (eslint no-require-imports).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    import('react-native-view-shot')
      .then((mod: any) => {
        if (!mounted) return;
        setViewShotComponent(() => mod?.default);
        captureRefFnRef.current = mod?.captureRef;
      })
      .catch(() => {
        // ignore
      });
    return () => {
      mounted = false;
    };
  }, []);

  const heroSlides = useMemo(() => {
    const slides: { type:'image'; src:string }[] = [];
    const imgs = Array.isArray(article.images) && article.images.length ? article.images : (article.image ? [article.image] : []);
    imgs.forEach(u => slides.push({ type:'image', src:u }));
    return slides;
  }, [article.images, article.image]);
  const allHeroImagesLoaded = loadedImages >= heroSlides.length && heroSlides.length > 0;

  useEffect(() => {
    if (heroSlides.length < 2) return; let i = slideIndex;
    const id = setInterval(() => { i = (i + 1) % heroSlides.length; setSlideIndex(i); heroRef.current?.scrollTo({ x: i * width, y:0, animated:true }); }, 3500);
    return () => clearInterval(id);
  }, [heroSlides.length, slideIndex]);

  const relativeTime = useMemo(() => {
    const iso = article.createdAt; if (!iso) return '';
    const d = new Date(iso); if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime(); const mins = Math.floor(diffMs/60000); if (mins < 60) return `${Math.max(1,mins)}m`;
    const hrs = Math.floor(mins/60); if (hrs <= 24) return `${hrs}h`; const days = Math.floor(hrs/24); return `${days} ${days===1?'day':'days'}`;
  }, [article.createdAt]);

  const truncatedTitle = useMemo(() => { const t = article.title || ''; return t.length > 50 ? t.slice(0,50).trimEnd() + '…' : t; }, [article.title]);
  const titleColor = useMemo(() => {
    const key = String((article as any).id ?? article.title ?? '');
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % TITLE_COLOR_PALETTE.length;
    return TITLE_COLOR_PALETTE[idx];
  }, [article]);
  const bodyText = (article as any).body || (article as any).description || '';
  // Runtime renders full body; overlay uses shareBodyText
  // Share-only body: always exactly OVERLAY_BODY_WORDS words, no ellipsis, so all 60 words show
  const shareBodyText = useMemo(() => {
    const words = bodyText.split(/\s+/).filter(Boolean);
    return words.slice(0, OVERLAY_BODY_WORDS).join(' ');
  }, [bodyText]);

  const effectiveRuntimeHeroRatio = Math.max(RUNTIME_HERO_RATIO, MIN_HERO_RATIO);
  const heroHeight = Math.round(width * effectiveRuntimeHeroRatio) + HERO_HEIGHT_EXTRA_PX;
  const overlayHeroHeight = Math.round(width * OVERLAY_HERO_RATIO) + HERO_HEIGHT_EXTRA_PX;
  const isBigHero = effectiveRuntimeHeroRatio >= 0.85 || heroHeight >= Math.round(windowHeight * 0.5);

  // Removed line clamp calculation; content scrolls fully

  const buildSharePayload = () => {
    const fallbackWeb = `${WEB_BASE_URL.replace(/\/$/, '')}/article/${encodeURIComponent(article.id)}`;
    // Prefer shortUrl if provided by backend; fall back to canonicalUrl then constructed web URL
    const shortUrl = (article as any).shortUrl || (article as any).short_url || null;
    const canonical = article.canonicalUrl || fallbackWeb;
    const shareLink = shortUrl || canonical;
    const shareTitle = article.metaTitle || article.title;
    // Only include HTTPS link; WhatsApp won't auto-link custom schemes.
    const message = [shareTitle, `Read: ${shareLink}`].join('\n');
    return { shareTitle, message, shareLink };
  };

  const handleLike = () => { reaction.like(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const handleDislike = () => { reaction.dislike(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
  const handleComment = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };
  const formatCount = useCallback((n?: number) => { const v = typeof n === 'number' ? n : 0; if (v < 1000) return String(v); if (v < 1_000_000) return `${(v/1000).toFixed(v%1000>=100?1:0)}K`; return `${(v/1_000_000).toFixed(v%1_000_000>=100_000?1:0)}M`; }, []);

    const handleShareTap = async () => {
      setShareMode(true);
      try {
        const { shareTitle, message } = buildSharePayload();
        const captureRef = captureRefFnRef.current;
        // Stabilize overlay (3 frames + 80ms)
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
        await new Promise(r => setTimeout(r, 80));
        // Wait hero images or timeout
        const startWait = Date.now();
        while (!(overlayHeroLoaded || allHeroImagesLoaded) && Date.now() - startWait < 1500) await new Promise(r => setTimeout(r, 100));
        await new Promise(r => InteractionManager.runAfterInteractions(() => r(undefined)));
        let capturedUri: string | undefined;
        // Calculate export pixel size
        const win = Dimensions.get('window');
        const exportW = Math.round(win.width * SHARE_EXPORT_SCALE);
        const exportH = Math.round(win.height * SHARE_EXPORT_SCALE);
        if (typeof captureRef === 'function') {
          // 1) Overlay capture png
          if (!capturedUri && overlayRef.current) {
            try { const ov = await captureRef(overlayRef.current, { format:'png', quality:1, result:'tmpfile', width: exportW, height: exportH }); if (ov) capturedUri = ov.startsWith('file://') ? ov : `file://${ov}`; } catch(e){ if(__DEV__) console.warn('[ShareCapture] overlay png', e); }
          }
          // 2) Root png
          if (!capturedUri && rootRef.current) {
            try {
              const r1 = await captureRef(rootRef.current, { format:'png', quality:1, result:'tmpfile', width: exportW, height: exportH });
              if (r1) capturedUri = r1.startsWith('file://') ? r1 : `file://${r1}`;
            } catch(e){ if(__DEV__) console.warn('[ShareCapture] root png', e); }
          }
          // 3) Root jpg fallback
          if (!capturedUri && rootRef.current) {
            try { const r2 = await captureRef(rootRef.current, { format:'jpg', quality:0.95, result:'tmpfile', width: exportW, height: exportH }); if (r2) capturedUri = r2.startsWith('file://') ? r2 : `file://${r2}`; } catch(e){ if(__DEV__) console.warn('[ShareCapture] root jpg', e); }
          }
          // 4) Hero fallback (last resort)
          if (!capturedUri && heroRef.current) {
            try {
              const hu = await captureRef(heroRef.current, { format:'jpg', quality:0.9, result:'tmpfile' });
              if (hu) capturedUri = hu.startsWith('file://') ? hu : `file://${hu}`;
            } catch(e){ if(__DEV__) console.warn('[ShareCapture] hero', e); }
          }
        }
        // Copy caption
        try { await Clipboard.setStringAsync(message); if (Platform.OS==='android') ToastAndroid.show('Caption copied', ToastAndroid.SHORT); } catch {}
        // Share with caption preferred (react-native-share), then expo-sharing, then text-only
        if (capturedUri) {
          try {
            // 1) Try react-native-share to attach image + caption
            try {
              if (Platform.OS !== 'web') {
                const mod: any = await import('react-native-share').catch(() => null);
                const nativeShare = mod?.default;
                if (nativeShare?.open) {
                  await nativeShare.open({ title: shareTitle, message, url: capturedUri, type: 'image/png', failOnCancel: false });
                  return;
                }
              }
            } catch {
              // fall through
            }
            // 2) Fallback to expo-sharing (image only)
            try {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(capturedUri, { mimeType: 'image/png', dialogTitle: shareTitle });
                return;
              }
            } catch {}
            // 3) Final fallback: RN core Share text-only
            try {
              await RnCoreShare.share({ title: shareTitle, message }, { dialogTitle: 'Share article' });
              return;
            } catch {}
          } catch(err){ console.warn('[Share] image+caption share failed -> text fallback', err); }
        }
        // Text-only fallback
        await RnCoreShare.share({ title:shareTitle, message }, { dialogTitle:'Share article' });
      } catch(err) {
        console.error('[Share] failed', err);
      } finally {
        setShareMode(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    };

  return (
    <View style={styles.container} ref={rootRef} collapsable={false}>
      {shareMode && (
        <View style={[styles.shareOverlay, { pointerEvents: 'none' }]} ref={overlayRef} collapsable={false}>
          <View style={[styles.overlayHero, { height: overlayHeroHeight }]} collapsable={false}>
            {heroSlides[0] ? (
              <Image
                source={{ uri: heroSlides[0].src }}
                style={styles.overlayHeroImage}
                cachePolicy="memory-disk"
                contentFit="cover"
                onLoad={(event) => {
                  setOverlayHeroLoaded(true);
                }}
              />
            ) : (
              <View style={styles.overlayHeroFallback}><Text style={{ color:'#666' }}>No media</Text></View>
            )}
            {article.author ? (() => { const a: any = article.author || {}; const fullName: string = a.fullName || a.name || 'Reporter'; const photo: string | null = a.profilePhotoUrl || a.avatar || null; const place: string | null = a.placeName || null; const initials = fullName.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join(''); const posStyle = AUTHOR_CHIP_POSITION === 'bottom-left' ? { top: undefined as any, bottom: 10 } : null; return (
              <View style={[styles.overlayAuthorChip, posStyle, { pointerEvents: 'none' }]}
              >
                {AUTHOR_CHIP_VARIANT === 'avatar' ? (
                  photo ? <Image source={{ uri: photo }} style={styles.overlayAuthorChipAvatar} /> : <View style={[styles.overlayAuthorChipAvatar, styles.avatarFallbackSmall]}><Text style={styles.avatarInitialsSmall}>{initials || 'R'}</Text></View>
                ) : null}
                <Text style={styles.overlayAuthorChipText} numberOfLines={1}>{fullName}{place ? ` • ${place}` : ''}</Text>
              </View>
            ); })() : null}
            <View style={[styles.overlayBrandBanner, { pointerEvents: 'none' }]}>
              <Text style={styles.overlayBrandText} numberOfLines={1}>{BRAND_TEXT}</Text>
              <Image source={BRAND_LOGO} style={styles.overlayBrandLogo} contentFit="contain" />
            </View>
          </View>
          <View style={[styles.overlayPadded, { flex:1 }]}>
            <Text style={[styles.title, { color: titleColor }, fontsLoaded ? { fontFamily:'Ramabhadra_400Regular' } : null]} numberOfLines={2}>{truncatedTitle}</Text>
            <Text style={styles.body}>{shareBodyText}</Text>
            <View style={styles.overlayFooter}>
              <Text style={styles.infoText}>{relativeTime} • {index + 1} of {totalArticles}</Text>
              <Text style={styles.categoryPill}>{article.category || 'General'}</Text>
            </View>
          </View>
        </View>
      )}
      {(() => {
        const Wrapper: any = ViewShotComponent || View;
        const wrapperProps: any = ViewShotComponent
          ? { ref: viewShotRef, options: { format: 'jpg', quality: 0.9, snapshotContentContainer: true }, style: { flex: 1 } }
          : { style: { flex: 1 } };
        return (
          <Wrapper {...wrapperProps}>
            <View style={{ flex:1 }} collapsable={false}>
          {/* Replace author section with brand card when sharing */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContentContainer}
          scrollEnabled={false}
          onScroll={(e) => {
            const now = Date.now(); const y = e.nativeEvent.contentOffset.y; const dy = y - (lastScrollYRef.current||0); lastScrollYRef.current = y;
            if (isTabBarVisible && dy > 1) { hide(); setTabBarVisible(false); return; }
            if (Math.abs(dy) < 12) return; if (now - (lastScrollAtRef.current||0) > scrollThrottle) { lastScrollAtRef.current = now; hide(); setTabBarVisible(false); }
          }}
          scrollEventThrottle={16}
        >
          <View style={[styles.heroContainer, { height: heroHeight }]}>
            {heroSlides.length === 0 && (
              <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><Text style={{ color:'#666' }}>No media</Text></View>
            )}
            <ScrollView ref={heroRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e)=>{ const i = Math.round(e.nativeEvent.contentOffset.x / width); setSlideIndex(i); }}>
              {heroSlides.map((s,i)=>(
                <View key={`${s.type}-${i}`} style={{ width, height: heroHeight }}>
                  <Image
                    source={{ uri: s.src }}
                    style={styles.heroMediaImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    onLoad={(event) => {
                      setLoadedImages(v => v + 1);
                    }}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={styles.header}>
              {article.author ? (() => {
                const a: any = article.author || {}; const fullName: string = a.fullName || a.name || 'Reporter'; const photo: string | null = a.profilePhotoUrl || a.avatar || null; const role: string | null = a.roleName || null; const place: string | null = a.placeName || null; const initials = fullName.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join(''); const humanRole = role ? role.replace(/_/g,' ').toLowerCase().replace(/\b([a-z])/g,m=>m.toUpperCase()) : null;
                return (
                  <View style={styles.authorCompact}>
                    {photo ? <Image source={{ uri: photo }} style={styles.avatarSmallImg} cachePolicy="memory-disk" /> : <View style={[styles.avatarSmallImg, styles.avatarFallbackSmall]}><Text style={styles.avatarInitialsSmall}>{initials || 'R'}</Text></View>}
                    <Text style={styles.authorNameCompact} numberOfLines={1}>{fullName}</Text>
                    {humanRole && <Text style={styles.roleTiny} numberOfLines={1}>{humanRole}</Text>}
                    {place && <View style={styles.dotSep} />}
                    {place && <Text style={styles.placeTiny} numberOfLines={1}>{place}</Text>}
                  </View>
                );
              })() : <View />}
            </View>
            {shareMode && (
              <View style={[styles.brandBanner, { pointerEvents: 'none' }]}>
                <Text style={styles.brandBannerText} numberOfLines={1}>{BRAND_TEXT}</Text>
                <Image source={BRAND_LOGO} style={styles.brandBannerLogo} contentFit="contain" />
              </View>
            )}
          </View>
          <View style={[styles.articleArea, isBigHero && styles.articleAreaCompact, shareMode && styles.hiddenDuringShare]} ref={scrollCaptureRef}
            onTouchStart={(e)=>{ lastTouchYRef.current = e.nativeEvent.pageY; lastTouchStartAtRef.current = Date.now(); lastTouchMovedRef.current=false; }}
            onTouchMove={(e)=>{ const y = e.nativeEvent.pageY; const dy = y - (lastTouchYRef.current||y); if (Math.abs(dy)>2) lastTouchMovedRef.current=true; lastTouchYRef.current=y; if (isTabBarVisible && dy<-2){ hide(); setTabBarVisible(false);} }}
            onTouchEnd={()=>{ const dt = Date.now() - (lastTouchStartAtRef.current||0); const isTap = !lastTouchMovedRef.current && dt<300; if (isTap){ if (isTabBarVisible){ hide(); setTabBarVisible(false);} else { show(); setTabBarVisible(true);} } }}
          >
            <Text style={[styles.title, { color: titleColor }, isBigHero && styles.titleCompact, fontsLoaded ? { fontFamily:'Ramabhadra_400Regular' } : null]} numberOfLines={2}>{truncatedTitle}</Text>
            <Text style={[styles.body, isBigHero && styles.bodyCompact]}>{shareBodyText}</Text>
          </View>
        </ScrollView>
        <View style={[styles.footerContainer, { paddingBottom: insets.bottom + 8 }, shareMode && styles.hiddenDuringShare]}>
          <View style={styles.footerInfo}>
            <View style={styles.footerLeft}><Feather name="clock" size={14} color="#888" /><Text style={styles.infoText}>{relativeTime} • {index + 1} of {totalArticles}</Text></View>
            <Text numberOfLines={1} style={styles.categoryPill}>{article.category || 'General'}</Text>
          </View>
          {!shareMode && (
            <View style={styles.footerEngagement}>
              <EngagementButton icon={<Feather name="thumbs-up" size={24} color={reaction.reaction==='LIKE' ? '#fa7c05' : '#555'} />} text={formatCount(reaction.likes)} onPress={handleLike} disabled={reaction.updating || reaction.loading} />
              <EngagementButton icon={<Feather name="thumbs-down" size={24} color={reaction.reaction==='DISLIKE' ? '#fa7c05' : '#555'} />} text={formatCount(reaction.dislikes)} onPress={handleDislike} disabled={reaction.updating || reaction.loading} />
              <EngagementButton icon={<Feather name="message-circle" size={24} color="#555" />} text={formatCount((article as any).commentsCount)} onPress={handleComment} />
              <EngagementButton icon={<Feather name="share-2" size={24} color="#555" />} onPress={handleShareTap} />
            </View>
          )}
        </View>
            </View>
          </Wrapper>
        );
      })()}
      {/* Removed WebView composer */}
    </View>
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#fff' },
  // Overlay styles
  shareOverlay:{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#fff', zIndex:60, paddingTop:8, paddingBottom:16 },
  overlayPadded:{ paddingHorizontal:16 },
  overlayAuthorCard:{ flexDirection:'row', alignItems:'center', padding:6, borderWidth:1, borderColor:'#eee', borderRadius:12, backgroundColor:'#fff', marginBottom:6 },
  overlayAuthorAvatar:{ width:36, height:36, borderRadius:18, backgroundColor:'#eee', marginRight:10 },
  overlayAuthorName:{ fontSize:15, fontWeight:'700', color:'#111' },
  overlayAuthorPlace:{ fontSize:11, color:'#666', marginTop:1 },
  overlayAuthorChip:{ position:'absolute', top:10, left:10, flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:10, borderRadius:14, backgroundColor:'#fff', elevation:3 },
  overlayAuthorChipAvatar:{ width:26, height:26, borderRadius:13, backgroundColor:'#eee', marginRight:8 },
  overlayAuthorChipText:{ fontSize:12, color:'#111', maxWidth: width * 0.6 },
  overlayHero:{ width:'100%', backgroundColor:'#000', position:'relative', marginBottom:18 },
  overlayHeroImage:{ width:'100%', height:'100%', resizeMode:'cover' },
  overlayHeroFallback:{ flex:1, alignItems:'center', justifyContent:'center' },
  overlayBrandBanner:{ position:'absolute', left:0, right:0, bottom:0, height: BRAND_STRIP_HEIGHT, backgroundColor: BRAND_STRIP_BG, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16 },
  overlayBrandText:{ color:'#fff', fontSize: BRAND_TEXT_SIZE, fontWeight:'600', marginRight:10, flex:1 },
  overlayBrandLogo:{ width: BRAND_LOGO_LARGE, height: BRAND_LOGO_LARGE },
  overlayFooter:{ marginTop:'auto', flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingTop:10, borderTopWidth:1, borderTopColor:'#eee' },
  hiddenDuringShare:{ opacity:0 },
  shareCaptureLayer:{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#fff', zIndex:20 },
  shareCaptureInner:{ flex:1, flexDirection:'column', paddingTop:14, paddingBottom:16 },
  authShareCard:{ flexDirection:'row', alignItems:'center', padding:12, borderWidth:1, borderColor:'#eee', borderRadius:14, backgroundColor:'#fff', marginBottom:12 },
  authShareAvatar:{ width:54, height:54, borderRadius:27, backgroundColor:'#eee', marginRight:14 },
  avatarInitialsLarge:{ fontSize:18, fontWeight:'600', color:'#444' },
  authShareName:{ fontSize:19, fontWeight:'700', color:'#111' },
  authSharePlace:{ fontSize:14, color:'#666', marginTop:2 },
  shareHeroFullWidth:{ width:'100%', height: width*0.6, backgroundColor:'#000', marginBottom:14, position:'relative' },
  shareHeroImageEdge:{ width:'100%', height:'100%', resizeMode:'cover' },
  shareHeroFallback:{ flex:1, alignItems:'center', justifyContent:'center' },
  brandBanner:{ position:'absolute', left:0, right:0, bottom:0, height: BRAND_STRIP_HEIGHT, backgroundColor: BRAND_STRIP_BG, flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:14 },
  brandBannerText:{ color:'#fff', fontSize: BRAND_TEXT_SIZE, fontWeight:'600', marginRight:10, flex:1 },
  brandBannerLogo:{ width: BRAND_LOGO_LARGE, height: BRAND_LOGO_LARGE },
  shareContent:{ paddingHorizontal:0, paddingBottom:8 },
  shareFooterPinned:{ marginTop:'auto', flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:8, borderTopWidth:1, borderTopColor:'#eee', backgroundColor:'#fff' },
  brandCardHeader:{ flexDirection:'row', alignItems:'center', backgroundColor:'#fff', paddingHorizontal:10, paddingVertical:6, borderRadius:12, borderWidth:1, borderColor:'#eee' },
  brandLogoHeader:{ width:40, height:40, borderRadius:8, marginRight:10 },
  brandTextHeader:{ fontSize:14, fontWeight:'600', color:'#111', flexShrink:1 },
  scrollContainer:{ flex:1 },
  scrollContentContainer:{ paddingBottom:0 },
  heroContainer:{ width:'100%', backgroundColor:'#f8f8f8', overflow:'hidden' },
  heroMediaImage:{ width:'100%', height:'100%', backgroundColor:'#f2f2f2' },
  header:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end', padding:10 },
  authorCompact:{ flexDirection:'row', alignItems:'center', gap:6, maxWidth:'92%' },
  avatarSmallImg:{ width:26, height:26, borderRadius:13, backgroundColor:'#eee' },
  avatarFallbackSmall:{ alignItems:'center', justifyContent:'center' },
  avatarInitialsSmall:{ fontSize:11, fontWeight:'600', color:'#444' },
  authorNameCompact:{ fontSize:13, fontWeight:'600', color:'#222', maxWidth:120 },
  roleTiny:{ fontSize:11, color:'#666', maxWidth:90 },
  dotSep:{ width:4, height:4, borderRadius:2, backgroundColor:'#bbb' },
  placeTiny:{ fontSize:11, color:'#666', maxWidth:90 },
  // Removed top brand banner styles
  articleArea:{ flexDirection:'column', padding:15, backgroundColor:'#fff' },
  articleAreaCompact:{ paddingHorizontal:14, paddingTop:10, paddingBottom:8 },
  // Base color isn't used when titleColor is applied, but keep it non-black anyway.
  title:{ fontSize:24, fontWeight:'bold', marginBottom:10, color: Colors.light.primary },
  titleCompact:{ fontSize:23, marginBottom:8 },
  body:{ fontSize:18, lineHeight:28, color:'#333' },
  bodyCompact:{ fontSize:17, lineHeight:26 },
  footerContainer:{ backgroundColor:'#fff' },
  footerInfo:{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:4, borderTopWidth:1, borderTopColor:'#eee', justifyContent:'space-between' },
  footerLeft:{ flexDirection:'row', alignItems:'center', gap:8 },
  infoText:{ fontSize:11, color:'#888' },
  categoryPill:{ maxWidth:'50%', backgroundColor:'#f3f4f6', color:'#444', paddingHorizontal:10, paddingVertical:2, borderRadius:10, fontSize:11 },
  footerEngagement:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:10, gap:12 },
  engagementButton:{ flexDirection:'row', alignItems:'center', paddingVertical:4, paddingHorizontal:8, borderRadius:8 },
  engagementButtonText:{ color:'#555', marginLeft:6, fontSize:11 },
});

export default ArticlePage;
// Removed escapeHtml helper (unused after composer removal)
