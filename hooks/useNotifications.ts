import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  league_id?: string;
  trade_id?: string;
  screen?: string;
  [key: string]: any;
}

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        setExpoPushToken(token);
        savePushToken(token);
      }
    });

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    // Listen for user interactions with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as NotificationData;
      handleNotificationNavigation(data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const handleNotificationNavigation = (data: NotificationData) => {
    // Navigate based on notification type
    if (data.league_id) {
      if (data.screen === 'draft') {
        router.push(`/draft-room/${data.league_id}`);
      } else if (data.screen === 'join_requests') {
        router.push(`/league-join-requests/${data.league_id}`);
      } else if (data.screen === 'chat') {
        router.push(`/league/${data.league_id}?tab=chat`);
      } else if (data.trade_id) {
        router.push(`/league/${data.league_id}?tab=trades`);
      } else {
        router.push(`/league/${data.league_id}`);
      }
    }
  };

  const savePushToken = async (token: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const deviceType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
      const deviceName = await Device.deviceName || 'Unknown Device';

      // Upsert device token
      await supabase
        .from('user_devices')
        .upsert({
          user_id: user.id,
          push_token: token,
          device_name: deviceName,
          device_type: deviceType,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,push_token'
        });
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const getUnreadCount = async (): Promise<number> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data, error } = await supabase
        .rpc('get_unread_notification_count', { p_user_id: user.id });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  };

  return {
    expoPushToken,
    notification,
    markNotificationAsRead,
    getUnreadCount,
  };
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert('Permission Required', 'Failed to get push token for push notification!');
      return;
    }
    
    // Get project ID from app.json
    const projectId = '3c806ee6-19c7-4fa4-a3c9-4e34e73e0b5a';
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    })).data;
  } else {
    Alert.alert('Device Required', 'Must use physical device for Push Notifications');
  }

  return token;
}
