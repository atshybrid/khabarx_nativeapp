import { makeShadow } from '@/utils/shadow';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHrciOnboarding } from '../../context/HrciOnboardingContext';

export default function TestPersistenceScreen() {
  const router = useRouter();
  const { 
    level, 
    cellId, 
    cellName, 
    cellCode, 
    designationCode, 
    designationName,
    geo,
    setLevel,
    setCell,
    setDesignation,
    updateGeo,
    reset
  } = useHrciOnboarding();

  const testData = () => {
    setLevel('MANDAL');
    setCell('cmghp2xvk0000ugn89mrdsaj1', 'General Body', 'GENERAL_BODY');
    setDesignation('cmghpgy9q0005ugl4mif89knk', 'EXECUTIVE_MEMBER', 'Executive Member');
    updateGeo({
      hrcMandalId: 'cmghnwqwe000uug88i9vqgt4x',
      hrcMandalName: 'Mylavaram'
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','left','right','bottom']}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.heading}>Test Persistence</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Current Stored Data:</Text>
        
        <View style={styles.dataCard}>
          <DataItem label="Level" value={level || 'Not set'} />
          <DataItem label="Cell ID" value={cellId || 'Not set'} />
          <DataItem label="Cell Name" value={cellName || 'Not set'} />
          <DataItem label="Cell Code" value={cellCode || 'Not set'} />
          <DataItem label="Designation Code" value={designationCode || 'Not set'} />
          <DataItem label="Designation Name" value={designationName || 'Not set'} />
          <DataItem label="Mandal ID" value={geo.hrcMandalId || 'Not set'} />
          <DataItem label="Mandal Name" value={geo.hrcMandalName || 'Not set'} />
        </View>

        <TouchableOpacity style={styles.testBtn} onPress={testData}>
          <Text style={styles.testBtnText}>Set Test Data</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetBtnText}>Reset All Data</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Close and reopen the app to test persistence. Data should be restored from AsyncStorage.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataItem}>
      <Text style={styles.dataLabel}>{label}:</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    paddingHorizontal: 16, 
    paddingVertical: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0'
  },
  heading: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1e293b' },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  dataCard: { 
    backgroundColor: '#ffffff', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 24,
    ...makeShadow(3, { opacity: 0.1, blur: 8, y: 2 })
  },
  dataItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  dataLabel: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  dataValue: { fontSize: 14, color: '#1e293b', fontWeight: '700', flex: 1, textAlign: 'right' },
  testBtn: {
    backgroundColor: '#1D0DA1',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center'
  },
  testBtnText: { color: '#ffffff', fontWeight: '700' },
  resetBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center'
  },
  resetBtnText: { color: '#ffffff', fontWeight: '700' },
  note: { fontSize: 12, color: '#64748b', textAlign: 'center', fontStyle: 'italic' },
});