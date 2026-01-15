import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import SkeletonLoader from '@/components/SkeletonLoader';

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
  const { leaguesPageData, setLeaguesPageData } = useDataCache();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const router = useRouter();
  const { user, profile } = useAuth();
  const { colors } = useTheme();

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

      const leagueData = data
        ?.map((membership: any) => membership.leagues)
        .filter(Boolean) || [];

      setLeaguesPageData(leagueData);
    } catch (error) {
      console.error('Error fetching leagues:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user && leaguesPageData === null) {
      setLoading(true);
      fetchLeagues();
    }
    if (profile) {
      loadNotificationCount();
      const interval = setInterval(loadNotificationCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user, profile, leaguesPageData, loadNotificationCount]);

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
      style={[styles.leagueCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
      onPress={() => router.push(`/league/${item.id}?from=leagues`)}
    >
      <Image
        source={getEmblemForLeague(item.id)}
        style={styles.leagueEmblem}
        resizeMode="contain"
      />
      <View style={styles.leagueInfo}>
        <Text style={[styles.leagueName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
        <View style={styles.leagueDetails}>
          <View style={styles.detailRow}>
            <Image
              source={require('@/assets/images/fantasy pawns/15.png')}
              style={styles.detailIcon}
              tintColor={colors.textSecondary}
            />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>{item.max_members} members</Text>
          </View>
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>📋 {item.picks_per_person} picks</Text>
        </View>
      </View>
      <View style={[styles.leagueTypeBadge, { borderColor: colors.primary }]}>
        <Text style={[styles.leagueTypeText, { color: colors.text }]}>{getLeagueTypeLabel(item)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SkeletonLoader type="league" count={4} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!leaguesPageData || leaguesPageData.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyStateContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <TouchableOpacity
            style={[styles.publicLeaguesCard, { backgroundColor: colors.cardBackground, borderColor: colors.border, marginBottom: 24, marginTop: 16 }]}
            onPress={() => router.push('/public-leagues')}
          >
            <Text style={styles.publicLeaguesIcon}>🌐</Text>
            <View style={styles.publicLeaguesInfo}>
              <Text style={[styles.publicLeaguesTitle, { color: colors.text }]}>Browse Public Leagues</Text>
              <Text style={[styles.publicLeaguesSubtitle, { color: colors.textSecondary }]}>Discover and join leagues from the community</Text>
            </View>
            <Text style={[styles.publicLeaguesArrow, { color: colors.textTertiary }]}>›</Text>
          </TouchableOpacity>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Leagues Yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Create or join a league to get started!</Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/create-league?from=leagues')}
          >
            <Text style={styles.createButtonText}>Create League</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          <FlatList
            data={leaguesPageData}
            renderItem={renderLeague}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListHeaderComponent={
              <TouchableOpacity
                style={[styles.publicLeaguesCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => router.push('/public-leagues')}
              >
                <Text style={styles.publicLeaguesIcon}>🌐</Text>
                <View style={styles.publicLeaguesInfo}>
                  <Text style={[styles.publicLeaguesTitle, { color: colors.text }]}>Browse Public Leagues</Text>
                  <Text style={[styles.publicLeaguesSubtitle, { color: colors.textSecondary }]}>Discover and join leagues from the community</Text>
                </View>
                <Text style={[styles.publicLeaguesArrow, { color: colors.textTertiary }]}>›</Text>
              </TouchableOpacity>
            }
          />
          <View style={[styles.bottomButtonContainer, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[styles.bottomButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/create-league?from=leagues')}
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
  emptyStateContent: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 0,
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
    paddingRight: 100, // Prevent overlap with badge
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
  publicLeaguesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  publicLeaguesIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  publicLeaguesInfo: {
    flex: 1,
  },
  publicLeaguesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  publicLeaguesSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  publicLeaguesArrow: {
    fontSize: 24,
    color: '#64748b',
    marginLeft: 8,
  },
});
