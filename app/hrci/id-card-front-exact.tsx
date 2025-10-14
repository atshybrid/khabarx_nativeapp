import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HrciIdCardFrontExact } from '../../components/HrciIdCardFrontExact';

export default function HrciIdCardFrontExactScreen() {
  const { width } = Dimensions.get('window');
  const horizontalPadding = 16;
  const cardWidth = width - horizontalPadding * 2;

  return (
    <SafeAreaView style={styles.container} edges={['top','left','right','bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>HRCI ID Card (Front - Exact Design Preview)</Text>
        <HrciIdCardFrontExact
          width={cardWidth}
          memberName="MRS. KONA VARALAKSHMI"
            designation="SOUTH INDIA WOMEN PORT PRESIDENT"
          cellName="Member Cell Name"
          idNumber="HRCI-IND-SI-WP-001"
          contactNumber="9603005183"
          validUpto="MARCH 2027"
        />
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { padding: 16, alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '800', marginBottom: 16, color: '#111827' },
});
