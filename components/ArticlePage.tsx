
import { Article } from '@/types';
import { Ramabhadra_400Regular, useFonts } from '@expo-google-fonts/ramabhadra';
import { AntDesign, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  ImageBackground,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// Bottom sheet removed for full page navigation
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { useRouter } from 'expo-router';
import ViewShot from 'react-native-view-shot';

interface ArticlePageProps {
  article: Article;
  index: number;
  totalArticles: number;
}

type EngagementButtonProps = {
  icon: React.ReactNode;
  text?: number | string;
  onPress: () => void;
};

const EngagementButton = ({ icon, text, onPress }: EngagementButtonProps) => (
  <TouchableOpacity onPress={onPress} style={styles.engagementButton}>
    {icon}
    {text !== undefined && text !== '' && (
      <Text style={styles.engagementButtonText}>{text}</Text>
    )}
  </TouchableOpacity>
);

const ArticlePage: React.FC<ArticlePageProps> = ({ article, index, totalArticles }) => {
  const router = useRouter();
  const [likes, setLikes] = useState<number>(article.likes ?? 0);
  const [dislikes, setDislikes] = useState<number>(article.dislikes ?? 0);
  const viewShotRef = useRef<ViewShot>(null);
  const { isTabBarVisible, setTabBarVisible } = useTabBarVisibility();
  const { show, hide } = useAutoHideBottomBar(
    () => setTabBarVisible(true),
    () => setTabBarVisible(false),
    { timeout: 5000, minVisible: 500, debug: true }
  );
  const lastScrollAtRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const scrollThrottle = 200;
  const lastTouchYRef = useRef(0);
  const lastTouchStartAtRef = useRef(0);
  const lastTouchMovedRef = useRef(false);

  const [fontsLoaded] = useFonts({
    Ramabhadra_400Regular,
  });

  const handleLike = () => {
    setLikes((v) => v + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleDislike = () => {
    setDislikes((v) => v + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleComment = () => {
  router.push({ pathname: '/comments', params: { articleId: article.id } });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleShare = async () => {
    try {
      // A small limitation: the screenshot will include the engagement bar.
      // This is a trade-off to keep the layout you prefer.
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Share.share({ url: uri });
      }
    } catch (error) {
      console.error('Failed to share', error);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  if (!fontsLoaded) {
    return <View />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        onScrollBeginDrag={() => { console.log('[Article] onScrollBeginDrag -> hide'); hide(); setTabBarVisible(false); }}
        onScroll={(e) => {
          const now = Date.now();
          const y = e.nativeEvent.contentOffset.y;
          const dy = y - (lastScrollYRef.current || 0);
          lastScrollYRef.current = y;
          // If bar is visible and even a tiny upward swipe (content moves up => dy>0) happens, hide immediately
          if (isTabBarVisible && dy > 1) {
            hide();
            setTabBarVisible(false);
            return;
          }
          // console.log('[Article] onScroll dy=', dy);
          if (Math.abs(dy) < 12) return; // ignore micro scroll noise when bar hidden
          if (now - (lastScrollAtRef.current || 0) > scrollThrottle) {
            lastScrollAtRef.current = now;
            // Hide when swiping (scrolling)
            hide();
            setTabBarVisible(false);
          }
        }}
        scrollEventThrottle={16}
      >
        <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
          <ImageBackground source={{ uri: article.image }} style={styles.image}>
            <View style={styles.header}>
              <View style={styles.authorInfo}>
                <Image source={{ uri: article.author.avatar }} style={styles.avatar} />
                <View>
                  <Text style={styles.authorName}>{article.author.name}</Text>
                  <Text style={styles.authorDesignation}>Sr Reporter, మన రంగారెడ్డి</Text>
                </View>
              </View>
              <View style={styles.brandInfo}>
                <Text style={styles.brandName}>khabarx</Text>
                <Text style={styles.brandLocation}>Ranga Reddy (D)</Text>
              </View>
            </View>
          </ImageBackground>

          <View style={styles.articleArea}>
            <View
              style={styles.articleContent}
              onTouchStart={(e) => {
                lastTouchYRef.current = e.nativeEvent.pageY;
                lastTouchStartAtRef.current = Date.now();
                lastTouchMovedRef.current = false;
              }}
              onTouchMove={(e) => {
                const y = e.nativeEvent.pageY;
                const dy = y - (lastTouchYRef.current || y);
                if (Math.abs(dy) > 2) lastTouchMovedRef.current = true;
                lastTouchYRef.current = y;
                // If visible and user slightly swipes up, hide immediately
                if (isTabBarVisible && dy < -2) {
                  console.log('[Article] small upward glide -> hide');
                  hide();
                  setTabBarVisible(false);
                }
              }}
              onTouchEnd={() => {
                const dt = Date.now() - (lastTouchStartAtRef.current || 0);
                const isTap = !lastTouchMovedRef.current && dt < 300;
                if (isTap) {
                  // Toggle on content tap only
                  if (isTabBarVisible) {
                    hide();
                    setTabBarVisible(false);
                  } else {
                    show();
                    setTabBarVisible(true);
                  }
                }
              }}
            >
              <Text style={[styles.title, { fontFamily: 'Ramabhadra_400Regular' }]}>
                {article.title}
              </Text>
              <Text style={styles.body}>{article.body}</Text>
            </View>
            {/* Engagement bar (does not affect bottom nav visibility) */}
            <View style={styles.engagementBar}>
              <EngagementButton
                icon={<AntDesign name="like2" size={24} color="#555" />}
                text={likes}
                onPress={() => { handleLike(); }}
              />
              <EngagementButton
                icon={<AntDesign name="dislike2" size={24} color="#555" />}
                text={dislikes}
                onPress={() => { handleDislike(); }}
              />
              <EngagementButton
                icon={<Feather name="message-square" size={24} color="#555" />}
                onPress={() => { handleComment(); }}
              />
              <EngagementButton
                icon={<Feather name="download" size={24} color="#555" />}
                text="Save"
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              />
              <EngagementButton
                icon={<Feather name="share" size={24} color="#555" />}
                text="Share"
                onPress={() => { handleShare(); }}
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
