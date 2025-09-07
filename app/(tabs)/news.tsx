
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Image } from 'expo-image';
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import ArticleBottomSheet from '@/components/ArticleBottomSheet';
import { getNews } from '@/services/api';
import { Article } from '@/types';

const NewsScreen = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showNav, setShowNav] = useState(true);
  const navOpacity = useRef(new Animated.Value(1)).current;
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    const fetchNews = async () => {
      const news = await getNews('te');
      setArticles(news);
    };
    fetchNews();
  }, []);

  useEffect(() => {
    if (showNav) {
      const timer = setTimeout(() => {
        setShowNav(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showNav]);

  useEffect(() => {
    Animated.timing(navOpacity, {
      toValue: showNav ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showNav]);

  const handlePresentModalPress = (article: Article) => {
    setSelectedArticle(article);
    bottomSheetModalRef.current?.present();
  };

  const renderItem = ({ item }: { item: Article }) => (
    <TouchableOpacity onPress={() => setShowNav(!showNav)}>
      <View style={styles.card}>
        <Image source={{ uri: item.image }} style={styles.image} />
        <View style={styles.authorOverlay}>
          <Image source={{ uri: item.author.avatar }} style={styles.avatar} />
          <Text style={styles.authorName}>{item.author.name}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.summary}>{item.summary}</Text>
        </View>
        <TouchableOpacity
          style={styles.readButton}
          onPress={() => handlePresentModalPress(item)}
        >
          <Text style={styles.readButtonText}>Read</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        <Animated.View style={[styles.topNav, { opacity: navOpacity }]}>
          <Text style={styles.topNavText}>Location News</Text>
          <Text style={styles.topNavText}>Trading News</Text>
        </Animated.View>
        <FlatList
          data={articles}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          onScroll={() => setShowNav(false)}
        />
        <ArticleBottomSheet
          ref={bottomSheetModalRef}
          article={selectedArticle}
        />
        <Animated.View style={[styles.bottomNav, { opacity: navOpacity }]}>
          <Text style={styles.bottomNavText}>Unread</Text>
          <Text style={styles.bottomNavText}>Category</Text>
          <Text style={styles.bottomNavText}>Add Article</Text>
          <Text style={styles.bottomNavText}>Search</Text>
          <Text style={styles.bottomNavText}>Account</Text>
        </Animated.View>
      </View>
    </BottomSheetModalProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  topNavText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#f8f8f8',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  bottomNavText: {
    fontSize: 16,
  },
  card: {
    margin: 10,
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  authorOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 15,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  authorName: {
    color: '#fff',
    fontWeight: 'bold',
  },
  textContainer: {
    padding: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summary: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  readButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
  },
  readButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default NewsScreen;
