import NotificationTester from '@/components/NotificationTester';
import { ScrollView, Text, View } from 'react-native';

export default function TestScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 20 }}>
        <Text style={{ color: 'green', fontSize: 24, textAlign: 'center', marginBottom: 20 }}>
          🧪 Debug & Test Screen
        </Text>
        
        <NotificationTester />
        
        <Text style={{ color: '#666', fontSize: 14, textAlign: 'center', marginTop: 20 }}>
          Use this screen to test app features during development
        </Text>
      </View>
    </ScrollView>
  );
}
