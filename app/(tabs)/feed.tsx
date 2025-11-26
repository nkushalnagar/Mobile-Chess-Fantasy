import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';

interface Tournament {
  id: string;
  name: string;
}

interface Pairing {
  id: string;
  round_number: number;
  result: string | null;
  white_player: {
    name: string;
    title?: string;
    rating: number;
    country: string;
  };
  black_player: {
    name: string;
    title?: string;
    rating: number;
    country: string;
  };
}

interface Standing {
  rank: number;
  points: number;
  games_played: number;
  wins: number;
  draws: number;
  losses: number;
  player: {
    name: string;
    title?: string;
    rating: number;
    country: string;
  };
}

type ViewMode = 'pairings' | 'standings';

export default function FeedTab() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [loading, setLoading] = useState(true);
  const [maxRound, setMaxRound] = useState(7);
  const [viewMode, setViewMode] = useState<ViewMode>('pairings');

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournamentId) {
      if (viewMode === 'pairings') {
        fetchPairings();
      } else {
        fetchStandings();
      }
    }
  }, [selectedTournamentId, currentRound, viewMode]);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('status', 'active')  // Only show active tournaments
        .order('start_date', { ascending: false });

      if (error) throw error;

      setTournaments(data || []);
      if (data && data.length > 0) {
        setSelectedTournamentId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPairings = async () => {
    if (!selectedTournamentId) return;

    try {
      const { data, error } = await supabase
        .from('tournament_pairings')
        .select(`
          id,
          round_number,
          result,
          white_player:players!tournament_pairings_white_player_fide_id_fkey(name, title, rating, country),
          black_player:players!tournament_pairings_black_player_fide_id_fkey(name, title, rating, country)
        `)
        .eq('tournament_id', selectedTournamentId)
        .eq('round_number', currentRound)
        .order('id');

      if (error) throw error;

      setPairings(data as any || []);

      // Get max round for this tournament
      const { data: maxRoundData } = await supabase
        .from('tournament_pairings')
        .select('round_number')
        .eq('tournament_id', selectedTournamentId)
        .order('round_number', { ascending: false })
        .limit(1)
        .single();

      if (maxRoundData) {
        setMaxRound(maxRoundData.round_number);
      }
    } catch (error) {
      console.error('Error fetching pairings:', error);
    }
  };

  const fetchStandings = async () => {
    if (!selectedTournamentId) return;

    try {
      const { data, error } = await supabase
        .from('tournament_standings')
        .select(`
          rank,
          points,
          games_played,
          wins,
          draws,
          losses,
          player:players!tournament_standings_player_fide_id_fkey(name, title, rating, country)
        `)
        .eq('tournament_id', selectedTournamentId)
        .order('rank');

      if (error) throw error;

      setStandings(data as any || []);
    } catch (error) {
      console.error('Error fetching standings:', error);
    }
  };

  const getScoreDisplay = (result: string | null, isWhite: boolean) => {
    if (!result) return '-';
    if (result === 'white_win') return isWhite ? '1' : '0';
    if (result === 'black_win') return isWhite ? '0' : '1';
    if (result === 'draw') return '½';
    return '-';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Tournament Selector */}
        {tournaments.length > 0 && (
          <View style={styles.tournamentSelector}>
            <Text style={styles.selectorLabel}>Select Tournament:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tournamentScroll}>
              {tournaments.map((tournament) => (
                <TouchableOpacity
                  key={tournament.id}
                  style={[
                    styles.tournamentChip,
                    selectedTournamentId === tournament.id && styles.tournamentChipSelected
                  ]}
                  onPress={() => {
                    setSelectedTournamentId(tournament.id);
                    setCurrentRound(1);
                  }}
                >
                  <Text style={[
                    styles.tournamentChipText,
                    selectedTournamentId === tournament.id && styles.tournamentChipTextSelected
                  ]}>
                    {tournament.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {tournaments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No tournaments available yet</Text>
          </View>
        ) : (
          <>
            {/* View Mode Toggle */}
            <View style={styles.viewModeToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, viewMode === 'pairings' && styles.toggleButtonActive]}
                onPress={() => setViewMode('pairings')}
              >
                <Text style={[styles.toggleButtonText, viewMode === 'pairings' && styles.toggleButtonTextActive]}>
                  Pairings
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, viewMode === 'standings' && styles.toggleButtonActive]}
                onPress={() => setViewMode('standings')}
              >
                <Text style={[styles.toggleButtonText, viewMode === 'standings' && styles.toggleButtonTextActive]}>
                  Standings
                </Text>
              </TouchableOpacity>
            </View>

            {viewMode === 'pairings' ? (
              <>
                {/* Round Selector */}
                <View style={styles.roundSelector}>
              <TouchableOpacity
                onPress={() => setCurrentRound(Math.max(1, currentRound - 1))}
                disabled={currentRound === 1}
                style={[styles.roundButton, currentRound === 1 && styles.roundButtonDisabled]}
              >
                <Text style={styles.roundButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.roundText}>Round {currentRound}</Text>
              <TouchableOpacity
                onPress={() => setCurrentRound(Math.min(maxRound, currentRound + 1))}
                disabled={currentRound === maxRound}
                style={[styles.roundButton, currentRound === maxRound && styles.roundButtonDisabled]}
              >
                <Text style={styles.roundButtonText}>→</Text>
              </TouchableOpacity>
            </View>

            {/* Pairings */}
            {pairings.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No pairings for this round yet</Text>
              </View>
            ) : (
              pairings.map((pairing) => (
                <View key={pairing.id} style={styles.matchResult}>
                  <View style={styles.playerRow}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>
                        {pairing.white_player?.title && (
                          <Text style={styles.playerTitle}>{pairing.white_player.title} </Text>
                        )}
                        {pairing.white_player?.name || 'TBD'}
                      </Text>
                      <Text style={styles.playerDetails}>
                        {pairing.white_player?.country || '—'} • {pairing.white_player?.rating || '—'}
                      </Text>
                    </View>
                    <Text style={styles.score}>{getScoreDisplay(pairing.result, true)}</Text>
                  </View>
                  <View style={styles.playerRow}>
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>
                        {pairing.black_player?.title && (
                          <Text style={styles.playerTitle}>{pairing.black_player.title} </Text>
                        )}
                        {pairing.black_player?.name || 'TBD'}
                      </Text>
                      <Text style={styles.playerDetails}>
                        {pairing.black_player?.country || '—'} • {pairing.black_player?.rating || '—'}
                      </Text>
                    </View>
                    <Text style={styles.score}>{getScoreDisplay(pairing.result, false)}</Text>
                  </View>
                </View>
              ))
            )}
              </>
            ) : (
              /* Standings View */
              standings.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No standings available yet</Text>
                </View>
              ) : (
                standings.map((standing) => (
                  <View key={standing.rank} style={styles.standingRow}>
                    <Text style={styles.rankText}>#{standing.rank}</Text>
                    <View style={styles.standingPlayerInfo}>
                      <Text style={styles.playerName}>
                        {standing.player?.title && (
                          <Text style={styles.playerTitle}>{standing.player.title} </Text>
                        )}
                        {standing.player?.name || 'Unknown'}
                      </Text>
                      <Text style={styles.playerDetails}>
                        {standing.player?.country || '—'} • {standing.player?.rating || '—'}
                      </Text>
                    </View>
                    <View style={styles.standingStats}>
                      <Text style={styles.standingPoints}>{standing.points}</Text>
                      <Text style={styles.standingRecord}>
                        {standing.wins}-{standing.draws}-{standing.losses}
                      </Text>
                    </View>
                  </View>
                ))
              )
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  tournamentSelector: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  tournamentScroll: {
    flexGrow: 0,
  },
  tournamentChip: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#334155',
  },
  tournamentChipSelected: {
    backgroundColor: '#1e3a8a',
    borderColor: '#2563eb',
  },
  tournamentChipText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  tournamentChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  roundSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  roundButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 12,
    minWidth: 44,
    alignItems: 'center',
  },
  roundButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  roundButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  roundText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  matchResult: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 2,
  },
  playerTitle: {
    color: '#fbbf24',
    fontWeight: '600',
  },
  playerDetails: {
    fontSize: 12,
    color: '#94a3b8',
  },
  score: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#60a5fa',
    minWidth: 30,
    textAlign: 'right',
  },
  emptyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#2563eb',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#60a5fa',
    minWidth: 40,
  },
  standingPlayerInfo: {
    flex: 1,
  },
  standingStats: {
    alignItems: 'flex-end',
  },
  standingPoints: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 2,
  },
  standingRecord: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
