// Central design tokens for consistent styling across admin screens.
// Keep minimal; expand gradually to avoid over-abstraction.
export const Theme = {
  color: {
    primary: '#d70000', // Align with red brand displayed in screenshots
    primaryContrast: '#ffffff',
    bg: '#f8fafc',
    bgAlt: '#ffffff',
    border: '#e2e8f0',
    subtleText: '#64748b',
    text: '#0f172a',
    danger: '#dc2626',
    warning: '#f59e0b',
    success: '#16a34a',
    info: '#2563eb',
    chipBg: '#f1f5f9',
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999,
  },
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  font: {
    size: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 18,
      xl: 22,
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
  },
  // Provide semantic shadow tokens; actual platform style applied via utility (makeShadow).
  elevation: {
    card: 2,
    floating: 6,
    modal: 12,
  },
} as const;

export type ThemeTokens = typeof Theme;
