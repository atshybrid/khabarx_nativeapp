import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { Skeleton } from './Skeleton';

const { width } = Dimensions.get('window');

export const ArticleListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}> 
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}> 
          <Skeleton width={width - 32} height={160} borderRadius={12} />
          <View style={{ height: 12 }} />
          <Skeleton width={'85%'} height={18} borderRadius={8} />
          <View style={{ height: 8 }} />
          <Skeleton width={'95%'} height={12} borderRadius={6} />
          <View style={{ height: 6 }} />
          <Skeleton width={'80%'} height={12} borderRadius={6} />
          <View style={{ height: 12 }} />
          <View style={styles.metaRow}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <View style={{ width: 8 }} />
            <Skeleton width={120} height={10} borderRadius={6} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  card: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default ArticleListSkeleton;
