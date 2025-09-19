import AnimatedArticle from '@/components/AnimatedArticle';
import { ArticleSkeleton } from '@/components/ui/ArticleSkeleton';
import { useCategory } from '@/context/CategoryContext';
// import { sampleArticles } from '@/data/sample-articles';
import { getNews } from '@/services/api';
import type { Article } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';

const NewsScreen = () => {
  useEffect(() => {
    console.log('[NAV] ArticleScreen (news) mounted');
  }, []);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexShared = useSharedValue(0);
  const [articles, setArticles] = useState<Article[]>([]);
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
    }
  };

  useEffect(() => {
    const map: Record<string, string> = {
      top: 'Top',
      india: 'India',
      world: 'World',
      business: 'Business',
      tech: 'Technology',
      sports: 'Sports',
      ent: 'Entertainment',
    };
    // Treat "Top" as the default, i.e. no filter
    const mapped = selectedCategory ? (map[selectedCategory] || selectedCategory) : undefined;
    const filterKey = mapped && mapped.toLowerCase() === 'top' ? undefined : mapped;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const stored = await AsyncStorage.getItem('selectedLanguage');
        const lang = stored ? JSON.parse(stored)?.code ?? 'en' : 'en';
        const list = await getNews(lang, filterKey || undefined);
        const safe = Array.isArray(list) ? list : [];
        // If API doesn't filter by category, filter client-side as a fallback
        let filtered = filterKey
          ? safe.filter((a) => (a.category || '').toLowerCase().includes(filterKey.toLowerCase()))
          : safe;
        // Avoid an empty UI: if nothing matches the filter, show the full list
        if (filterKey && filtered.length === 0) {
          console.warn('[News] No items matched category filter, showing all');
          filtered = safe;
        }
        setArticles(filtered);
        console.log('[News] articles loaded:', filtered.length);
      } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.warn('Failed to load news', msg);
          setError(msg || 'Failed to load news');
        setArticles([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedCategory]);

  const handleSwipeUp = () => {
  if (activeIndex < articles.length - 1) {
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
    <View style={styles.container} onLayout={onLayout}>
      {showCongrats && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
          <LottieView source={require('@/assets/lotti/congratulation.json')} autoPlay loop={false} style={{ width: 320, height: 320 }} />
        </View>
      )}
      <View style={styles.container}>
        {loading && (
          <ArticleSkeleton />
        )}
        {!loading && !error && articles.map((article, index) => (
          <AnimatedArticle
            key={article.id}
            article={article}
            index={index}
            activeIndex={activeIndexShared}
            onSwipeUp={handleSwipeUp}
            onSwipeDown={handleSwipeDown}
            totalArticles={articles.length}
            forceVisible={index === 0}
            pageHeight={pageHeight}
          />
        ))}
        {!loading && error && (
          <View style={{ flex: 1 }} />
        )}
        {__DEV__ && (
          <View style={styles.debugOverlay} pointerEvents="none">
            <Text style={styles.debugText}>articles: {articles.length} | activeIndex: {activeIndex}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
