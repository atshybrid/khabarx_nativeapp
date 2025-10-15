import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HrciIdCardExport } from '../components/HrciIdCardExport';

export default function IdCardPreviewScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={{ alignItems: 'center' }}>
          <HrciIdCardExport
            // Preview vs export DPI
            previewWidth={360}
            exportWidth={2160}
            // Card props (replace with real data/images)
            memberName="JOHN DOE"
            designation="STATE SECRETARY"
            cellName="HRCI ANDHRA PRADESH CELL"
            idNumber="HRCI/AP/2025/01234"
            contactNumber="+91 98765 43210"
            validUpto="MARCH 2027"
            logoUri={undefined}
            photoUri={undefined}
            stampUri={undefined}
            authorSignUri={undefined}
            // Signature overlay tuning if needed
            signatureBottomOffset={56}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
