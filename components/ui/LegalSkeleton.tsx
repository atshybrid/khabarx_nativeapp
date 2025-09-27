import { StyleSheet, View } from 'react-native';
import { Skeleton } from './Skeleton';

export default function LegalSkeleton() {
  return (
    <View style={styles.container}>
      <Skeleton width={'60%'} height={24} style={styles.mb12} />
      <Skeleton width={'90%'} height={14} style={styles.mb8} />
      <Skeleton width={'95%'} height={14} style={styles.mb8} />
      <Skeleton width={'88%'} height={14} style={styles.mb16} />

      <Skeleton width={'96%'} height={12} style={styles.mb6} />
      <Skeleton width={'92%'} height={12} style={styles.mb6} />
      <Skeleton width={'94%'} height={12} style={styles.mb6} />
      <Skeleton width={'76%'} height={12} style={styles.mb16} />

      <Skeleton width={'50%'} height={18} style={styles.mb12} />
      <Skeleton width={'92%'} height={12} style={styles.mb6} />
      <Skeleton width={'96%'} height={12} style={styles.mb6} />
      <Skeleton width={'85%'} height={12} style={styles.mb6} />
      <Skeleton width={'70%'} height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  mb6: { marginBottom: 6 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mb16: { marginBottom: 16 },
});
