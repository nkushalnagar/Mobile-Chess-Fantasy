import { Tabs } from 'expo-router';
import { Text, Image, View, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function TabLayout() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const pawnColor = (profile as any)?.pawn_color || '#2563eb';

  // Fetch notification count
  useEffect(() => {
    if (!profile?.id) return;

    const loadNotificationCount = async () => {
      try {
        // Get unread notification count from new notifications table
        const { data, error } = await supabase
          .rpc('get_unread_notification_count', { p_user_id: profile.id });

        if (error) throw error;
        setNotificationCount(data || 0);
      } catch (error) {
        console.error('Error loading notification count:', error);
      }
    };

    loadNotificationCount();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('notification_count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          loadNotificationCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const menuItems = [
    { label: 'Notifications', route: '/notifications?from=home', icon: '🔔' },
    { label: 'Leagues', route: '/(tabs)/leagues', icon: '🏆' },
    { label: 'Profile', route: '/(tabs)/profile', icon: '👤' },
  ];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.cardBackground,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.headerBackground,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: 'Montserrat-Bold',
          fontSize: 20,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          headerTitle: () => (
            <View style={styles.headerTitle}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <Text style={[styles.headerText, { color: colors.text }]}>Fantasy Chess</Text>
            </View>
          ),
          headerRight: () => (
            <>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setMenuVisible(true)}
              >
                <View style={styles.hamburger}>
                  <View style={[styles.hamburgerLine, { backgroundColor: colors.text }]} />
                  <View style={[styles.hamburgerLine, { backgroundColor: colors.text }]} />
                  <View style={[styles.hamburgerLine, { backgroundColor: colors.text }]} />
                </View>
              </TouchableOpacity>
              <Modal
                visible={menuVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
              >
                <Pressable
                  style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
                  onPress={() => setMenuVisible(false)}
                >
                  <View style={[styles.menuDrawer, { backgroundColor: colors.cardBackground }]}>
                    {menuItems.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.menuItem}
                        onPress={() => {
                          setMenuVisible(false);
                          router.push(item.route as any);
                        }}
                      >
                        {item.label === 'Profile' ? (
                          <Image
                            source={require('@/assets/images/fantasy pawns/13.png')}
                            style={styles.menuPawnIcon}
                            tintColor={pawnColor}
                          />
                        ) : (
                          <Text style={styles.menuIcon}>{item.icon}</Text>
                        )}
                        <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Pressable>
              </Modal>
            </>
          ),
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('@/assets/images/logo.png')}
              style={{ width: 28, height: 28, opacity: focused ? 1 : 0.6 }}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: 'My Leagues',
          headerRight: () => (
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push('/notifications?from=leagues')}
            >
              <Text style={styles.bellIcon}>🔔</Text>
              {notificationCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notificationCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ),
          tabBarLabel: 'Leagues',
          tabBarIcon: () => <Text>🏆</Text>,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Results',
          tabBarLabel: 'Results',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: focused ? colors.primary : '#60a5fa' }}>
              1:0
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('@/assets/images/fantasy pawns/13.png')}
              style={{ width: 24, height: 24 }}
              tintColor={focused ? pawnColor : '#64748b'}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Montserrat-Bold',
    textShadowColor: 'rgba(37, 99, 235, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  notificationButton: {
    padding: 4,
    position: 'relative',
    marginRight: 12,
  },
  bellIcon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  menuButton: {
    padding: 4,
    marginRight: 12,
  },
  hamburger: {
    width: 20,
    height: 14,
    justifyContent: 'space-between',
  },
  hamburgerLine: {
    width: 20,
    height: 2.5,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuDrawer: {
    backgroundColor: '#1e293b',
    marginTop: 60,
    marginRight: 8,
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 12,
  },
  menuIcon: {
    fontSize: 20,
    width: 24,
    textAlign: 'center',
  },
  menuPawnIcon: {
    width: 24,
    height: 24,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
