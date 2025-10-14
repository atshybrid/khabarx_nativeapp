// import { log } from '@/services/logger';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { makeShadow } from '@/utils/shadow';
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
  /** Enable drag-to-close and drag gestures on the sheet */
  dragEnabled?: boolean;
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
  dragEnabled = true,
}: BottomSheetProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const OPEN_DUR = 280;
  const CLOSE_DUR = 240;
  const UNMOUNT_DUR = CLOSE_DUR + 40; // leave a small buffer after close
  const insets = useSafeAreaInsets();
  // Track any pending close timers to avoid race conditions when quickly reopening after a close
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: ignore backdrop presses for a short time after opening to avoid accidental immediate close
  const allowBackdropAtRef = React.useRef<number>(0);
  const [backdropInteractive, setBackdropInteractive] = React.useState(false);
  // Keep rendering while animating out even if `visible` prop is false
  const [renderVisible, setRenderVisible] = React.useState(visible);
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
      // Cancel any pending close from a previous interaction
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      const openFrom = orderedHeights[snapIndex] ?? Math.min(screenH * 0.5, screenH - insets.top - 24);
      // Initialize position before mounting to avoid first-frame flicker
      translateY.setValue(openFrom);
      // Ensure we are rendering while opening
      if (!renderVisible) setRenderVisible(true);
      // Animate to open
      animateTo(0, { duration: OPEN_DUR });
      // Delay enabling backdrop touches until after the open animation so first tap hits content
      allowBackdropAtRef.current = Date.now() + OPEN_DUR;
      setBackdropInteractive(false);
      const id = setTimeout(() => setBackdropInteractive(true), OPEN_DUR + 10);
      return () => clearTimeout(id);
    } else {
      // close to current height (off-screen)
      const closeTo = orderedHeights[snapIndex] ?? Math.min(screenH * 0.5, screenH - insets.top - 24);
      animateTo(closeTo, { duration: CLOSE_DUR });
      setBackdropInteractive(false);
      // Unmount after the close animation completes to avoid abrupt disappear
      const id = setTimeout(() => setRenderVisible(false), UNMOUNT_DUR);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Ensure any pending timers are cleared when unmounting
  useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Update position when safe area or snap point height changes while open
  useEffect(() => {
    if (visible) {
      // keep open (translateY=0) when height changes; content resizes
      translateY.setValue(0);
    }
  }, [sheetHeight, orderedHeights, snapIndex, visible, animateTo, insets.top, translateY]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => dragEnabled && Math.abs(g.dy) > Math.abs(g.dx) && Math.abs(g.dy) > 12,
    onPanResponderGrant: () => {
      if (!dragEnabled) return;
      translateY.stopAnimation((v) => { dragY.current = v; });
    },
    onPanResponderMove: (_, g) => {
      if (!dragEnabled) return;
      // Allow dragging only downward (positive dy); permit slight upward (elastic) within -24px
      const next = Math.max(0, dragY.current + Math.max(g.dy, -24));
      translateY.setValue(next);
    },
    onPanResponderRelease: (_, g) => {
      if (!dragEnabled) return;
      const current = (translateY as any)._value ?? 0;
      // Make it easier to close from lower snap by using a smaller threshold
      const threshold = Math.max(48, sheetHeight * 0.25);
      if (g.vy > 1.2 || current > threshold) {
        // close
        animateTo(sheetHeight, { duration: 200 });
        // let the close animation finish then call onClose
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
          onClose();
          closeTimerRef.current = null;
        }, 200);
      } else {
        // reopen to current snap height
        animateTo(0);
      }
    },
  }), [animateTo, onClose, sheetHeight, translateY, dragEnabled]);

  const backdropStyle = useMemo(() => ({ opacity: translateY.interpolate({ inputRange: [0, Math.max(1, sheetHeight)], outputRange: [backdropOpacity, 0] }) }), [translateY, backdropOpacity, sheetHeight]);

  // Use Modal on all platforms for a reliable full-screen overlay
  return (
    <Modal visible={renderVisible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height', default: 'height' }) as any} style={[StyleSheet.absoluteFill, { margin: 0, padding: 0 }]}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: 1, pointerEvents: backdropInteractive ? 'auto' : 'none' }]}>
          <Animated.View style={[styles.backdropFill, { pointerEvents: 'none' }, backdropStyle]} />
          <Pressable
            onPress={enableBackdropPress ? () => {
              if (Date.now() < allowBackdropAtRef.current) return;
              onClose();
            } : undefined}
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
              backgroundColor: theme.card,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.border,
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
              paddingBottom: respectSafeAreaBottom ? insets.bottom : 0,
              height: sheetHeight,
              transform: [{ translateY }],
              marginBottom: Platform.OS === 'android' ? -1 : 0,
              ...(shadowEnabled ? makeShadow(24, { opacity: 0.15, blur: 24, y: -6 }) : {}),
            },
          ]}
          {...(dragEnabled ? panResponder.panHandlers : {})}
        >
          <View style={styles.handleContainer}>
            <View style={[styles.handleBar, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.2)' }]} />
            <View style={styles.handleHintRow}>
              <View style={[styles.handleDot, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.15)' }]} />
              <View style={[styles.handleDot, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.15)' }]} />
              <View style={[styles.handleDot, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.15)' }]} />
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
    zIndex: 1,
    backgroundColor: 'transparent',
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
  zIndex: 2,
  overflow: 'hidden',
  // small trick: ensure GPU compositing to reduce flicker
  transform: [{ translateZ: 0 } as any],
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
