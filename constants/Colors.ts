/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// Brand colors
const PRIMARY = '#032557';
const SECONDARY = '#fa7c05';

// Use primary as the tint color for both themes
const tintColorLight = PRIMARY;
const tintColorDark = PRIMARY;

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    card: '#ffffff',
    border: '#e5e7eb',
    muted: '#6b7280',
    tint: tintColorLight,
    primary: PRIMARY,
    secondary: SECONDARY,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    warning: '#e67e22', // orange for warnings
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    card: '#1b1f22',
    border: '#2a2f33',
    muted: '#9BA1A6',
    tint: tintColorDark,
    primary: PRIMARY,
    secondary: SECONDARY,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    warning: '#e67e22', // orange for warnings
  },
};
