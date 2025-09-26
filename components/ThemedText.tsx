import { StyleSheet, Text, type TextProps } from 'react-native';

import { useUiPrefs } from '@/context/UiPrefsContext';
import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const textColor = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const linkColor = useThemeColor({}, 'tint');
  const { fontScale, readingMode } = useUiPrefs();
  const sizeByType: Record<NonNullable<ThemedTextProps['type']>, number> = {
    default: 16,
    defaultSemiBold: 16,
    title: 32,
    subtitle: 20,
    link: 16,
  };
  const lineByType: Record<NonNullable<ThemedTextProps['type']>, number> = {
    default: 24,
    defaultSemiBold: 24,
    title: 32,
    subtitle: 24,
    link: 30,
  };
  const scaledFontSize = sizeByType[type] * (fontScale || 1);
  const baseLine = lineByType[type];
  const scaledLineHeight = readingMode ? Math.round(baseLine * 1.1) : baseLine;

  return (
    <Text
      style={[
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        { color: type === 'link' ? linkColor : textColor, fontSize: scaledFontSize, lineHeight: scaledLineHeight },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
  },
});
