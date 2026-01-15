import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import SkeletonLoader from '@/components/SkeletonLoader';

interface Notification {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  league_id?: string;
  trade_id?: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

interface LeagueInvite {
  id: string;
  league: {
    id: string;
    name: string;
    owner: {
      username: string;
    };
  };
  created_at: string;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invites, setInvites] = useState<LeagueInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();
  const { from } = useLocalSearchParams();
  const { user, profile } = useAuth();
  const { colors } = useTheme();

  const loadInvites = useCallback(async () => {
    if (!profile?.username || !user) {
      setLoading(false);
      return;
    }

    try {
      // Load notifications - show unread + recent read (last 7 days) or all if showAll is true
      // Exclude league_invite notifications since pending invites are shown separately with action buttons
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .neq('notification_type', 'league_invite')
        .order('created_at', { ascending: false });

      if (!showAll) {
        // Only show unread notifications
        query = query.eq('is_read', false);
      }

      const { data: notifData, error: notifError } = await query.limit(50);

      if (notifError) throw notifError;
      setNotifications(notifData || []);

      // Get only pending invites
      const { data: invites, error: invitesError } = await supabase
        .from('league_invites')
        .select('*')
        .eq('invitee_username', profile.username)
        .eq('status', 'pending');

      if (invitesError) throw invitesError;

      if (!invites?.length) {
        setInvites([]);
        return;
      }

      // Get league data
      const { data: leagues, error: leaguesError } = await supabase
        .from('leagues')
        .select('id, name, owner_id')
        .in('id', invites.map(invite => invite.league_id));

      if (leaguesError) throw leaguesError;

      // Get owner usernames
      const { data: owners, error: ownersError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', leagues?.map(league => league.owner_id) || []);

      if (ownersError) throw ownersError;

      // Combine the data
      const formattedInvites = invites
        .map(invite => {
          const league = leagues?.find(l => l.id === invite.league_id);
          const owner = owners?.find(o => o.id === league?.owner_id);
          
          if (!league || !owner) return null;
          
          return {
            id: invite.id,
            created_at: invite.created_at,
            league: {
              id: league.id,
              name: league.name,
              owner: {
                username: owner.username,
              },
            },
          };
        })
        .filter((invite): invite is LeagueInvite => invite !== null);

      setInvites(formattedInvites);
    } catch (error) {
      console.error('Error loading invites:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, showAll]);

  useEffect(() => {
    loadInvites();

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          loadInvites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInvites, user, showAll]);

  const onRefresh = () => {
    setRefreshing(true);
    loadInvites();
  };

  const handleInvite = async (inviteId: string, leagueId: string, accept: boolean) => {
    if (!user) return;

    try {
      if (accept) {
        // Check if league is at max capacity
        const { data: leagueData, error: leagueError } = await supabase
          .from('leagues')
          .select('max_members')
          .eq('id', leagueId)
          .single();

        if (leagueError) throw leagueError;

        const { count: memberCount } = await supabase
          .from('league_memberships')
          .select('*', { count: 'exact' })
          .eq('league_id', leagueId);

        if (memberCount && leagueData && memberCount >= leagueData.max_members) {
          Alert.alert('Error', 'This league is at maximum capacity and cannot accept new members.');
          return;
        }

        // Create league membership
        const { error: membershipError } = await supabase
          .from('league_memberships')
          .insert({
            league_id: leagueId,
            user_id: user.id,
            role: 'member',
          });

        if (membershipError) throw membershipError;
      }

      // Update invite status
      const { error: inviteError } = await supabase
        .from('league_invites')
        .update({
          status: accept ? 'accepted' : 'declined',
        })
        .eq('id', inviteId);

      if (inviteError) throw inviteError;

      // Refresh invites
      loadInvites();

      if (accept) {
        Alert.alert('Success', 'You joined the league!', [
          {
            text: 'View League',
            onPress: () => router.push(`/league/${leagueId}`),
          },
          { text: 'OK' },
        ]);
      } else {
        Alert.alert('Success', 'Invite declined');
      }
    } catch (error) {
      console.error('Error handling invite:', error);
      Alert.alert('Error', 'Failed to process invite');
    }
  };

  const handleNotificationTap = async (notification: Notification) => {
    // Mark as read
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notification.id);

    // Navigate based on notification type
    switch (notification.notification_type) {
      case 'league_invite':
        // Stay on notifications page to handle invite
        break;
      case 'draft_starting':
        if (notification.league_id) {
          router.push(`/draft-room/${notification.league_id}`);
        }
        break;
      case 'chat_message':
        if (notification.league_id) {
          router.push(`/league/${notification.league_id}?tab=chat`);
        }
        break;
      case 'trade_request':
      case 'trade_accepted':
      case 'trade_rejected':
        if (notification.league_id) {
          router.push(`/league/${notification.league_id}`);
        }
        break;
      case 'tournament_starting':
        // Navigate to tournament when implemented
        if (notification.league_id) {
          router.push(`/league/${notification.league_id}`);
        }
        break;
      case 'league_settings_changed':
        if (notification.league_id) {
          router.push(`/league/${notification.league_id}`);
        }
        break;
      case 'league_invite_accepted':
        if (notification.league_id) {
          router.push(`/league/${notification.league_id}`);
        }
        break;
      default:
        if (notification.league_id) {
          router.push(`/league/${notification.league_id}`);
        }
    }

    // Refresh to update read status
    loadInvites();
  };

  const handleClearNotifications = async () => {
    if (!user?.id) return;

    Alert.alert(
      'Clear Notifications',
      'This will clear all notifications except league invites. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all notifications except league invites
              const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id)
                .neq('notification_type', 'league_invite');

              if (error) throw error;

              // Refresh notifications
              loadInvites();
              Alert.alert('Success', 'Notifications cleared');
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications');
            }
          },
        },
      ]
    );
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const getIcon = (type: string) => {
      switch (type) {
        case 'league_invite': return '📨';
        case 'draft_starting': return '🎯';
        case 'chat_message': return '💬';
        case 'trade_request': return '🔄';
        case 'trade_accepted': return '✅';
        case 'trade_rejected': return '❌';
        case 'tournament_starting': return '🏆';
        case 'player_scored': return '⭐';
        case 'news_story': return '📰';
        case 'league_settings_changed': return '⚙️';
        case 'league_invite_accepted': return '👋';
        default: return '🔔';
      }
    };

    return (
      <TouchableOpacity
        style={[styles.notificationCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }, !item.is_read && { borderColor: colors.primary }]}
        onPress={() => handleNotificationTap(item)}
      >
        <View style={styles.notificationHeader}>
          <Text style={styles.notificationIcon}>{getIcon(item.notification_type)}</Text>
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.notificationBody, { color: colors.textSecondary }]}>{item.body}</Text>
            <Text style={[styles.notificationDate, { color: colors.textTertiary }]}>
              {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderInvite = ({ item }: { item: LeagueInvite }) => (
    <View style={[styles.inviteCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={styles.inviteHeader}>
        <Text style={[styles.inviteTitle, { color: colors.text }]}>League Invite</Text>
        <Text style={[styles.inviteDate, { color: colors.textTertiary }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.declineButton]}
          onPress={() => handleInvite(item.id, item.league.id, false)}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.acceptButton]}
          onPress={() => handleInvite(item.id, item.league.id, true)}
        >
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.leagueName, { color: colors.text }]}>{item.league.name}</Text>
      <Text style={[styles.inviteFrom, { color: colors.textSecondary }]}>From {item.league.owner.username}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => {
            if (from === 'leagues') {
              router.push('/(tabs)/leagues');
            } else if (from === 'profile') {
              router.push('/(tabs)/profile');
            } else {
              router.push('/(tabs)/home');
            }
          }} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
          <View style={styles.headerSpacer} />
        </View>
        <SkeletonLoader type="card" count={6} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Back Button */}
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => {
          if (from === 'leagues') {
            router.push('/(tabs)/leagues');
          } else if (from === 'profile') {
            router.push('/(tabs)/profile');
          } else {
            router.push('/(tabs)/home');
          }
        }} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        {(notifications.length > 0 || invites.length > 0) && (
          <TouchableOpacity 
            onPress={handleClearNotifications}
            style={styles.clearButton}
          >
            <Text style={[styles.clearButtonText, { color: colors.primary }]}>Clear</Text>
          </TouchableOpacity>
        )}
        {!(notifications.length > 0 || invites.length > 0) && <View style={styles.headerSpacer} />}
      </View>

      {notifications.length === 0 && invites.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>📬</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...invites.map(i => ({ type: 'invite', data: i })),
            ...notifications.map(n => ({ type: 'notification', data: n }))
          ]}
          renderItem={({ item }) => 
            item.type === 'notification' 
              ? renderNotification({ item: item.data as Notification })
              : renderInvite({ item: item.data as LeagueInvite })
          }
          keyExtractor={(item) => `${item.type}-${item.data.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40, // Same width as back button for centering
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  inviteCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inviteTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  inviteDate: {
    fontSize: 12,
    color: '#64748b',
  },
  leagueName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    marginTop: 16,
  },
  inviteFrom: {
    fontSize: 14,
    color: '#94a3b8',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  declineButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#2563eb',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unreadCard: {
    borderColor: '#2563eb',
    backgroundColor: '#1e2a3b',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notificationIcon: {
    fontSize: 24,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationDate: {
    fontSize: 12,
    color: '#64748b',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginTop: 4,
  },
});
