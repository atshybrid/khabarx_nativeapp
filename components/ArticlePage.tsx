
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { Article } from '@/types';
import { Feather, AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts, Ramabhadra_400Regular } from '@expo-google-fonts/ramabhadra';
import { Image } from 'expo-image';

interface ArticlePageProps {
  article: Article;
  index: number;
  totalArticles: number;
}

const ArticlePage: React.FC<ArticlePageProps> = ({ article, index, totalArticles }) => {
  let [fontsLoaded] = useFonts({
    Ramabhadra_400Regular,
  });

  if (!fontsLoaded) {
    return <View />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <ImageBackground source={{ uri: article.image }} style={styles.image}>
          <View style={styles.header}>
            <View style={styles.authorInfo}>
              <Image source={{ uri: article.author.avatar }} style={styles.avatar} />
              <View>
                <Text style={styles.authorName}>{article.author.name}</Text>
                <Text style={styles.authorDesignation}>
                  Sr Reporter, మన రంగారెడ్డి
                </Text>
              </View>
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.link}>khabarx</Text>
              <Text style={styles.location}>Ranga Reddy (D)</Text>
            </View>
          </View>
        </ImageBackground>
        <View style={styles.contentContainer}>
          <Text style={[styles.title, { fontFamily: 'Ramabhadra_400Regular' }]}>
            {article.title}
          </Text>
          <Text style={styles.body}>{article.body}</Text>
        </View>
      </ScrollView>
      <View style={styles.footerContainer}>
        <View style={styles.footerInfo}>
          <Feather name="clock" size={14} color="#888" />
          <Text style={styles.infoText}>2m ago / {index + 1} of {totalArticles} Pages</Text>
        </View>
        <View style={styles.footerActions}>
          <View style={styles.actionsLeft}>
            <View style={styles.action}>
              <AntDesign name="like2" size={24} color="#555" />
              <Text style={styles.actionText}>{article.likes}</Text>
            </View>
            <View style={styles.action}>
              <AntDesign name="dislike2" size={24} color="#555" />
              <Text style={styles.actionText}>{article.dislikes}</Text>
            </View>
            <View style={styles.action}>
              <Feather name="message-square" size={24} color="#555" />
              <Text style={styles.actionText}>{article.comments}</Text>
            </View>
          </View>
          <View style={styles.actionsRight}>
            <Feather name="download" size={24} color="#555" />
            <MaterialCommunityIcons name="dots-vertical" size={24} color="#555" />
            <Feather name="share" size={24} color="#007AFF" />
          </View>
        </View>
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
    paddingBottom: 100, // Space for the fixed footer
  },
  image: {
    width: '100%',
    height: width * 0.8,
    justifyContent: 'flex-end',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  authorName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  authorDesignation: {
    color: '#fff',
    fontSize: 14,
  },
  locationInfo: {
    alignItems: 'flex-end',
  },
  link: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  location: {
    color: '#fff',
    fontSize: 14,
  },
  contentContainer: {
    padding: 20,
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
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#888',
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 25,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 25,
  },
});

export default ArticlePage;
