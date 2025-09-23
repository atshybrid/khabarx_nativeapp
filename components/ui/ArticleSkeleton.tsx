import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Skeleton } from './Skeleton';

const { width } = Dimensions.get('window');
const HERO_HEIGHT = width * 0.8;

export const ArticleSkeleton: React.FC = () => {
  return (
    <View style={styles.screen}>
      {/* Hero area */}
      <View style={styles.heroWrap}>
        <Skeleton width={'100%'} height={HERO_HEIGHT} />
        {/* Author overlay */}
        <View style={styles.authorOverlay}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={{ width: 8 }} />
          <View>
            <Skeleton width={120} height={14} borderRadius={6} />
            <View style={{ height: 6 }} />
            <Skeleton width={80} height={12} borderRadius={6} />
          </View>
        </View>
        {/* Dots indicator */}
        <View style={styles.dotsRow}>
          <Skeleton width={8} height={8} borderRadius={4} />
          <View style={{ width: 6 }} />
          <Skeleton width={8} height={8} borderRadius={4} />
          <View style={{ width: 6 }} />
          <Skeleton width={8} height={8} borderRadius={4} />
        </View>
      </View>

      {/* Article content area */}
      <View style={styles.articleArea}>
        <View style={styles.articleContent}>
          {/* Title */}
          <Skeleton width={'85%'} height={26} borderRadius={8} />
          <View style={{ height: 10 }} />
          {/* Body lines */}
          <Skeleton width={'95%'} height={14} />
          <View style={{ height: 6 }} />
          <Skeleton width={'92%'} height={14} />
          <View style={{ height: 6 }} />
          <Skeleton width={'88%'} height={14} />
          <View style={{ height: 6 }} />
          <Skeleton width={'90%'} height={14} />
          <View style={{ height: 6 }} />
          <Skeleton width={'80%'} height={14} />
        </View>
        {/* Engagement bar */}
        <View style={styles.engagementBar}>
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={28} height={10} borderRadius={5} />
          <View style={{ height: 12 }} />
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={28} height={10} borderRadius={5} />
          <View style={{ height: 12 }} />
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={28} height={10} borderRadius={5} />
          <View style={{ height: 12 }} />
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={28} height={10} borderRadius={5} />
          <View style={{ height: 12 }} />
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={28} height={10} borderRadius={5} />
        </View>
      </View>

      {/* Footer info bar */}
      <View style={styles.footerContainer}>
        <View style={styles.footerInfo}>
          <Skeleton width={14} height={14} borderRadius={7} />
          <View style={{ width: 8 }} />
          <Skeleton width={180} height={12} borderRadius={6} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  heroWrap: {
    width: '100%',
    height: HERO_HEIGHT,
    position: 'relative',
    backgroundColor: '#000',
  },
  authorOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  articleArea: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
  },
  articleContent: {
    flex: 1,
  },
  engagementBar: {
    paddingLeft: 15,
    alignItems: 'center',
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
  },
});

export default ArticleSkeleton;
