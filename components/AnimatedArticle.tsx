
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Article } from '@/types';
import ArticlePage from './ArticlePage';

interface AnimatedArticleProps {
  article: Article;
  index: number;
  activeIndex: Animated.SharedValue<number>;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  totalArticles: number;
}

const { height } = Dimensions.get('window');

const AnimatedArticle: React.FC<AnimatedArticleProps> = ({
  article,
  index,
  activeIndex,
  onSwipeUp,
  onSwipeDown,
  totalArticles,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === index;
    return {
      transform: [
        { translateY: (index - activeIndex.value) * height },
      ],
      opacity: isActive ? 1 : 0, // Only show the active article
    };
  });

  const gesture = Gesture.Pan()
    .onEnd((event) => {
      if (event.translationY < -50 && event.velocityY < -500) { // Quick flick up
        runOnJS(onSwipeUp)();
      } else if (event.translationY > 50 && event.velocityY > 500) { // Quick flick down
        runOnJS(onSwipeDown)();
      }
    });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <ArticlePage article={article} index={index} totalArticles={totalArticles} />
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    height,
    backgroundColor: 'white',
  },
});

export default AnimatedArticle;
