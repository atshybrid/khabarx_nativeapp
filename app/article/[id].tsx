
import ArticlePage from '@/components/ArticlePage';
import { getArticleById } from '@/services/api';
import { Article } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';


export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle Android hardware back button
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        // Navigate back to news tab safely
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/news');
        }
        return true; // Prevent default behavior
      };

      if (Platform.OS === 'android') {
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
      }
    }, [router])
  );

  useEffect(() => {
    if (id) {
      getArticleById(id)
        .then(response => {
          if (response) {
            setArticle(response);
          } else {
            setError("Article not found.");
          }
        })
        .catch(err => {
          setError(err.message)
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

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

  if (!article) {
    return (
      <View style={styles.center}>
        <Text>Article not found.</Text>
      </View>
    );
  }

  return <ArticlePage article={article} index={0} totalArticles={1} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
  },
});
