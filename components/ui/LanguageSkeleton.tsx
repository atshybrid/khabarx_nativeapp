import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Skeleton } from './Skeleton';

const { width } = Dimensions.get('window');
const GAP = 10;
const CARD_H = 110;
const HALF_W = (width - GAP * 3) / 2; // 2 columns

export function LanguageSkeleton() {
  return (
    <View style={styles.container}>
      {/* Top full-width card */}
      <View style={styles.fullWidth}>
        <View style={styles.card}>
          <View style={styles.leftText}>
            <Skeleton width={160} height={20} />
            <View style={{ height: 8 }} />
            <Skeleton width={120} height={14} />
          </View>
          <Skeleton width={24} height={24} borderRadius={12} />
        </View>
      </View>

      {/* Grid cards (2 columns) */}
      <View style={styles.gridRow}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`lang-grid-skel-${i}`} style={[styles.half, (i % 2 === 0) ? { marginRight: GAP } : null]}>
            <View style={styles.card}>
              <View style={styles.leftText}>
                <Skeleton width={120} height={18} />
                <View style={{ height: 6 }} />
                <Skeleton width={90} height={12} />
              </View>
              <Skeleton width={24} height={24} borderRadius={12} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: GAP,
  },
  fullWidth: {
    marginBottom: GAP,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  half: {
    width: HALF_W,
    marginBottom: GAP,
  },
  card: {
    height: CARD_H,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderBottomWidth: 4,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 1.2,
  },
  leftText: {
    flex: 1,
    justifyContent: 'center',
  },
});

export default LanguageSkeleton;
