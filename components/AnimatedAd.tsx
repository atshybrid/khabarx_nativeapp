import { VideoWrapper } from '@/components/VideoWrapper';
import type { AdItem } from '@/types';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer } from 'expo-video';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, SharedValue, useAnimatedReaction, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AnimatedAdProps {
  ad: AdItem;
  index: number;
  activeIndex: SharedValue<number>;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  totalItems: number;
  forceVisible?: boolean;
  pageHeight?: number;
}

const AnimatedAd: React.FC<AnimatedAdProps> = ({
  ad,
  index,
  activeIndex,
  onSwipeUp,
  onSwipeDown,
  totalItems,
  forceVisible = false,
  pageHeight,
}) => {
  const { height: windowHeight, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const h = useSharedValue(Dimensions.get('window').height);
  useEffect(() => {
    h.value = pageHeight && pageHeight > 0 ? pageHeight : windowHeight;
  }, [windowHeight, pageHeight, h]);

  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(index - activeIndex.value);
    const translate = Math.round((index - activeIndex.value) * h.value);
    const style: any = {
      transform: [{ translateY: translate }],
      opacity: distance < 1.01 ? 1 : 0,
      zIndex: distance < 0.5 ? 2 : 1,
      elevation: distance < 0.5 ? 2 : 1,
    };
    if (forceVisible) {
      style.opacity = 1;
      style.zIndex = 3;
      style.elevation = 3;
      style.transform = [{ translateY: Math.round((index - activeIndex.value) * h.value) }];
    }
    return style;
  });

  const gesture = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .onEnd((event) => {
      if (event.translationY < -50 && event.velocityY < -500) {
        runOnJS(onSwipeUp)();
      } else if (event.translationY > 50 && event.velocityY > 500) {
        runOnJS(onSwipeDown)();
      }
    });

  const mediaList = useMemo(() => {
    const arr = Array.isArray(ad.mediaUrls) && ad.mediaUrls.length ? ad.mediaUrls : (ad.posterUrl ? [ad.posterUrl] : []);
    return arr.filter(Boolean).map(String);
  }, [ad.mediaUrls, ad.posterUrl]);
  
  // VIDEO support: if mediaType is VIDEO, auto play first media url
  const videoUri = useMemo(() => {
    const mt = String(ad.mediaType || '').toUpperCase();
    if (mt === 'VIDEO' && mediaList.length > 0) return mediaList[0];
    return '';
  }, [ad.mediaType, mediaList]);
  const isVideo = !!videoUri;
  const videoPlayer = useVideoPlayer({ uri: videoUri });
  const [isFocused, setIsFocused] = useState(false);
  // Best-practice fit: default to 'contain' (no crop). Allow backend to override via optional ad.fitMode
  const fitMode: any = ((): 'contain' | 'cover' => {
    const raw = (ad as any)?.fitMode;
    return raw === 'cover' ? 'cover' : 'contain';
  })();

  // Track visibility/focus using the vertical pager's activeIndex
  useAnimatedReaction(
    () => {
      const distance = Math.abs(index - activeIndex.value);
      return distance < 0.5; // effectively the active page
    },
    (visible) => {
      runOnJS(setIsFocused)(!!visible);
    },
    [index]
  );
  // Autoplay on focus, pause when not focused; loop and mute by default
  useEffect(() => {
    if (!isVideo || !videoPlayer) return;
    try {
      (videoPlayer as any)?.setIsMuted?.(true);
      (videoPlayer as any)?.setIsLooping?.(true);
      if (isFocused) {
        // Start (or restart) playback cleanly
        (videoPlayer as any)?.seekTo?.(0);
        (videoPlayer as any)?.play?.();
      } else {
        (videoPlayer as any)?.pause?.();
      }
    } catch {}
  }, [isVideo, videoPlayer, isFocused, videoUri]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { (videoPlayer as any)?.pause?.(); } catch {}
    };
  }, [videoPlayer]);

  // Pause on app going to background; resume on active if focused
  useEffect(() => {
    if (!isVideo) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (!videoPlayer) return;
      try {
        if (state !== 'active') {
          (videoPlayer as any)?.pause?.();
        } else if (isFocused) {
          (videoPlayer as any)?.seekTo?.(0);
          (videoPlayer as any)?.play?.();
        }
      } catch {}
    });
    return () => sub.remove();
  }, [isVideo, videoPlayer, isFocused, videoUri]);
  const [slide, setSlide] = useState(0);
  const scrollerRef = useRef<ScrollView>(null);

  const onPress = () => {
    if (ad.clickUrl && typeof ad.clickUrl === 'string') {
      try { Linking.openURL(ad.clickUrl); } catch {}
    }
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <StatusBar translucent backgroundColor="transparent" style="auto" />
        <View style={[styles.touch, { paddingTop: insets.top, paddingBottom: Math.max(0, insets.bottom) }]}> 
          <View style={styles.mediaBox}>
            {/* Background fill to avoid empty bars while preserving aspect ratio (no crop) */}
            {(() => {
              const bgSrc = isVideo ? (ad.posterUrl || mediaList[0]) : mediaList[0];
              return bgSrc ? (
                <Image
                  source={{ uri: bgSrc }}
                  style={styles.bgFill}
                  contentFit="cover"
                  blurRadius={30}
                />
              ) : null;
            })()}
            {isVideo ? (
              <VideoWrapper
                player={videoPlayer}
                style={styles.storyMedia}
                contentFit={fitMode}
                nativeControls={false}
              />
            ) : (
              mediaList.length <= 1 ? (
                <View style={{ width, height: '100%' }}>
                  {mediaList[0] ? (
                    <Image source={{ uri: mediaList[0] }} style={styles.storyMedia} contentFit={fitMode} recyclingKey={`ad_${ad.id}_0`} />
                  ) : (
                    <View style={[styles.media, styles.mediaPlaceholder]}>
                      <Text style={{ color: '#999' }}>Ad</Text>
                    </View>
                  )}
                </View>
              ) : (
                <ScrollView
                  key={`carousel_${mediaList.length}_${Math.max(1, Math.round(width))}`}
                  ref={scrollerRef}
                  horizontal
                  pagingEnabled
                  scrollEventThrottle={16}
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    if (!width || width < 2) return;
                    const i = Math.round((e.nativeEvent.contentOffset.x || 0) / width);
                    setSlide(Math.max(0, Math.min(i, Math.max(0, mediaList.length - 1))));
                  }}
                >
                  {mediaList.map((src, i) => (
                    <View key={`${ad.id}_media_${i}`} style={{ width, height: '100%' }}>
                      <Image
                        source={{ uri: src }}
                        style={styles.storyMedia}
                        contentFit={fitMode}
                        recyclingKey={`ad_${ad.id}_${i}`}
                      />
                    </View>
                  ))}
                </ScrollView>
              )
            )}
            {/* Overlays on media */}
            <View style={[styles.overlayTopRow]}>
              <Text style={styles.sponsoredPill}>{String((ad as any)?.tagName || (ad as any)?.tag || 'Sponsored Ads')}</Text>
              {!!ad.clickUrl && (
                <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
                  <Text style={styles.ctaPill} numberOfLines={1}>Tap to learn more</Text>
                </TouchableOpacity>
              )}
            </View>
            {!isVideo && mediaList.length > 1 && (
              <View style={[styles.dotsRow]}>
                {mediaList.map((_, i) => (
                  <View key={i} style={[styles.dot, i === slide ? styles.dotActive : undefined]} />
                ))}
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
  },
  touch: {
    flex: 1,
    paddingHorizontal: 0,
  },
  mediaBox: {
    flex: 1,
    backgroundColor: '#fff',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  bgFill: {
    ...StyleSheet.absoluteFillObject,
  },
  storyMedia: {
    width: '100%',
    height: '100%',
    alignSelf: 'center',
  },
  mediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  cta: {
    color: '#111',
    fontSize: 13,
    fontWeight: '700',
  },
  overlayTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sponsoredPill: {
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  ctaPill: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)'
  },
  counterPill: {
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)'
  },
  dotActive: {
    backgroundColor: '#fff'
  },
  footerBar: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
    borderRadius: 12,
  },
});

export default AnimatedAd;
