import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HrciIdCardFrontStandard } from '../../components/HrciIdCardFrontStandard';

export default function HrciIdCardFrontStandardScreen() {
  const { width } = Dimensions.get('window');
  const cardWidth = Math.min(width - 32, 400); // clamp for readability

  return (
    <SafeAreaView style={styles.container} edges={['top','left','right','bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Standard ID-1 Card Front Preview</Text>
        <HrciIdCardFrontStandard
          width={cardWidth}
          topBandHeightInches={0.24}
          blueBandHeightInches={0.24}
          bottomBandHeightInches={0.1806}
          bodyHeightInches={(2.1264 - (0.24 + 0.24 + 0.1806))}
          topTitle="HUMAN RIGHTS COUNCIL FOR INDIA (HRCI)"
          memberName="MRS. KONA VARALAKSHMI"
          designation="SOUTH INDIA WOMEN PORT PRESIDENT"
          cellName="Member Cell Name"
          idNumber="HRCI-IND-SI-WP-001"
          contactNumber="9603005183"
          validUpto="MARCH 2027"
          showSectionDebug
        />
        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { padding: 16, alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '800', marginBottom: 16, color: '#111827' },
});
