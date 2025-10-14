import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HrciIdCardFrontExact } from '../../components/HrciIdCardFrontExact';

export default function HrciIdCardFrontExactScreen() {
  const { width } = Dimensions.get('window');
  const horizontalPadding = 16;
  // Use full design width (720) unless screen smaller, then scale down
  const cardWidth = Math.min(720, width - horizontalPadding * 2);

  return (
    <SafeAreaView style={styles.container} edges={['top','left','right','bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>HRCI ID Card (Front - Exact Design Preview)</Text>
        <HrciIdCardFrontExact
          width={cardWidth}
          memberName="MRS. KONA VARALAKSHMI"
          designation="SOUTH INDIA WOMEN PORT PRESIDENT"
          cellName="ANDHRA PRADESH WOMEN CELL"
          idNumber="HRCI-IND-SI-WP-001"
          contactNumber="9603005183"
          validUpto="31-03-2027"
          // Provide example (these can be replaced by real URLs when integrated)
          logoUri={undefined}
          photoUri={undefined}
          stampUri={undefined}
          authorSignUri={undefined}
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
