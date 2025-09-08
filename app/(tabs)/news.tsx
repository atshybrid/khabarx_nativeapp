
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';
import { sampleArticles } from '@/data/sample-articles';
import AnimatedArticle from '@/components/AnimatedArticle';

const NewsScreen = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexShared = useSharedValue(0);

  const handleSwipeUp = () => {
    if (activeIndex < sampleArticles.length - 1) {
      const newIndex = activeIndex + 1;
      setActiveIndex(newIndex);
      activeIndexShared.value = withSpring(newIndex);
    }
  };

  const handleSwipeDown = () => {
    if (activeIndex > 0) {
      const newIndex = activeIndex - 1;
      setActiveIndex(newIndex);
      activeIndexShared.value = withSpring(newIndex);
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {sampleArticles.map((article, index) => (
          <AnimatedArticle
            key={article.id}
            article={article}
            index={index}
            activeIndex={activeIndexShared}
            onSwipeUp={handleSwipeUp}
            onSwipeDown={handleSwipeDown}
            totalArticles={sampleArticles.length}
          />
        ))}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default NewsScreen;
