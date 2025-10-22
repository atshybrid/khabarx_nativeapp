import LottieView from 'lottie-react-native';
import { Text, View, ViewStyle } from 'react-native';

// Common size presets so screens can standardize usage and bump to very large sizes easily
export const LOADER_SIZES = {
  tiny: 16,
  small: 20,
  regular: 32,
  medium: 48,
  large: 64,
  xlarge: 96,     // previous full-screen default
  xxlarge: 128,   // bigger full-screen as requested
  jumbo: 160,     // extra large variant
} as const;

type LoaderProps = {
  size?: number; // width & height in dp
  containerStyle?: ViewStyle;
  testID?: string;
};

// Global default loader using the provided Lottie animation
// File: assets/lotti/hrci_loader_svg.json
export function Loader({ size = 40, containerStyle, testID }: LoaderProps) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, containerStyle]} pointerEvents="none">
      <LottieView
        source={require('@/assets/lotti/hrci_loader_svg.json')}
        autoPlay
        loop
        style={{ width: size, height: size }}
        testID={testID || 'app-loader'}
      />
    </View>
  );
}

type FullScreenLoaderProps = {
  size?: number; // prefer LOADER_SIZES.xxlarge or LOADER_SIZES.jumbo
  label?: string;
  backgroundColor?: string;
  textColor?: string;
  gap?: number;
  containerStyle?: ViewStyle;
};

// Drop-in full-screen centered loader with optional label
export function FullScreenLoader({
  size = LOADER_SIZES.xxlarge,
  label,
  backgroundColor = '#ffffff',
  textColor = '#111111',
  gap = 12,
  containerStyle,
}: FullScreenLoaderProps) {
  return (
    <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor, padding: 16 }, containerStyle]}> 
      <Loader size={size} />
      {label ? <Text style={{ color: textColor, marginTop: gap }}>{label}</Text> : null}
    </View>
  );
}

export default Loader;
