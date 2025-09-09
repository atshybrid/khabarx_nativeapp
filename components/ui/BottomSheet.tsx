import { log } from '@/services/logger';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Fractions of screen height (e.g., [0.5, 0.9]) */
  snapPoints?: number[];
  /** Index into snapPoints for initial open height */
  initialSnapIndex?: number;
  /** Backdrop opacity 0-1 */
  backdropOpacity?: number;
  /** Close when tapping backdrop */
  enableBackdropPress?: boolean;
  /** Optional header element rendered above content */
  header?: React.ReactNode;
  /** Optional footer element rendered below content */
  footer?: React.ReactNode;
  /** Border radius for top corners */
  radius?: number;
  /** Called when snap point changes */
  onSnapChange?: (index: number) => void;
  /** Accessibility label for the sheet */
  accessibilityLabel?: string;
  /** Whether to respect bottom safe-area with padding; set false for perfectly flush bottom */
  respectSafeAreaBottom?: boolean;
  /** Enable drop shadow/elevation. Disable to avoid faint bottom edge line on Android */
  shadowEnabled?: boolean;
};

const screenH = Dimensions.get('window').height;

export default function BottomSheet({
  visible,
  onClose,
  children,
  snapPoints = [0.5, 0.9],
  initialSnapIndex = 0,
  backdropOpacity = 0.35,
  enableBackdropPress = true,
  header,
  footer,
  radius = 16,
  onSnapChange,
  accessibilityLabel,
  respectSafeAreaBottom = true,
  shadowEnabled = true,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  // Convert snap points into pixel heights; values <= 1 are treated as fractions, >1 as pixels
  const snapHeights = useMemo(() => {
    const px = snapPoints.map((v) => (v <= 1 ? screenH * v : v));
    // clamp to available height
    const maxUsable = screenH - insets.top - 24;
    return px.map((h) => Math.max(0, Math.min(h, maxUsable)));
  }, [snapPoints, insets.top]);
  const orderedHeights = useMemo(() => [...snapHeights].sort((a, b) => a - b), [snapHeights]);
  const snapIndex = useMemo(() => Math.min(Math.max(initialSnapIndex, 0), orderedHeights.length - 1), [initialSnapIndex, orderedHeights.length]);
  const sheetHeight = useMemo(() => orderedHeights[snapIndex] ?? Math.min(screenH * 0.5, screenH - insets.top - 24), [orderedHeights, snapIndex, insets.top]);
  // (deprecated helper removed: using orderedHeights directly)

  const translateY = useRef(new Animated.Value(0)).current; // will be set per open/close
  const dragY = useRef(0);

  const animateTo = useCallback((to: number, cfg: Partial<Animated.TimingAnimationConfig> = {}) => {
    Animated.timing(translateY, {
      toValue: to,
      duration: cfg.duration ?? 260,
      easing: cfg.easing ?? Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  // internal helper to animate to a given snap index; reserved for future imperative API
  // const snapToIndex = useCallback((idx: number) => {
  //   const i = Math.min(Math.max(idx, 0), ordered.length - 1);
  //   setSnapIndex(i);
  //   onSnapChange?.(i);
  //   const target = Math.max(0, screenH - Math.max(0, Math.min(screenH * ordered[i], screenH)));
  //   animateTo(target);
  // }, [ordered, animateTo, onSnapChange]);

  useEffect(() => {
    if (visible) {
      const h = orderedHeights[snapIndex] ?? Math.min(screenH * 0.5, screenH - insets.top - 24);
      log.debug('BottomSheet.open', { snapIndex, height: h });
      // start closed at height, animate to 0 (fully open at current height)
      translateY.setValue(h);
      animateTo(0, { duration: 280 });
    } else {
      log.debug('BottomSheet.close');
      // close to current height (off-screen)
      const h = orderedHeights[snapIndex] ?? Math.min(screenH * 0.5, screenH - insets.top - 24);
      animateTo(h, { duration: 220 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Update position when safe area or snap point height changes while open
  useEffect(() => {
    if (visible) {
      const h = orderedHeights[snapIndex] ?? Math.min(screenH * 0.5, screenH - insets.top - 24);
      log.debug('BottomSheet.resize', { snapIndex, height: h });
      // keep open (translateY=0) when height changes; content resizes
      translateY.setValue(0);
    }
  }, [sheetHeight, orderedHeights, snapIndex, visible, animateTo, insets.top, translateY]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > Math.abs(g.dx) && Math.abs(g.dy) > 6,
    onPanResponderGrant: () => {
      translateY.stopAnimation((v) => { dragY.current = v; });
    },
    onPanResponderMove: (_, g) => {
      // Allow dragging only downward (positive dy); permit slight upward (elastic) within -24px
      const next = Math.max(0, dragY.current + Math.max(g.dy, -24));
      translateY.setValue(next);
    },
    onPanResponderRelease: (_, g) => {
      const current = (translateY as any)._value ?? 0;
  // Make it easier to close from lower snap by using a smaller threshold
  const threshold = Math.max(48, sheetHeight * 0.25);
  if (g.vy > 1.2 || current > threshold) {
        // close
    animateTo(sheetHeight, { duration: 200 });
        // let the close animation finish then call onClose
        setTimeout(onClose, 200);
      } else {
    // reopen to current snap height
    animateTo(0);
      }
    },
  }), [animateTo, onClose, sheetHeight, translateY]);

  const backdropStyle = useMemo(() => ({ opacity: translateY.interpolate({ inputRange: [0, Math.max(1, sheetHeight)], outputRange: [backdropOpacity, 0] }) }), [translateY, backdropOpacity, sheetHeight]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[StyleSheet.absoluteFill, { margin: 0, padding: 0 }]}>
        {/* Backdrop */}
  <Animated.View style={[styles.backdrop, { opacity: 1 }]}> 
          <Animated.View pointerEvents="none" style={[styles.backdropFill, backdropStyle]} />
      <Pressable
            onPress={enableBackdropPress ? onClose : undefined}
            onStartShouldSetResponder={() => true}
            onResponderMove={(e) => {
              // Dragging on the backdrop closes faster
              const dy = e.nativeEvent.touches?.[0]?.pageY ?? 0;
              // If pulled down quickly from near the sheet area, close
              if (dy > screenH * 0.92) {
        animateTo(sheetHeight, { duration: 180 });
                setTimeout(onClose, 180);
              }
            }}
            style={[StyleSheet.absoluteFill, { margin: 0, padding: 0 }]}
            accessibilityLabel="Close backdrop"
            accessibilityRole="button"
          />
        </Animated.View>
        {/* Sheet */}
        <Animated.View
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.sheet,
            {
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
              paddingBottom: respectSafeAreaBottom ? insets.bottom : 0,
              height: sheetHeight,
              transform: [{ translateY }],
              // Nudge down slightly on Android to avoid hairline at bottom edge
              marginBottom: Platform.OS === 'android' ? -1 : 0,
              shadowColor: '#000',
              shadowOpacity: shadowEnabled ? 0.15 : 0,
              shadowRadius: shadowEnabled ? 12 : 0,
              shadowOffset: shadowEnabled ? { width: 0, height: -6 } : { width: 0, height: 0 },
              elevation: shadowEnabled ? 24 : 0,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
            <View style={styles.handleHintRow}>
              <View style={styles.handleDot} />
              <View style={styles.handleDot} />
              <View style={styles.handleDot} />
            </View>
          </View>
          {header ? <View style={styles.header}>{header}</View> : null}
          <View style={[styles.content, { maxHeight: sheetHeight - 32 - (header ? 44 : 0) - (footer ? 44 : 0) }]}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFill: {
    flex: 1,
    backgroundColor: '#000',
  },
  sheet: {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: '#fff',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  handleHintRow: {
    flexDirection: 'row',
    gap: 4,
    paddingTop: 4,
    paddingBottom: 4,
  },
  handleDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
});
