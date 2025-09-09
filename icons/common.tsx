import { Animated } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export const AnimatedSvg = Animated.createAnimatedComponent(Svg as any);
export const AnimatedPath = Animated.createAnimatedComponent(Path as any);
export const AnimatedCircle = Animated.createAnimatedComponent(Circle as any);
export const AnimatedRect = Animated.createAnimatedComponent(Rect as any);
