
import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Article } from '@/types';
import { getNews } from '@/services/api';
import { TabBarVisibilityContext } from '@/context/TabBarVisibilityContext';
import { useRouter } from 'expo-router';
import ArticleListItem from '@/components/ui/ArticleListItem';

export default function HomeScreen() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setTabBarVisible } = useContext(TabBarVisibilityContext);
  const router = useRouter();

  useEffect(() => {
    setTabBarVisible(true);
    getNews('en')
      .then(response => {
        setArticles(response);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleArticlePress = (articleId: string) => {
    setTabBarVisible(false);
    router.push(`/article/${articleId}`);
  };

  if (loading) {
    return <ActivityIndicator size="large" style={styles.center} />;
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={articles}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <ArticleListItem
          article={item}
          onPress={() => handleArticlePress(item.id)}
        />
      )}
      contentContainerStyle={styles.listContainer}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
  },
  listContainer: {
    paddingVertical: 8,
  },
});
