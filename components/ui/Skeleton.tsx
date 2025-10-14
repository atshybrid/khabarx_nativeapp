import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = '100%' as `${number}%`, height = 16, borderRadius = 8, style }: SkeletonProps) {
  return (
    <View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e6e8ec',
  },
});

export default Skeleton;
