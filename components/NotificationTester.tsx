import { notificationService } from '@/services/notifications';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const NotificationTester = () => {
  const handleTestLocalNotification = async () => {
    try {
      await notificationService.scheduleLocalNotification(
        'Test Notification',
        'This is a test notification from KhabarX!',
        {
          type: 'article',
          articleId: '123',
          title: 'Test Article'
        },
        2 // 2 seconds delay
      );
      Alert.alert('Success', 'Test notification scheduled for 2 seconds!');
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule notification');
    }
  };

  const handleTestBreakingNews = async () => {
    try {
      await notificationService.scheduleLocalNotification(
        '🚨 Breaking News',
        'Important breaking news update from KhabarX!',
        {
          type: 'breaking',
          articleId: '456',
          title: 'Breaking News Article'
        },
        1 // 1 second delay
      );
      Alert.alert('Success', 'Breaking news notification scheduled!');
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule notification');
    }
  };

  const handleGetToken = async () => {
    try {
      const token = await notificationService.getNotificationToken();
      if (token) {
        Alert.alert('Push Token', token.substring(0, 50) + '...');
      } else {
        Alert.alert('Error', 'No push token available');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get token');
    }
  };

  const handleGetPermissions = async () => {
    try {
      const permissions = await notificationService.getPermissionStatus();
      Alert.alert(
        'Permissions',
        `Status: ${permissions.status}\nGranted: ${permissions.granted}\nCan Ask Again: ${permissions.canAskAgain}`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to get permissions');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔔 Notification Tester</Text>
      
      <TouchableOpacity style={styles.button} onPress={handleTestLocalNotification}>
        <Text style={styles.buttonText}>Test Article Notification</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.breakingButton]} onPress={handleTestBreakingNews}>
        <Text style={styles.buttonText}>Test Breaking News</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={handleGetToken}>
        <Text style={styles.buttonText}>Get Push Token</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={handleGetPermissions}>
        <Text style={styles.buttonText}>Check Permissions</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        📱 Test notifications will appear in 1-2 seconds. 
        {'\n'}Tap notifications to test navigation!
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  breakingButton: {
    backgroundColor: '#FF3B30',
  },
  infoButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

export default NotificationTester;