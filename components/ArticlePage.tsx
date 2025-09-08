
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { Article } from '@/types';
import { Feather, AntDesign } from '@expo/vector-icons';
import { useFonts, Ramabhadra_400Regular } from '@expo-google-fonts/ramabhadra';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import ArticleBottomSheet from './ArticleBottomSheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ViewShot from 'react-native-view-shot';

interface ArticlePageProps {
  article: Article;
  index: number;
  totalArticles: number;
}

const EngagementButton = ({ icon, text, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.engagementButton}>
    {icon}
    <Text style={styles.engagementButtonText}>{text}</Text>
  </TouchableOpacity>
);

const ArticlePage: React.FC<ArticlePageProps> = ({ article, index, totalArticles }) => {
  const [likes, setLikes] = useState(article.likes);
  const [dislikes, setDislikes] = useState(article.dislikes);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const viewShotRef = useRef<ViewShot>(null);

  let [fontsLoaded] = useFonts({
    Ramabhadra_400Regular,
  });

  const handleLike = () => {
    setLikes(likes + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleDislike = () => {
    setDislikes(dislikes + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleComment = () => {
    bottomSheetModalRef.current?.present();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleShare = async () => {
    try {
      // A small limitation: the screenshot will include the engagement bar.
      // This is a trade-off to keep the layout you prefer.
      const uri = await viewShotRef.current.capture();
      await Share.share({ url: uri });
    } catch (error) {
      console.error('Failed to share', error);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  if (!fontsLoaded) {
    return <View />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <View style={styles.container}>
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContentContainer}
          >
            <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
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
                  <View style={styles.brandInfo}>
                    <Text style={styles.brandName}>khabarx</Text>
                    <Text style={styles.brandLocation}>Ranga Reddy (D)</Text>
                  </View>
                </View>
              </ImageBackground>

              <View style={styles.articleArea}>
                <View style={styles.articleContent}>
                  <Text style={[styles.title, { fontFamily: 'Ramabhadra_400Regular' }]}>
                    {article.title}
                  </Text>
                  <Text style={styles.body}>{article.body}</Text>
                </View>

                <View style={styles.engagementBar}>
                  <EngagementButton
                    icon={<AntDesign name="like2" size={24} color="#555" />}
                    text={likes}
                    onPress={handleLike}
                  />
                  <EngagementButton
                    icon={<AntDesign name="dislike2" size={24} color="#555" />}
                    text={dislikes}
                    onPress={handleDislike}
                  />
                  <EngagementButton
                    icon={<Feather name="message-square" size={24} color="#555" />}
                    text={article.comments}
                    onPress={handleComment}
                  />
                  <EngagementButton
                    icon={<Feather name="download" size={24} color="#555" />}
                    text="Save"
                    onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
                  />
                  <EngagementButton
                    icon={<Feather name="share" size={24} color="#555" />}
                    text="Share"
                    onPress={handleShare}
                  />
                </View>
              </View>
            </ViewShot>
          </ScrollView>

          <View style={styles.footerContainer}>
            <View style={styles.footerInfo}>
              <Feather name="clock" size={14} color="#888" />
              <Text style={styles.infoText}>2m ago / {index + 1} of {totalArticles} Pages</Text>
            </View>
          </View>
          <ArticleBottomSheet ref={bottomSheetModalRef} />
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#fff',
  },
  authorName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  authorDesignation: {
    color: '#fff',
    fontSize: 12,
  },
  brandInfo: {
    alignItems: 'flex-end',
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
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#888',
  },
});

export default ArticlePage;
