
import { AntDesign } from '@expo/vector-icons';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
    Dimensions,
    Image,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#032557',
  secondary: '#fa7c05',
  white: '#FFFFFF',
  black: '#000000',
  darkGray: '#444',
  mediumGray: '#888',
  lightGray: '#EAEAEA',
  danger: '#FF6347',
  overlay: 'rgba(0,0,0,0.5)',
};

const SIZES = {
  base: 8,
  font: 14,
  h2: 24,
  body: 17,
  avatar: 40,
  icon: 24,
};

const FONTS = {
  h2: { fontSize: SIZES.h2, fontWeight: 'bold' as const, color: COLORS.black },
  body: { fontSize: SIZES.body, lineHeight: SIZES.body * 1.6, color: COLORS.darkGray },
  author: { fontSize: SIZES.font, fontWeight: '600' as const, color: COLORS.white },
  meta: { fontSize: SIZES.font - 2, color: COLORS.lightGray },
};

interface ArticleDetailCardProps {
  title: string;
  body: string;
  imageUrl: string;
  authorName: string;
  authorAvatar?: string | null;
  date: string;
  onAuthorPress: (authorId: string) => void;
}

const ArticleDetailCard = forwardRef<any, ArticleDetailCardProps>(function ArticleDetailCard(
  {
    title,
    body,
    imageUrl,
    authorName,
    authorAvatar,
    date,
    onAuthorPress,
  },
  ref
) {
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  const handleAction = (action: Function, state: boolean, setState: Function) => {
    action();
    setState(!state);
  };

  const shareAsImage = async () => {
    try {
      const capture = viewShotRef.current?.capture?.bind(viewShotRef.current);
      const uri = capture ? await capture() : undefined;
      if(uri){
        await Share.share({ url: uri, title: title });
      } else {
          throw new Error("Failed to capture view");
      }
    } catch (error) {
      console.error("Sharing Error:", error);
      await Share.share({ message: `${title} - Read more on News2Day` });
    }
  };
  
  useImperativeHandle(ref, () => ({ shareAsImage }));

  return (
    <View style={styles.container}>
      <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
        <View style={{ backgroundColor: COLORS.white }}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl || '' }} style={styles.image} />
            <View style={styles.authorOverlay}>
              <TouchableOpacity onPress={() => onAuthorPress('author-id')} style={styles.authorPressable}>
                <Image source={{ uri: authorAvatar || '' }} style={styles.avatar} />
                <View>
                  <Text style={styles.authorName}>{authorName}</Text>
                  <Text style={styles.metaText}>{`Published on ${date}`}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.contentContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        </View>
      </ViewShot>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => handleAction(() => { if (isDisliked) setIsDisliked(false); }, isLiked, setIsLiked)} style={styles.actionButton}>
          <AntDesign name={isLiked ? "like" : "like"} size={SIZES.icon} color={isLiked ? COLORS.primary : COLORS.mediumGray} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleAction(() => { if (isLiked) setIsLiked(false); }, isDisliked, setIsDisliked)} style={styles.actionButton}>
          <AntDesign name={isDisliked ? "dislike" : "dislike"} size={SIZES.icon} color={isDisliked ? COLORS.danger : COLORS.mediumGray} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsFavorite(!isFavorite)} style={styles.actionButton}>
          <AntDesign name={isFavorite ? "star" : "star"} size={SIZES.icon} color={isFavorite ? '#FFD700' : COLORS.mediumGray} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {}} style={styles.actionButton}>
          <AntDesign name="message" size={SIZES.icon} color={COLORS.mediumGray} />
        </TouchableOpacity>
        <TouchableOpacity onPress={shareAsImage} style={styles.actionButton}>
          <AntDesign name="share-alt" size={SIZES.icon} color={COLORS.mediumGray} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Set display name for better DevTools visibility
(ArticleDetailCard as any).displayName = 'ArticleDetailCard';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  imageContainer: {
    width: '100%',
    height: width * 0.8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  authorOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.overlay,
    padding: SIZES.base * 2,
  },
  authorPressable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: SIZES.avatar,
    height: SIZES.avatar,
    borderRadius: SIZES.avatar / 2,
    marginRight: SIZES.base * 1.5,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  authorName: {
    ...FONTS.author,
  },
  metaText: {
    ...FONTS.meta,
  },
  contentContainer: {
    padding: SIZES.base * 2,
  },
  title: {
    ...FONTS.h2,
    marginBottom: SIZES.base * 1.5,
  },
  body: {
    ...FONTS.body,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: SIZES.base,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  actionButton: {
    padding: SIZES.base,
  },
});

export default ArticleDetailCard;
