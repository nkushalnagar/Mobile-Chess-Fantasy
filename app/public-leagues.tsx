import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, TextInput } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import SkeletonLoader from '@/components/SkeletonLoader';

interface PublicLeague {
  id: string;
  name: string;
  league_type: 'tournament' | 'season';
  max_members: number;
  picks_per_person: number;
  status: string;
  created_at: string;
  owner_id: string;
  member_count: number;
  owner_username: string;
}

const KNIGHT_EMBLEMS = ['♔', '♕', '♖', '♗', '♘', '♙'];

const getEmblemForLeague = (leagueId: string): string => {
  const hash = leagueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return KNIGHT_EMBLEMS[hash % KNIGHT_EMBLEMS.length];
};

export default function PublicLeaguesScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [leagues, setLeagues] = useState<PublicLeague[]>([]);
  const [filteredLeagues, setFilteredLeagues] = useState<PublicLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleBack = () => {
    if (from === 'home') {
      router.push('/(tabs)/home');
    } else {
      router.push('/(tabs)/leagues');
    }
  };

  useEffect(() => {
    fetchPublicLeagues();
  }, []);

  const fetchPublicLeagues = async () => {
    try {
      setLoading(true);
      
      // Fetch public leagues with member count and owner info
      const { data, error } = await supabase
        .from('leagues')
        .select(`
          *,
          league_memberships(count),
          profiles!leagues_owner_id_fkey(username)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const leaguesWithCounts = (data || []).map(league => ({
        ...league,
        member_count: league.league_memberships?.[0]?.count || 0,
        owner_username: league.profiles?.username || 'Unknown'
      }));

      setLeagues(leaguesWithCounts);
      setFilteredLeagues(leaguesWithCounts);
    } catch (error) {
      console.error('Error fetching public leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredLeagues(leagues);
      return;
    }

    const lowercaseQuery = query.toLowerCase();
    const filtered = leagues.filter(league => 
      league.name.toLowerCase().includes(lowercaseQuery) ||
      league.owner_username.toLowerCase().includes(lowercaseQuery)
    );
    setFilteredLeagues(filtered);
  };

  const handleViewLeague = (leagueId: string) => {
    router.push(`/league/${leagueId}?from=public-leagues`);
  };

  const handleJoinLeague = (leagueId: string) => {
    router.push(`/join-league/${leagueId}`);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Public Leagues</Text>
            <View style={{ width: 40 }} />
          </View>
          <SkeletonLoader type="league" count={5} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Public Leagues</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Search by league name or creator..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
        </View>

        <ScrollView style={styles.content}>
          {filteredLeagues.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.text }]}>
                {searchQuery ? 'No leagues found' : 'No public leagues yet'}
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                {searchQuery ? 'Try a different search term' : 'Create a public league to get started!'}
              </Text>
            </View>
          ) : (
            filteredLeagues.map((league) => (
              <TouchableOpacity
                key={league.id}
                style={[styles.leagueCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => setSelectedLeague(selectedLeague === league.id ? null : league.id)}
                activeOpacity={1}
              >
                {/* League Info */}
                <View style={[
                  styles.leagueInfo,
                  selectedLeague === league.id && styles.leagueInfoBlurred
                ]}>
                  <View style={styles.leagueHeader}>
                    <View style={styles.emblemContainer}>
                      <Text style={styles.emblem}>{getEmblemForLeague(league.id)}</Text>
                    </View>
                    <View style={styles.leagueDetails}>
                      <Text style={[styles.leagueName, { color: colors.text }]}>{league.name}</Text>
                      <Text style={[styles.leagueOwner, { color: colors.textSecondary }]}>by @{league.owner_username}</Text>
                    </View>
                    <View style={[
                      styles.typeBadge,
                      league.league_type === 'season' ? styles.seasonBadge : styles.tournamentBadge
                    ]}>
                      <Text style={styles.typeBadgeText}>
                        {league.league_type === 'season' ? 'Season' : 'Tournament'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.leagueStats}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Members</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{league.member_count}/{league.max_members}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Picks</Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>{league.picks_per_person}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Status</Text>
                      <Text style={[
                        styles.statValue,
                        league.status === 'open' ? styles.statusOpen : styles.statusClosed
                      ]}>
                        {league.status}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Overlay with Buttons */}
                {selectedLeague === league.id && (
                  <View style={styles.hoverOverlay}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.viewButton]}
                      onPress={() => handleViewLeague(league.id)}
                    >
                      <Text style={styles.actionButtonText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.joinButton]}
                      onPress={() => handleJoinLeague(league.id)}
                    >
                      <Text style={styles.actionButtonText}>Join</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#93c5fd',
    fontSize: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  leagueCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    position: 'relative',
  },
  leagueInfo: {
    padding: 16,
  },
  leagueInfoBlurred: {
    opacity: 0.3,
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  emblemContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emblem: {
    fontSize: 24,
    color: '#fff',
  },
  leagueDetails: {
    flex: 1,
  },
  leagueName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  leagueOwner: {
    fontSize: 14,
    color: '#94a3b8',
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  seasonBadge: {
    backgroundColor: '#10b98120',
  },
  tournamentBadge: {
    backgroundColor: '#f59e0b20',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  leagueStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  statusOpen: {
    color: '#10b981',
  },
  statusClosed: {
    color: '#64748b',
  },
  hoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#64748b',
  },
  joinButton: {
    backgroundColor: '#2563eb',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
