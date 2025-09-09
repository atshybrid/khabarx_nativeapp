
import { Article } from '@/types';
import React from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle } from 'react-native-reanimated';
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
    // Keep the current and adjacent pages rendered during the spring animation
    // to avoid a blank screen when activeIndex is between integers.
    const distance = Math.abs(index - activeIndex.value);
    const translate = Math.round((index - activeIndex.value) * height);
    return {
      transform: [{ translateY: translate }],
      // Show the current and moving neighbor; hide once settled to prevent bleed-through
      opacity: distance < 0.999 ? 1 : 0,
      // Keep the most relevant page on top
      zIndex: distance < 0.5 ? 2 : 1,
    };
  });

  const gesture = Gesture.Pan()
    .activeOffsetY([-20, 20]) // require a more intentional swipe
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
  overflow: 'hidden',
  },
});

export default AnimatedArticle;
