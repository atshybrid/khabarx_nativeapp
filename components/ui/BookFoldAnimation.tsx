import React, { Component } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const Card = ({ text, style }) => (
  <View style={[styles.card, style]}>
    <Text>{text}</Text>
  </View>
);

export default function BookFoldAnimation() {
  const rotate = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      rotate.value = e.translationX;
    })
    .onEnd(() => {
      rotate.value = withSpring(0);
    });

  const leftStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        {
          rotateY: `${rotate.value}deg`,
        },
      ],
    };
  });

  const rightStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { perspective: 1000 },
        {
          rotateY: `${rotate.value}deg`,
        },
      ],
    };
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <View style={styles.book}>
          <Animated.View style={[styles.left, leftStyle]}>
            <Card text="Left Page" />
          </Animated.View>
          <Animated.View style={[styles.right, rightStyle]}>
            <Card text="Right Page" />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  book: {
    width: 300,
    height: 400,
    flexDirection: 'row',
  },
  left: {
    width: '50%',
    height: '100%',
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderColor: 'gray',
  },
  right: {
    width: '50%',
    height: '100%',
    backgroundColor: 'white',
  },
  card: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
