import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

interface SectionCardProps extends ViewProps {
  elevated?: boolean;
  spacing?: 'sm' | 'md' | 'lg';
}

export const SectionCard: React.FC<SectionCardProps> = ({ style, elevated = true, spacing = 'md', ...rest }) => {
  return (
    <View
      style={[
        styles.base,
        elevated && styles.shadow,
        spacing === 'sm' && styles.padSm,
        spacing === 'md' && styles.padMd,
        spacing === 'lg' && styles.padLg,
        style,
      ]}
      {...rest}
    />
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.07)',
    marginBottom: 20,
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  padSm: { padding: 12 },
  padMd: { padding: 18 },
  padLg: { padding: 26 },
});

export default SectionCard;
