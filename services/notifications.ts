import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,         // Show notification banner
    shouldPlaySound: true,         // Play notification sound
    shouldSetBadge: false,         // Don't set badge count
    shouldShowBanner: true,        // Show banner (iOS)
    shouldShowList: true,          // Show in notification list (iOS)
  }),
});

export interface NotificationData {
  type?: 'article' | 'comment' | 'breaking' | 'general';
  articleId?: string;
  commentId?: string;
  title?: string;
  body?: string;
  url?: string;
  [key: string]: any;
}

export interface NotificationResponse {
  notification: Notifications.Notification;
  actionIdentifier: string;
}

class NotificationService {
  private notificationListener?: Notifications.Subscription;
  private responseListener?: Notifications.Subscription;

  /**
   * Initialize notification service
   * Call this in your app's root component
   */
  initialize() {
    console.log('[NOTIFICATIONS] Initializing service...');
    
    // Register listeners
    this.registerNotificationListeners();
    
    // Configure Android notification channel
    this.configureAndroidChannel();
    
    console.log('[NOTIFICATIONS] Service initialized');
  }

  /**
   * Clean up notification listeners
   * Call this when the app unmounts
   */
  cleanup() {
    this.notificationListener?.remove();
    this.responseListener?.remove();
    console.log('[NOTIFICATIONS] Service cleaned up');
  }

  /**
   * Register notification event listeners
   */
  private registerNotificationListeners() {
    // Handle notifications received while app is running
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived.bind(this)
    );

    // Handle notification taps/interactions
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );

    console.log('[NOTIFICATIONS] Listeners registered');
  }

  /**
   * Handle received notifications (when app is open)
   */
  private handleNotificationReceived(notification: Notifications.Notification) {
    console.log('[NOTIFICATIONS] Received notification:', {
      title: notification.request.content.title,
      body: notification.request.content.body,
      data: notification.request.content.data,
    });

    // You can add custom logic here for in-app notifications
    // For example, show a toast, update badge, etc.
  }

  /**
   * Handle notification responses (when user taps notification)
   */
  private handleNotificationResponse(response: NotificationResponse) {
    const { notification } = response;
    const data = notification.request.content.data as NotificationData;
    
    console.log('[NOTIFICATIONS] User tapped notification:', {
      title: notification.request.content.title,
      data,
    });

    // Navigate based on notification type
    this.navigateFromNotification(data);
  }

  /**
   * Navigate to appropriate screen based on notification data
   */
  private navigateFromNotification(data: NotificationData) {
    try {
      switch (data.type) {
        case 'article':
          if (data.articleId) {
            router.push({
              pathname: '/article/[id]',
              params: { id: data.articleId }
            });
          }
          break;
          
        case 'comment':
          if (data.articleId) {
            router.push({
              pathname: '/comments',
              params: { 
                shortNewsId: data.articleId,
                commentId: data.commentId 
              }
            });
          }
          break;
          
        case 'breaking':
          // Navigate to breaking news or specific article
          if (data.articleId) {
            router.push({
              pathname: '/article/[id]',
              params: { id: data.articleId }
            });
          } else {
            router.push('/(tabs)/news');
          }
          break;
          
        default:
          // Default navigation to home/news
          router.push('/(tabs)/news');
          break;
      }
    } catch (error) {
      console.error('[NOTIFICATIONS] Navigation error:', error);
      // Fallback navigation
      router.push('/(tabs)/news');
    }
  }

  /**
   * Configure Android notification channel
   */
  private async configureAndroidChannel() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      // Create additional channels for different notification types
      await Notifications.setNotificationChannelAsync('breaking', {
        name: 'Breaking News',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('articles', {
        name: 'New Articles',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#007AFF',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        showBadge: true,
      });

      console.log('[NOTIFICATIONS] Android channels configured');
    }
  }

  /**
   * Get push notification token
   */
  async getNotificationToken(): Promise<string | null> {
    try {
      // Check permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[NOTIFICATIONS] Permission denied');
        return null;
      }

      // Get token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });

      console.log('[NOTIFICATIONS] Token obtained:', token.data);
      return token.data;
    } catch (error) {
      console.error('[NOTIFICATIONS] Token error:', error);
      return null;
    }
  }

  /**
   * Schedule a local notification (for testing)
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: NotificationData,
    delaySeconds: number = 0
  ) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
        },
        trigger: delaySeconds > 0 ? { seconds: delaySeconds } as Notifications.TimeIntervalTriggerInput : null,
      });
      
      console.log('[NOTIFICATIONS] Local notification scheduled:', title);
    } catch (error) {
      console.error('[NOTIFICATIONS] Local notification error:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[NOTIFICATIONS] All notifications cancelled');
  }

  /**
   * Get notification permissions status
   */
  async getPermissionStatus() {
    const permissions = await Notifications.getPermissionsAsync();
    return {
      granted: permissions.status === 'granted',
      status: permissions.status,
      canAskAgain: permissions.canAskAgain,
    };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();