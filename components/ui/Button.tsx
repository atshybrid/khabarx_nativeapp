import { Colors } from '@/constants/Colors';
import { GestureResponderEvent, Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { Loader } from './Loader';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'default' | 'outline';

export interface ButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  backgroundColor?: string; // overrides variant background
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

function hexToRgb(hex?: string) {
  if (!hex) return { r: 255, g: 255, b: 255 };
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    const r = h[0]; const g = h[1]; const b = h[2];
    h = `${r}${r}${g}${g}${b}${b}`;
  }
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return { r: 255, g: 255, b: 255 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function relativeLuminance(rgb: { r: number; g: number; b: number }) {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(rgb.r);
  const G = toLinear(rgb.g);
  const B = toLinear(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function chooseTextColor(bg: string): '#000' | '#fff' {
  // Friendly shortcuts for explicit requirement
  const b = bg.toLowerCase();
  if (b === '#fff' || b === '#ffffff' || b === 'white') return '#000';
  if (b === Colors.light.primary.toLowerCase() || b === '#fe0002') return '#fff';

  const L = relativeLuminance(hexToRgb(bg));
  // Contrast with white vs black; pick higher contrast
  const contrastWhite = (1.0 + 0.05) / (L + 0.05);
  const contrastBlack = (L + 0.05) / (0.0 + 0.05);
  return contrastWhite >= contrastBlack ? '#fff' : '#000';
}

export function Button({ title, onPress, variant = 'default', backgroundColor, disabled, loading, style, textStyle }: ButtonProps) {
  const baseBg = (() => {
    if (backgroundColor) return backgroundColor;
    switch (variant) {
      case 'primary': return Colors.light.primary;
      case 'secondary': return '#ffffff';
      case 'danger': return '#dc2626';
      case 'outline': return 'transparent';
      case 'default':
      default: return '#f3f4f6';
    }
  })();

  const isOutline = variant === 'outline';
  const isWhite = baseBg === '#fff' || baseBg === '#ffffff' || baseBg === 'white';
  const bgColor = baseBg;
  const fgColor = isOutline ? Colors.light.text : chooseTextColor(bgColor);
  const borderColor = isOutline ? Colors.light.border : (isWhite ? Colors.light.border : bgColor);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bgColor, borderColor, opacity: disabled ? 0.6 : pressed ? 0.85 : 1 },
        isOutline && { borderWidth: 1 },
        style,
      ]}
    >
      {loading ? (
        <Loader size={20} />
      ) : (
        <Text style={[styles.label, { color: fgColor }, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
  },
});

export default Button;
