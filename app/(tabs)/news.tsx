import AnimatedArticle from '@/components/AnimatedArticle';
import { ArticleListSkeleton } from '@/components/ui/ArticleListSkeleton';
import { ArticleSkeleton } from '@/components/ui/ArticleSkeleton';
import { Colors } from '@/constants/Colors';
import { useCategory } from '@/context/CategoryContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import AnimatedAd from '../../components/AnimatedAd';
// import { sampleArticles } from '@/data/sample-articles';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { getNewsFeed, resolveEffectiveLanguage } from '@/services/api';
import { on } from '@/services/events';
import type { FeedItem } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
const NEWS_SAFE_MODE = (() => {
  const raw = String(process.env.EXPO_PUBLIC_NEWS_SAFE_MODE ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
})();

const NewsScreen = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { setTabBarVisible } = useTabBarVisibility();
  useEffect(() => {
    console.log('[NAV] ArticleScreen (news) mounted');
  }, []);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexShared = useSharedValue(0);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { selectedCategory } = useCategory();
  const [pageHeight, setPageHeight] = useState<number | undefined>(undefined);
  const lastHeightRef = useRef(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h && Math.abs(h - lastHeightRef.current) > 1) {
      lastHeightRef.current = h;
      setPageHeight(h);
      if (__DEV__) {
        try { console.log('[News] pageHeight set', h); } catch {}
      }
    }
  };

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stored = await AsyncStorage.getItem('selectedLanguage');
      const lang = stored ? JSON.parse(stored)?.code ?? 'en' : 'en';
      try {
        const eff = await resolveEffectiveLanguage();
        console.log('[News] language debug', { storedCode: lang, effId: eff.id, effCode: eff.code, effName: eff.name });
      } catch {}
      const map: Record<string, string> = {
        top: 'Top',
        india: 'India',
        world: 'World',
        business: 'Business',
        tech: 'Technology',
        sports: 'Sports',
        ent: 'Entertainment',
      };
      const mapped = selectedCategory ? (map[selectedCategory] || selectedCategory) : undefined;
      const filterKey = mapped && mapped.toLowerCase() === 'top' ? undefined : mapped;
      const feed = await getNewsFeed(lang, filterKey || undefined);
      const safeItems = Array.isArray(feed.items) ? feed.items : [];
      setItems(safeItems);
      if (__DEV__) {
        try {
          const first = safeItems.length ? safeItems[0] : null;
          console.log('[News] feed loaded:', safeItems.length, 'first kind:', first?.type);
        } catch {}
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('Failed to load news', msg);
  setError(msg || 'Failed to load news');
  setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  // Refresh news when global event is emitted (e.g., login/logout/language change)
  useEffect(() => {
    const off = on('news:refresh', () => {
      if (__DEV__) try { console.log('[News] news:refresh event received → reloading'); } catch {}
      loadNews();
    });
    return () => { try { off(); } catch {} };
  }, [loadNews]);

  const handleSwipeUp = () => {
  if (activeIndex < items.length - 1) {
      const newIndex = activeIndex + 1;
      setActiveIndex(newIndex);
      activeIndexShared.value = withSpring(newIndex);
    }
  };

  const handleSwipeDown = () => {
  if (activeIndex > 0) {
      const newIndex = activeIndex - 1;
      setActiveIndex(newIndex);
      activeIndexShared.value = withSpring(newIndex);
    }
  };

  const [showCongrats, setShowCongrats] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location && window.location.hash.includes('congrats')) {
      setShowCongrats(true);
      setTimeout(() => setShowCongrats(false), 2000);
    }
  }, []);
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} onLayout={onLayout}>
      {showCongrats && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
          <LottieView source={require('@/assets/lotti/congratulation.json')} autoPlay loop={false} style={{ width: 320, height: 320 }} />
        </View>
      )}
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {loading && (
          NEWS_SAFE_MODE ? <ArticleListSkeleton /> : <ArticleSkeleton />
        )}
        {!loading && !error && !NEWS_SAFE_MODE && items.map((it, index) => (
          it.type === 'news' ? (
            <AnimatedArticle
              key={`news_${it.article.id || 'item'}_${index}`}
              article={it.article}
              index={index}
              activeIndex={activeIndexShared}
              onSwipeUp={handleSwipeUp}
              onSwipeDown={handleSwipeDown}
              totalArticles={items.length}
              forceVisible={index === 0}
              pageHeight={pageHeight}
            />
          ) : (
            <AnimatedAd
              key={`ad_${it.ad.id || 'item'}_${index}`}
              ad={it.ad}
              index={index}
              activeIndex={activeIndexShared}
              onSwipeUp={handleSwipeUp}
              onSwipeDown={handleSwipeDown}
              totalItems={items.length}
              forceVisible={index === 0}
              pageHeight={pageHeight}
            />
          )
        ))}
        {!loading && !error && NEWS_SAFE_MODE && (
          <View style={{ flex: 1, padding: 16, gap: 16 }}>
            {items.map((it, i) => (
              it.type === 'news' ? (
                <View key={`${it.article.id}_${i}`} style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, borderRadius: 10, padding: 12 }}>
                  <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }} numberOfLines={2}>{it.article.title || 'Untitled'}</Text>
                  {it.article.body ? (<Text style={{ color: theme.text, opacity: 0.85, marginTop: 6 }} numberOfLines={3}>{it.article.body}</Text>) : null}
                  <Text style={{ color: theme.text, opacity: 0.6, marginTop: 8, fontSize: 12 }}>{it.article.category || 'General'}</Text>
                </View>
              ) : (
                <View key={`ad_${it.ad.id}_${i}`} style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, borderRadius: 10, padding: 12, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ color: theme.text, fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Sponsored</Text>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{it.ad.title || 'Ad'}</Text>
                </View>
              )
            ))}
          </View>
        )}
        {!loading && !error && items.length === 0 && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}
            onPress={() => {
              try { setTabBarVisible(true); } catch {}
            }}
            accessibilityRole="button"
            accessibilityLabel="Open bottom navigation"
          >
            <LottieView
              source={require('@/assets/lotti/Coming Soon.json')}
              autoPlay
              loop
              style={{ width: 320, height: 320 }}
            />
            <Text style={{ marginTop: 6, fontSize: 13, color: theme.text, opacity: 0.6 }}>Tap anywhere to open navigation</Text>
            <TouchableOpacity
              onPress={() => {
                try { setTabBarVisible(true); } catch {}
                try { router.push('/language'); } catch {}
              }}
              style={{ marginTop: 16, backgroundColor: theme.tint, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Change language"
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Change language</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        {!loading && error && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: theme.text, opacity: 0.8, marginBottom: 12 }}>Couldn’t load news ({error}).</Text>
            <TouchableOpacity onPress={loadNews} style={{ backgroundColor: theme.tint, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {__DEV__ && (
          <View style={[styles.debugOverlay, { pointerEvents: 'none' }] }>
            <Text style={styles.debugText}>items: {items.length} | activeIndex: {activeIndex} | safeMode: {String(NEWS_SAFE_MODE)}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    // background is set from theme inline
  },
  debugOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  debugText: { color: '#fff', fontSize: 12 },
});

export default NewsScreen;
