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
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
  const [invites, setInvites] = useState<LeagueInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { user, profile } = useAuth();

  const loadInvites = useCallback(async () => {
    if (!profile?.username) {
      setLoading(false);
      return;
    }

    try {
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
  }, [profile]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const onRefresh = () => {
    setRefreshing(true);
    loadInvites();
  };

  const handleInvite = async (inviteId: string, leagueId: string, accept: boolean) => {
    if (!user) return;

    try {
      if (accept) {
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

  const renderInvite = ({ item }: { item: LeagueInvite }) => (
    <View style={styles.inviteCard}>
      <View style={styles.inviteHeader}>
        <Text style={styles.inviteTitle}>League Invite</Text>
        <Text style={styles.inviteDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.leagueName}>{item.league.name}</Text>
      <Text style={styles.inviteFrom}>From {item.league.owner.username}</Text>
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
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {invites.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>📬</Text>
          <Text style={styles.emptyText}>No pending notifications</Text>
        </View>
      ) : (
        <FlatList
          data={invites}
          renderItem={renderInvite}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#94a3b8',
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
  },
  inviteFrom: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
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
});
