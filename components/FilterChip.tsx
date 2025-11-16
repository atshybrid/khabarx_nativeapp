import { Theme } from '@/constants/Theme';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface FilterChipProps {
  label: string;
  active?: boolean;
  color?: string; // optional color dot
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, active, color, onPress, style, accessibilityLabel, accessibilityHint }) => {
  const activeBg = color || Theme.color.primary;
  const generatedHint = active ? 'Double tap to deselect filter' : 'Double tap to apply filter';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint || generatedHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: activeBg, borderColor: activeBg },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {!!color && <View style={[styles.dot, { backgroundColor: active ? '#ffffff' : color }]} />}
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Theme.radius.pill,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs + 3,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Theme.spacing.xs + 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  labelActive: {
    color: '#ffffff',
  },
});

export default FilterChip;
