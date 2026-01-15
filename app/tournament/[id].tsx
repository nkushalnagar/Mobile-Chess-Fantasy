import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { Ionicons } from '@expo/vector-icons';
import PlayerProfileModal from '@/components/PlayerProfileModal';
import SkeletonLoader from '@/components/SkeletonLoader';

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string | null;
  time_control: string | null;
  prize_fund: number | null;
  description: string | null;
  status: string;
  is_active: boolean;
  tournament_type: string | null;
  is_online: boolean;
  icon_url: string | null;
}

interface Player {
  fide_id: string;
  name: string;
  rating: number | null;
  country: string | null;
  title: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  rapid_rating: number | null;
  blitz_rating: number | null;
}

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { getTournamentPlayers, setTournamentPlayers } = useDataCache();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);

  useEffect(() => {
    fetchTournamentDetails();
  }, [id]);

  const fetchTournamentDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Fetch tournament details
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      // Check if players are already cached
      const cachedPlayers = getTournamentPlayers(id);
      if (cachedPlayers) {
        setPlayers(cachedPlayers);
      } else {
        // Fetch players directly from players table using tournament_id array
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('fide_id, name, rating, country, title, profile_picture_url, bio, rapid_rating, blitz_rating')
          .contains('tournament_id', [id])
          .order('rating', { ascending: false, nullsFirst: false });

        if (playersError) throw playersError;
        const players = playersData || [];
        setPlayers(players);
        // Cache the players data
        setTournamentPlayers(id, players);
      }
    } catch (error) {
      console.error('Error fetching tournament details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatPrizeFund = (amount: number | null) => {
    if (!amount) return 'N/A';
    return `€${amount.toLocaleString()}`;
  };

  const handlePlayerClick = async (fideId: string, playerData: any) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('fide_id, name, title, rating, rapid_rating, blitz_rating, country, profile_picture_url, bio')
        .eq('fide_id', fideId)
        .single();
      if (error) throw error;
      setSelectedPlayer(data || playerData);
      setPlayerModalVisible(true);
    } catch (error) {
      console.error('Error fetching player details:', error);
      setSelectedPlayer({ ...playerData, fide_id: fideId });
      setPlayerModalVisible(true);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={{ fontSize: 28, color: colors.text }}>←</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <SkeletonLoader type="card" count={6} />
        </ScrollView>
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Tournament not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {tournament.name}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Tournament Info Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tournament Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: (() => {
              const now = new Date();
              const startDate = new Date(tournament.start_date);
              const endDate = new Date(tournament.end_date);
              const isLive = now >= startDate && now <= endDate;
              return isLive ? '#ef4444' : '#64748b';
            })() }]}>
              <Text style={styles.statusText}>{(() => {
                const now = new Date();
                const startDate = new Date(tournament.start_date);
                const endDate = new Date(tournament.end_date);
                const isLive = now >= startDate && now <= endDate;
                return isLive ? 'LIVE' : tournament.status.toUpperCase();
              })()}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Dates</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
            </Text>
          </View>

          {tournament.location && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Location</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{tournament.location}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Format</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {tournament.is_online ? 'Online' : 'Over the Board'}
            </Text>
          </View>

          {tournament.time_control && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Time Control</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {tournament.time_control.charAt(0).toUpperCase() + tournament.time_control.slice(1)}
              </Text>
            </View>
          )}

          {tournament.tournament_type && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Type</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {tournament.tournament_type.charAt(0).toUpperCase() + tournament.tournament_type.slice(1)}
              </Text>
            </View>
          )}

          {tournament.prize_fund && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Prize Fund</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{formatPrizeFund(tournament.prize_fund)}</Text>
            </View>
          )}

          {tournament.description && (
            <View style={styles.descriptionContainer}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Description</Text>
              <Text style={[styles.description, { color: colors.text }]}>{tournament.description}</Text>
            </View>
          )}
        </View>

        {/* Players Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Players ({players.length})
          </Text>
          
          {players.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No players found for this tournament
            </Text>
          ) : (
            <View style={styles.playersList}>
              {players.map((player, index) => (
                <View key={player.fide_id} style={[styles.playerRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.playerRank}>
                    <Text style={[styles.rankText, { color: colors.textSecondary }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <TouchableOpacity onPress={() => handlePlayerClick(player.fide_id, player)}>
                      <Text style={[styles.playerName, { color: colors.text }]}>
                        {player.title && <Text style={styles.playerTitle}>{player.title} </Text>}
                        {player.name}
                      </Text>
                    </TouchableOpacity>
                    {player.country && (
                      <Text style={[styles.playerDetails, { color: colors.textSecondary }]}>
                        {player.country} • {player.rating || 'Unrated'}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Player Profile Modal */}
      <PlayerProfileModal
        visible={playerModalVisible}
        player={selectedPlayer}
        onClose={() => setPlayerModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Montserrat-Bold',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Montserrat-Bold',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    flex: 2,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Montserrat-Bold',
  },
  descriptionContainer: {
    marginTop: 8,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    lineHeight: 20,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Montserrat-Bold',
    textAlign: 'center',
    marginTop: 8,
  },
  playersList: {
    gap: 0,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  playerRank: {
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Montserrat-Bold',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f59e0b',
    fontFamily: 'Montserrat-Bold',
  },
  playerName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Montserrat-Bold',
    flex: 1,
  },
  playerFederation: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    marginTop: 2,
  },
  playerRating: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Montserrat-Bold',
    marginLeft: 12,
  },
  playerDetails: {
    fontSize: 12,
    fontFamily: 'Montserrat-Bold',
    marginTop: 2,
  },
});
