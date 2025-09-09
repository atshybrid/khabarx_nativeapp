
import AnimatedArticle from '@/components/AnimatedArticle';
import { useCategory } from '@/context/CategoryContext';
import { sampleArticles } from '@/data/sample-articles';
import { getNews } from '@/services/api';
import type { Article } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue, withSpring } from 'react-native-reanimated';

const NewsScreen = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexShared = useSharedValue(0);
  const [articles, setArticles] = useState<Article[]>(sampleArticles);
  const { selectedCategory } = useCategory();

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
    const filterKey = selectedCategory ? (map[selectedCategory] || selectedCategory) : undefined;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('selectedLanguage');
        const lang = stored ? JSON.parse(stored)?.code ?? 'en' : 'en';
        const list = await getNews(lang, filterKey || undefined);
        const safe = Array.isArray(list) && list.length ? list : sampleArticles;
        // If API doesn't filter by category, filter client-side as a fallback
        const filtered = filterKey
          ? safe.filter((a) => (a.category || '').toLowerCase().includes(filterKey.toLowerCase()))
          : safe;
        setArticles(filtered.length ? filtered : safe);
      } catch (e) {
        console.warn('Failed to load news; using sample', e);
        const safe = sampleArticles;
        const filtered = filterKey
          ? safe.filter((a) => (a.category || '').toLowerCase().includes(filterKey.toLowerCase()))
          : safe;
        setArticles(filtered.length ? filtered : safe);
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

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
    {articles.map((article, index) => (
          <AnimatedArticle
            key={article.id}
            article={article}
            index={index}
            activeIndex={activeIndexShared}
            onSwipeUp={handleSwipeUp}
            onSwipeDown={handleSwipeDown}
      totalArticles={articles.length}
          />
        ))}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default NewsScreen;
