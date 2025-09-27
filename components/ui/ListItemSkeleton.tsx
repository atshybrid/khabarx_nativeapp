import { StyleSheet, View } from 'react-native';
import { Skeleton } from './Skeleton';

type Props = {
  count?: number;
};

export default function ListItemSkeleton({ count = 6 }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={90} height={90} borderRadius={12} />
          <View style={styles.right}>
            <Skeleton width={'80%'} height={16} />
            <View style={{ height: 8 }} />
            <Skeleton width={'95%'} height={12} />
            <View style={{ height: 6 }} />
            <Skeleton width={'70%'} height={12} />
            <View style={{ height: 10 }} />
            <View style={styles.metaRow}>
              <Skeleton width={70} height={18} borderRadius={9} />
              <View style={{ width: 8 }} />
              <Skeleton width={110} height={12} borderRadius={6} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  right: {
    flex: 1,
    marginLeft: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
