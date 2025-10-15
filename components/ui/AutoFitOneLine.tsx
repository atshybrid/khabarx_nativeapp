import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, Text, TextStyle, View } from 'react-native';

type Props = {
  text: string;
  width: number; // container width in px
  style?: StyleProp<TextStyle>;
  maxFontSize?: number; // starting font size
  minFontSize?: number; // lower bound
  fontWeight?: TextStyle['fontWeight'];
  color?: string;
  family?: string;
};

// Auto-fit single-line text by shrinking font size until it fits the container width.
// Uses onLayout measurement feedback loop with a small iteration cap.
export default function AutoFitOneLine({
  text,
  width,
  style,
  maxFontSize = 18,
  minFontSize = 10,
  fontWeight = '800',
  color = '#111827',
  family,
}: Props) {
  const [fontSize, setFontSize] = useState(maxFontSize);
  const [measuredW, setMeasuredW] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const maxTries = 8;

  // When text or width changes, reset
  useEffect(() => {
    setFontSize(maxFontSize);
    setMeasuredW(null);
    setTries(0);
  }, [text, width, maxFontSize]);

  useEffect(() => {
    if (measuredW == null) return;
    if (measuredW <= width || tries >= maxTries) return;
    const next = Math.max(minFontSize, Math.floor(fontSize * 0.94));
    if (next !== fontSize) {
      setFontSize(next);
      setTries(tries + 1);
    }
  }, [measuredW, width, fontSize, tries, minFontSize]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setMeasuredW(w);
  };

  const textStyle: TextStyle = useMemo(() => ({
    fontSize,
    fontWeight,
    color,
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontFamily: family,
  }), [fontSize, fontWeight, color, family]);

  return (
    <View style={{ width }}>
      <Text
        style={[{ textAlign: 'center' }, textStyle, style]}
        numberOfLines={1}
        ellipsizeMode="clip"
        onLayout={onLayout}
        allowFontScaling={false}
      >
        {text}
      </Text>
    </View>
  );
}
