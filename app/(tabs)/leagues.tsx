import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Knight emblem images
const KNIGHT_EMBLEMS = [
  require('@/assets/images/Untitled design/8.png'),
  require('@/assets/images/Untitled design/9.png'),
  require('@/assets/images/Untitled design/10.png'),
  require('@/assets/images/Untitled design/11.png'),
  require('@/assets/images/Untitled design/12.png'),
  require('@/assets/images/Untitled design/Untitled design (2).png'),
];

// Function to get a random emblem based on league ID (consistent per league)
const getEmblemForLeague = (leagueId: string) => {
  const hash = leagueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return KNIGHT_EMBLEMS[hash % KNIGHT_EMBLEMS.length];
};

interface League {
  id: string;
  name: string;
  max_members: number;
  picks_per_person: number;
  created_at: string;
  league_type?: string;
  min_player_rating?: number;
  max_player_rating?: number;
}

export default function LeaguesTab() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const router = useRouter();
  const { user, profile } = useAuth();

  const loadNotificationCount = useCallback(async () => {
    if (!profile?.username) return;

    try {
      const { data, error } = await supabase
        .from('league_invites')
        .select('id', { count: 'exact', head: true })
        .eq('invitee_username', profile.username)
        .eq('status', 'pending');

      if (error) throw error;
      setNotificationCount(data?.length || 0);
    } catch (error) {
      console.error('Error loading notification count:', error);
    }
  }, [profile]);

  const fetchLeagues = async () => {
    try {
      const { data, error } = await supabase
        .from('league_memberships')
        .select('league_id, leagues(id, name, max_members, picks_per_person, created_at, league_type, min_player_rating, max_player_rating)')
        .eq('user_id', user?.id);

      if (error) throw error;

      const leagueData = data?.map((item: any) => item.leagues).filter(Boolean) || [];
      setLeagues(leagueData);
    } catch (error) {
      console.error('Error fetching leagues:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLeagues();
    }
    if (profile) {
      loadNotificationCount();
      const interval = setInterval(loadNotificationCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, profile, loadNotificationCount]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeagues();
  };

  const getLeagueTypeLabel = (league: League) => {
    if (league.league_type === 'season') {
      if (league.min_player_rating) {
        return `Season (${league.min_player_rating}+)`;
      }
      return 'Season';
    }
    return 'Tournament';
  };

  const renderLeague = ({ item }: { item: League }) => (
    <TouchableOpacity
      style={styles.leagueCard}
      onPress={() => router.push(`/league/${item.id}`)}
    >
      <Image
        source={getEmblemForLeague(item.id)}
        style={styles.leagueEmblem}
        resizeMode="contain"
      />
      <View style={styles.leagueInfo}>
        <Text style={styles.leagueName} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
        <View style={styles.leagueDetails}>
          <View style={styles.detailRow}>
            <Image
              source={require('@/assets/images/fantasy pawns/15.png')}
              style={styles.detailIcon}
              tintColor="#94a3b8"
            />
            <Text style={styles.detailText}>{item.max_members} members</Text>
          </View>
          <Text style={styles.detailText}>📋 {item.picks_per_person} picks</Text>
        </View>
      </View>
      <View style={styles.leagueTypeBadge}>
        <Text style={styles.leagueTypeText}>{getLeagueTypeLabel(item)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading leagues...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {leagues.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyTitle}>No Leagues Yet</Text>
          <Text style={styles.emptyText}>Create or join a league to get started!</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/create-league')}
          >
            <Text style={styles.createButtonText}>Create League</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={leagues}
            renderItem={renderLeague}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
            }
          />
          <View style={styles.bottomButtonContainer}>
            <TouchableOpacity
              style={styles.bottomButton}
              onPress={() => router.push('/create-league')}
            >
              <Text style={styles.bottomButtonText}>+ Create League</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 24,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  leagueCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueEmblem: {
    width: 60,
    height: 60,
    marginRight: 12,
    marginLeft: -8,
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  leagueDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: -4,
  },
  detailIcon: {
    width: 20,
    height: 20,
    marginRight: -2,
  },
  detailText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  leagueTypeBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leagueTypeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  bottomButtonContainer: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  bottomButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  bottomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
