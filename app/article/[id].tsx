
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import ArticleDetailCard from '@/components/ui/ArticleDetailCard';
import { Article } from '@/types';
import { getArticleById } from '@/services/api';


export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <ScrollView style={styles.container}>
      <ArticleDetailCard
        title={article.title}
        body={article.body}
        imageUrl={article.image}
        authorName={article.author.name}
        authorAvatar={article.author.avatar}
        date={new Date(article.createdAt).toLocaleDateString()}
        onAuthorPress={() => {
          // Implement author press navigation if needed
          console.log(`Navigate to author screen for ID: ${article.author.id}`);
        }}
      />
    </ScrollView>
  );
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
