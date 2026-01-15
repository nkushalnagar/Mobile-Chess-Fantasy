import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Image, TextInput } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useTheme } from '@/contexts/ThemeContext';
import { getRatingForTimeControl } from '@/utils/ratingHelper';
import PlayerProfileModal from '@/components/PlayerProfileModal';

interface Tournament {
  id: string;
  name: string;
  icon_url?: string;
  status: 'upcoming' | 'active' | 'completed';
  start_date?: string;
  end_date?: string;
}

interface Pairing {
  id: string;
  round_number: number;
  result: string | null;
  opening_name?: string;
  eco_code?: string;
  move_count?: number;
  lichess_game_url?: string;
  white_player: {
    fide_id: string;
    name: string;
    title?: string;
    rating: number;
    rapid_rating?: number;
    blitz_rating?: number;
    country: string;
  };
  black_player: {
    fide_id: string;
    name: string;
    title?: string;
    rating: number;
    rapid_rating?: number;
    blitz_rating?: number;
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
    fide_id: string;
    name: string;
    title?: string;
    rating: number;
    rapid_rating?: number;
    blitz_rating?: number;
    country: string;
  };
}

type ViewMode = 'standings' | 'pairings';

export default function FeedTab() {
  const { colors } = useTheme();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [loading, setLoading] = useState(true);
  const [maxRound, setMaxRound] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('standings');
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roundDateTime, setRoundDateTime] = useState<string | null>(null);
  const [pairingsLoading, setPairingsLoading] = useState(false);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Cache for pairings and standings by tournament ID and round
  const [pairingsCache, setPairingsCache] = useState<Record<string, Pairing[]>>({});
  const [standingsCache, setStandingsCache] = useState<Record<string, Standing[]>>({});

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournamentId) {
      // Fetch tournament details including round_schedule
      supabase
        .from('tournaments')
        .select('time_control, round_schedule')
        .eq('id', selectedTournamentId)
        .single()
        .then(({ data }) => {
          setSelectedTournament(data);
          
          // Set maxRound from round_schedule if available
          if (data?.round_schedule && Array.isArray(data.round_schedule) && data.round_schedule.length > 0) {
            const maxRoundFromSchedule = Math.max(...data.round_schedule.map((r: any) => r.round_number || 0));
            if (maxRoundFromSchedule > 0) {
              setMaxRound(maxRoundFromSchedule);
            }
          }
          
          // Extract date/time for current round from round_schedule
          if (data?.round_schedule && Array.isArray(data.round_schedule)) {
            const roundData = data.round_schedule.find((r: any) => r.round_number === currentRound);
            if (roundData?.starts_at) {
              // starts_at is in milliseconds
              const roundDate = new Date(roundData.starts_at);
              setRoundDateTime(roundDate.toISOString());
            } else {
              setRoundDateTime(null);
            }
          } else {
            setRoundDateTime(null);
          }
        });
      
      if (viewMode === 'pairings') {
        fetchPairings();
      } else {
        fetchStandings();
      }
    }
  }, [selectedTournamentId, currentRound, viewMode]);

  // Auto-scroll to latest round with results when tournament is first selected
  useEffect(() => {
    const autoScrollToLatestRound = async () => {
      if (!selectedTournamentId) return;

      try {
        // Find the latest round that has results
        const { data, error } = await supabase
          .from('tournament_pairings')
          .select('round_number, result')
          .eq('tournament_id', selectedTournamentId)
          .not('result', 'is', null)
          .order('round_number', { ascending: false })
          .limit(1)
          .single();

        if (data && !error) {
          setCurrentRound(data.round_number);
        }
      } catch (error) {
        // If no results found, stay at round 1
        console.log('No results found, staying at round 1');
      }
    };

    autoScrollToLatestRound();
  }, [selectedTournamentId]);

  const handleOpenLichess = (url: string | undefined) => {
    if (!url) return;
    WebBrowser.openBrowserAsync(url);
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

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, icon_url, status, start_date, end_date')
        .order('start_date', { ascending: false });

      if (error) throw error;

      setTournaments(data || []);
      // Don't auto-select - let user choose
      setSelectedTournamentId(null);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPairings = async (forceRefresh = false) => {
    if (!selectedTournamentId) return;

    // Check cache first (unless force refresh)
    const cacheKey = `${selectedTournamentId}_${currentRound}`;
    if (!forceRefresh && pairingsCache[cacheKey]) {
      setPairings(pairingsCache[cacheKey]);
      return;
    }

    setPairingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tournament_pairings')
        .select(`
          id,
          round_number,
          result,
          opening_name,
          eco_code,
          move_count,
          lichess_game_url,
          white_player:players!tournament_pairings_white_player_fide_id_fkey(fide_id, name, title, rating, rapid_rating, blitz_rating, country),
          black_player:players!tournament_pairings_black_player_fide_id_fkey(fide_id, name, title, rating, rapid_rating, blitz_rating, country)
        `)
        .eq('tournament_id', selectedTournamentId)
        .eq('round_number', currentRound)
        .order('id');

      if (error) throw error;

      const pairingsData = data as any || [];
      setPairings(pairingsData);
      
      // Store in cache
      setPairingsCache(prev => ({
        ...prev,
        [cacheKey]: pairingsData
      }));

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
    } finally {
      setPairingsLoading(false);
    }
  };

  const fetchStandings = async (forceRefresh = false) => {
    if (!selectedTournamentId) return;

    // Check cache first (unless force refresh)
    const cacheKey = selectedTournamentId;
    if (!forceRefresh && standingsCache[cacheKey]) {
      setStandings(standingsCache[cacheKey]);
      return;
    }

    setStandingsLoading(true);
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
          player:players!tournament_standings_player_fide_id_fkey(fide_id, name, title, rating, rapid_rating, blitz_rating, country)
        `)
        .eq('tournament_id', selectedTournamentId)
        .order('rank');

      if (error) throw error;

      const standingsData = data as any || [];
      setStandings(standingsData);
      
      // Store in cache
      setStandingsCache(prev => ({
        ...prev,
        [cacheKey]: standingsData
      }));
    } catch (error) {
      console.error('Error fetching standings:', error);
    } finally {
      setStandingsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (viewMode === 'pairings') {
      await fetchPairings(true);
    } else {
      await fetchStandings(true);
    }
    setRefreshing(false);
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
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <SkeletonLoader type="matchup" count={6} />
      </View>
    );
  }

  const getTournamentChipStyle = (tournament: Tournament, isSelected: boolean) => {
    let opacity = 1;
    let borderColor = colors.border;
    
    if (isSelected) {
      borderColor = colors.primary;
    } else if (tournament.status === 'completed') {
      opacity = 0.5; // Dimmed for past tournaments
    } else if (tournament.status === 'upcoming') {
      opacity = 0.75; // Slightly dimmed for upcoming
    }
    // active tournaments stay at full opacity
    
    return { opacity, borderColor };
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Tournament Selector */}
        {tournaments.length > 0 && (
          <View style={styles.tournamentSelector}>
            <Text style={[styles.selectorLabel, { color: colors.text }]}>Select Tournament:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tournamentScroll}>
              {tournaments.map((tournament) => {
                const isSelected = selectedTournamentId === tournament.id;
                const chipStyle = getTournamentChipStyle(tournament, isSelected);
                
                return (
                  <TouchableOpacity
                    key={tournament.id}
                    style={[
                      styles.tournamentChip,
                      { 
                        backgroundColor: colors.cardBackground, 
                        borderColor: chipStyle.borderColor,
                        opacity: chipStyle.opacity
                      }
                    ]}
                    onPress={() => {
                      setSelectedTournamentId(tournament.id);
                      setCurrentRound(1);
                    }}
                  >
                  {tournament.icon_url && (
                    <Image
                      source={{ uri: tournament.icon_url }}
                      style={styles.tournamentIcon}
                      resizeMode="contain"
                    />
                  )}
                  <Text style={[
                    styles.tournamentChipText,
                    { color: colors.textSecondary },
                    selectedTournamentId === tournament.id && { color: colors.text }
                  ]}>
                    {tournament.name}
                  </Text>
                </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {tournaments.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tournaments available yet</Text>
          </View>
        ) : !selectedTournamentId ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Select a tournament to view pairings and standings</Text>
          </View>
        ) : (
          <>
            {/* Search Bar and Refresh Button */}
            <View style={styles.searchRow}>
              <View style={[styles.searchContainer, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder={viewMode === 'pairings' ? 'Search players in pairings...' : 'Search players in standings...'}
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity 
                onPress={handleRefresh} 
                style={[styles.refreshButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="refresh" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            {/* View Mode Toggle */}
            <View style={[styles.viewModeToggle, { backgroundColor: colors.background }]}>
              <TouchableOpacity
                style={[styles.toggleButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }, viewMode === 'standings' && { backgroundColor: colors.primary }]}
                onPress={() => setViewMode('standings')}
              >
                <Text style={[styles.toggleButtonText, { color: colors.textSecondary }, viewMode === 'standings' && { color: '#fff' }]}>
                  Standings
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }, viewMode === 'pairings' && { backgroundColor: colors.primary }]}
                onPress={() => setViewMode('pairings')}
              >
                <Text style={[styles.toggleButtonText, { color: colors.textSecondary }, viewMode === 'pairings' && { color: '#fff' }]}>
                  Pairings
                </Text>
              </TouchableOpacity>
            </View>

            {viewMode === 'standings' ? (
              standingsLoading ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={[styles.standingRow, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                      <View style={[styles.skeletonBox, { width: 40, height: 20, backgroundColor: colors.border }]} />
                      <View style={styles.standingPlayerInfo}>
                        <View style={[styles.skeletonBox, { width: 150, height: 18, backgroundColor: colors.border, marginBottom: 4 }]} />
                        <View style={[styles.skeletonBox, { width: 100, height: 14, backgroundColor: colors.border }]} />
                      </View>
                      <View style={styles.standingStats}>
                        <View style={[styles.skeletonBox, { width: 30, height: 20, backgroundColor: colors.border, marginBottom: 4 }]} />
                        <View style={[styles.skeletonBox, { width: 50, height: 14, backgroundColor: colors.border }]} />
                      </View>
                    </View>
                  ))}
                </>
              ) : standings.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No standings available yet</Text>
                    </View>
                  ) : (
                    standings
                      .filter(standing => {
                        if (!searchQuery.trim()) return true;
                        const query = searchQuery.toLowerCase();
                        const playerName = standing.player?.name?.toLowerCase() || '';
                        return playerName.includes(query);
                      })
                      .map((standing) => (
                      <View key={standing.rank} style={[styles.standingRow, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.rankText, { color: colors.primary }]}>#{standing.rank}</Text>
                        <View style={styles.standingPlayerInfo}>
                          {standing.player?.fide_id ? (
                            <TouchableOpacity onPress={() => handlePlayerClick(standing.player.fide_id, standing.player)}>
                              <Text style={[styles.playerName, { color: colors.text }]}>
                                {standing.player?.title && (
                                  <Text style={styles.playerTitle}>{standing.player.title} </Text>
                                )}
                                {standing.player?.name || 'Unknown'}
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={[styles.playerName, { color: colors.text }]}>
                              {standing.player?.title && (
                                <Text style={styles.playerTitle}>{standing.player.title} </Text>
                              )}
                              {standing.player?.name || 'Unknown'}
                            </Text>
                          )}
                          <Text style={[styles.playerDetails, { color: colors.textSecondary }]}>
                            {standing.player?.country || '—'} • {getRatingForTimeControl(standing.player || { rating: 0 }, selectedTournament?.time_control)}
                          </Text>
                        </View>
                        <View style={styles.standingStats}>
                          <Text style={[styles.standingPoints, { color: '#10b981' }]}>{standing.points}</Text>
                          <Text style={[styles.standingRecord, { color: colors.textSecondary }]}>
                            {standing.wins}-{standing.draws}-{standing.losses}
                          </Text>
                        </View>
                      </View>
                    ))
                  )
            ) : (
              <>
                {/* Round Selector */}
                <View style={styles.roundSelector}>
                  <TouchableOpacity
                    onPress={() => setCurrentRound(Math.max(1, currentRound - 1))}
                    disabled={currentRound === 1}
                    style={[styles.roundButton, { backgroundColor: colors.primary }, currentRound === 1 && styles.roundButtonDisabled]}
                  >
                    <Text style={styles.roundButtonText}>←</Text>
                  </TouchableOpacity>
                  <View style={styles.roundInfo}>
                    <Text style={[styles.roundText, { color: colors.text }]}>Round {currentRound}</Text>
                    {roundDateTime && (
                      <Text style={[styles.roundDate, { color: colors.textSecondary }]}>
                        {new Date(roundDateTime).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })} • {new Date(roundDateTime).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true
                        })}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setCurrentRound(Math.min(maxRound, currentRound + 1))}
                    disabled={currentRound === maxRound}
                    style={[styles.roundButton, { backgroundColor: colors.primary }, currentRound === maxRound && styles.roundButtonDisabled]}
                  >
                    <Text style={styles.roundButtonText}>→</Text>
                  </TouchableOpacity>
                </View>

                {pairingsLoading ? (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <View key={i} style={[styles.matchResult, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View style={styles.playerRow}>
                          <View style={styles.playerInfo}>
                            <View style={[styles.skeletonBox, { width: 150, height: 18, backgroundColor: colors.border, marginBottom: 4 }]} />
                            <View style={[styles.skeletonBox, { width: 100, height: 14, backgroundColor: colors.border }]} />
                          </View>
                          <View style={[styles.skeletonBox, { width: 30, height: 20, backgroundColor: colors.border }]} />
                        </View>
                        <View style={styles.playerRow}>
                          <View style={styles.playerInfo}>
                            <View style={[styles.skeletonBox, { width: 150, height: 18, backgroundColor: colors.border, marginBottom: 4 }]} />
                            <View style={[styles.skeletonBox, { width: 100, height: 14, backgroundColor: colors.border }]} />
                          </View>
                          <View style={[styles.skeletonBox, { width: 30, height: 20, backgroundColor: colors.border }]} />
                        </View>
                      </View>
                    ))}
                  </>
                ) : pairings.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pairings for this round yet</Text>
                  </View>
                ) : (
                  pairings
                    .filter(pairing => {
                      if (!searchQuery.trim()) return true;
                      const query = searchQuery.toLowerCase();
                      const whiteName = pairing.white_player?.name?.toLowerCase() || '';
                      const blackName = pairing.black_player?.name?.toLowerCase() || '';
                      return whiteName.includes(query) || blackName.includes(query);
                    })
                    .map((pairing) => (
                    <TouchableOpacity 
                      key={pairing.id} 
                      style={[styles.matchResult, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                      onPress={() => handleOpenLichess(pairing.lichess_game_url)}
                      disabled={!pairing.lichess_game_url}
                    >
                      <View style={styles.playerRow}>
                        <View style={styles.playerInfo}>
                          <View style={styles.playerNameRow}>
                            {pairing.white_player ? (
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handlePlayerClick(pairing.white_player.fide_id, pairing.white_player);
                                }}
                              >
                                <Text style={[styles.playerName, { color: colors.text }]}>
                                  {pairing.white_player?.title && (
                                    <Text style={styles.playerTitle}>{pairing.white_player.title} </Text>
                                  )}
                                  {pairing.white_player?.name || 'Unknown'}
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={[styles.playerName, { color: colors.text }]}>Unknown</Text>
                            )}
                            {!pairing.white_player && (
                              <TouchableOpacity 
                                onPress={(e) => {
                                  e.stopPropagation();
                                  Alert.alert(
                                    'Player Not Eligible',
                                    'This player does not have a K-factor of 10 and is not established enough for fantasy recognition.'
                                  );
                                }}
                                style={styles.infoIcon}
                              >
                                <Ionicons name="information-circle-outline" size={16} color="#666" />
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={[styles.playerDetails, { color: colors.textSecondary }]}>  
                            {pairing.white_player?.country || '—'} • {getRatingForTimeControl(pairing.white_player || { rating: 0 }, selectedTournament?.time_control)}
                          </Text>
                        </View>
                        <Text style={[styles.score, { color: '#60a5fa' }]}>{getScoreDisplay(pairing.result, true)}</Text>
                      </View>
                      <View style={styles.playerRow}>
                        <View style={styles.playerInfo}>
                          <View style={styles.playerNameRow}>
                            {pairing.black_player ? (
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handlePlayerClick(pairing.black_player.fide_id, pairing.black_player);
                                }}
                              >
                                <Text style={[styles.playerName, { color: colors.text }]}>
                                  {pairing.black_player?.title && (
                                    <Text style={styles.playerTitle}>{pairing.black_player.title} </Text>
                                  )}
                                  {pairing.black_player?.name || 'Unknown'}
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={[styles.playerName, { color: colors.text }]}>Unknown</Text>
                            )}
                            {!pairing.black_player && (
                              <TouchableOpacity 
                                onPress={(e) => {
                                  e.stopPropagation();
                                  Alert.alert(
                                    'Player Not Eligible',
                                    'This player does not have a K-factor of 10 and is not established enough for fantasy recognition.'
                                  );
                                }}
                                style={styles.infoIcon}
                              >
                                <Ionicons name="information-circle-outline" size={16} color="#666" />
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={[styles.playerDetails, { color: colors.textSecondary }]}>
                            {pairing.black_player?.country || '—'} • {getRatingForTimeControl(pairing.black_player || { rating: 0 }, selectedTournament?.time_control)}
                          </Text>
                        </View>
                        <Text style={[styles.score, { color: '#60a5fa' }]}>{getScoreDisplay(pairing.result, false)}</Text>
                      </View>
                      {(pairing.opening_name || pairing.move_count) && (
                        <View style={[styles.gameMetadata, { borderTopColor: colors.border }]}>
                          {pairing.opening_name && (
                            <Text style={[styles.openingText, { color: colors.textSecondary }]} numberOfLines={1}>
                              {pairing.opening_name}
                            </Text>
                          )}
                          {pairing.move_count && (
                            <Text style={[styles.moveCountText, { color: colors.textSecondary }]}>
                              {pairing.move_count} moves
                            </Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}
          </>
        )}
      </View>
      <PlayerProfileModal
        visible={playerModalVisible}
        player={selectedPlayer}
        onClose={() => setPlayerModalVisible(false)}
      />
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  tournamentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#334155',
    gap: 8,
  },
  tournamentChipSelected: {
    backgroundColor: '#1e3a8a',
    borderColor: '#2563eb',
  },
  tournamentIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
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
  roundInfo: {
    alignItems: 'center',
    gap: 4,
  },
  roundDate: {
    fontSize: 12,
    color: '#94a3b8',
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
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  playerName: {
    fontSize: 16,
    color: '#fff',
  },
  infoIcon: {
    padding: 2,
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
  gameMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  openingText: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  moveCountText: {
    fontSize: 12,
    fontWeight: '600',
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
  skeletonBox: {
    borderRadius: 6,
    opacity: 0.5,
  },
});
