import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { getRatingForTimeControl } from '@/utils/ratingHelper';
import { checkPlayersInOngoingGames } from '@/utils/checkPlayerInOngoingGame';

// Module-level cache to persist across component mounts/unmounts
const ongoingGamesLoadedForLeague = new Set<string>();
// Module-level state to persist ongoing games data across unmounts
const persistedOngoingGamesState = new Map<string, Map<string, { status: 'ongoing' | 'processing', lichessUrl: string }>>();

interface Player {
  fide_id: string;
  name: string;
  rating: number;
  rapid_rating?: number;
  blitz_rating?: number;
  country?: string;
  title?: string;
  time_control?: string;
  tournament_id?: string | null;
}

interface OpenMarketTradingProps {
  leagueId: string;
  teamId: string;
  currentRoster: Player[];
  onTradeComplete: () => void;
  onPlayerClick?: (fideId: string, player: Player) => void;
  timeControl?: string;
  tournamentId?: string | null;
}

export default function OpenMarketTrading({
  leagueId,
  teamId,
  currentRoster,
  onTradeComplete,
  onPlayerClick,
  timeControl,
  tournamentId,
}: OpenMarketTradingProps) {
  const { colors } = useTheme();
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedDrop, setSelectedDrop] = useState<Player | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<Player | null>(null);
  const [dropPlayerTournamentId, setDropPlayerTournamentId] = useState<string | null>(null);
  const [playersInOngoingGames, setPlayersInOngoingGames] = useState<Map<string, { status: 'ongoing' | 'processing', lichessUrl: string }>>(() => {
    // Initialize from persisted state if available
    return persistedOngoingGamesState.get(leagueId) || new Map();
  });
  
  // Use ref to track if we've loaded for this league/tournament combo
  const loadedKeyRef = useRef<string>('');
  const currentKey = `${leagueId}-${tournamentId || 'null'}`;

  // Initial load - only once per league/tournament combination
  useEffect(() => {
    if (loadedKeyRef.current !== currentKey) {
      loadedKeyRef.current = currentKey;
      loadAvailablePlayers(0, true);
    }
  }, [leagueId, tournamentId]);

  // Reload when search changes (only if we've already loaded once)
  useEffect(() => {
    if (loadedKeyRef.current === currentKey && searchQuery !== '') {
      setOffset(0);
      setAvailablePlayers([]);
      setHasMore(true);
      loadAvailablePlayers(0, true);
    }
  }, [searchQuery]);

  // Load ongoing game status once per league using module-level tracking
  useEffect(() => {
    // Small delay to ensure roster is loaded
    const timer = setTimeout(() => {
      loadOngoingGameStatus();
    }, 100);
    return () => clearTimeout(timer);
  }, [leagueId]);

  const loadOngoingGameStatus = async () => {
    try {
      // Only check current roster players - available players don't need ongoing game check
      const allFideIds = currentRoster.map(p => p.fide_id);
      
      if (allFideIds.length === 0) return;
      
      // Check ALL tournaments, not just the selected one
      const ongoingMap = await checkPlayersInOngoingGames(
        allFideIds,
        undefined,  // Don't filter by tournament - check all
        leagueId
      );
      
      // Only update state if the data actually changed to prevent unnecessary re-renders
      setPlayersInOngoingGames(prevMap => {
        // Compare maps to see if anything changed
        if (prevMap.size !== ongoingMap.size) {
          // Persist to module-level state
          persistedOngoingGamesState.set(leagueId, ongoingMap);
          return ongoingMap;
        }
        
        for (const [key, value] of ongoingMap.entries()) {
          if (prevMap.get(key) !== value) {
            // Persist to module-level state
            persistedOngoingGamesState.set(leagueId, ongoingMap);
            return ongoingMap;
          }
        }
        
        // No changes, return previous map to prevent re-render
        return prevMap;
      });
    } catch (error) {
      console.error('Error checking ongoing games:', error);
    }
  };

  const loadAvailablePlayers = async (
    currentOffset: number = offset, 
    isRefresh: boolean = false,
    overrideTournamentId?: string | null
  ) => {
    if (!hasMore && !isRefresh) return;
    
    try {
      if (isRefresh) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      // For open market: show ALL undrafted players from all tournaments
      // Only filter by specific tournament if a player is selected for dropping
      // Use override if provided (to bypass state timing issues), otherwise use state
      const tournamentIdToUse = overrideTournamentId !== undefined ? overrideTournamentId : dropPlayerTournamentId;
      
      
      const { data, error } = await supabase.rpc('get_draftable_players_paginated', {
        p_league_id: leagueId,
        p_tournament_id: tournamentIdToUse,
        p_search_query: searchQuery,
        p_limit: 50,
        p_offset: currentOffset,
      });

      if (error) throw error;
      
      const newPlayers = data || [];
      
      if (newPlayers.length > 0) {
      }
      
      if (isRefresh) {
        setAvailablePlayers(newPlayers);
      } else {
        // Deduplicate: only add players that aren't already in the list
        setAvailablePlayers(prev => {
          const existingIds = new Set(prev.map((p: Player) => p.fide_id));
          const uniqueNewPlayers = newPlayers.filter((p: Player) => !existingIds.has(p.fide_id));
          return [...prev, ...uniqueNewPlayers];
        });
      }
      
      // If we got less than 50 players, we've reached the end
      setHasMore(newPlayers.length === 50);
      setOffset(currentOffset + newPlayers.length);
    } catch (error) {
      console.error('Error loading available players:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadAvailablePlayers(offset, false);
    }
  };

  const handleDropPlayer = async (player: Player) => {
    Alert.alert(
      'Drop Player',
      `Drop ${player.name} to open market? You'll keep all points earned while they were on your team.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Drop',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('drop_player_to_open_market', {
                p_team_id: teamId,
                p_league_id: leagueId,
                p_player_fide_id: player.fide_id,
              });

              if (error) throw error;

              if (data.success) {
                Alert.alert('Success', data.message);
                onTradeComplete();
                setOffset(0);
                setAvailablePlayers([]);
                setHasMore(true);
                loadAvailablePlayers(0, true);
              } else {
                Alert.alert('Error', data.error);
              }
            } catch (error) {
              console.error('Error dropping player:', error);
              Alert.alert('Error', 'Failed to drop player');
            }
          },
        },
      ]
    );
  };

  const handlePickupPlayer = async (player: Player) => {
    Alert.alert(
      'Pick Up Player',
      `Add ${player.name} to your roster? They'll start at 0 points and accumulate from future games.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pick Up',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('pickup_player_from_open_market', {
                p_team_id: teamId,
                p_league_id: leagueId,
                p_player_fide_id: player.fide_id,
                p_tournament_id: tournamentId || null,
              });

              if (error) throw error;

              if (data.success) {
                Alert.alert('Success', data.message);
                onTradeComplete();
                setOffset(0);
                setAvailablePlayers([]);
                setHasMore(true);
                loadAvailablePlayers(0, true);
              } else {
                Alert.alert('Error', data.error);
              }
            } catch (error) {
              console.error('Error picking up player:', error);
              Alert.alert('Error', 'Failed to pick up player');
            }
          },
        },
      ]
    );
  };

  const handleSwapPlayers = async () => {
    if (!selectedDrop || !selectedPickup) return;

    Alert.alert(
      'Swap Players',
      `Drop ${selectedDrop.name} and pick up ${selectedPickup.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Swap',
          onPress: async () => {
            try {
              // Use the tournament_id from the dropped player (stored in state)
              const tournamentIdForSwap = dropPlayerTournamentId || tournamentId || null;
              
              
              const { data, error } = await supabase.rpc('swap_player_open_market', {
                p_team_id: teamId,
                p_league_id: leagueId,
                p_drop_player_fide_id: selectedDrop.fide_id,
                p_pickup_player_fide_id: selectedPickup.fide_id,
                p_tournament_id: tournamentIdForSwap,
              });

              if (error) {
                console.error('❌ Swap error:', error);
                throw error;
              }


              if (data.success) {
                Alert.alert('Success', data.message);
                setSelectedDrop(null);
                setSelectedPickup(null);
                setDropPlayerTournamentId(null);
                onTradeComplete();
                setOffset(0);
                setAvailablePlayers([]);
                setHasMore(true);
                loadAvailablePlayers(0, true);
              } else {
                console.error('❌ Swap failed:', data.error);
                Alert.alert('Error', data.error);
              }
            } catch (error) {
              console.error('❌ Error swapping players:', error);
              Alert.alert('Error', 'Failed to swap players');
            }
          },
        },
      ]
    );
  };

  const renderRosterPlayer = ({ item }: { item: Player }) => {
    const playerStatus = playersInOngoingGames.get(item.fide_id);
    const isInOngoingGame = playersInOngoingGames.has(item.fide_id);
    const lichessUrl = playerStatus?.lichessUrl;
    return (
      <View style={[styles.playerCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        {isInOngoingGame && (
          <TouchableOpacity 
            style={styles.inGameBadge}
            onPress={() => lichessUrl && Linking.openURL(lichessUrl)}
            disabled={!lichessUrl}
          >
            <Text style={styles.inGameBadgeText}>
              {playerStatus?.status === 'ongoing' ? 'IN GAME' : 'PROCESSING'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.playerInfo, isInOngoingGame && { paddingLeft: 30 }]}
          onPress={() => onPlayerClick?.(item.fide_id, item)}
          disabled={!onPlayerClick}
        >
          <Text style={[styles.playerName, { color: colors.text }]}>
            {item.title && <Text style={{ color: '#fbbf24' }}>{item.title} </Text>}{item.name}
          </Text>
          <Text style={[styles.playerDetails, { color: colors.textSecondary }]}>
            {item.country} • {getRatingForTimeControl(item, timeControl)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={isInOngoingGame}
          style={[
            styles.actionButton,
            selectedDrop?.fide_id === item.fide_id && styles.actionButtonSelected,
            isInOngoingGame && { opacity: 0.5 },
          ]}
          onPress={async () => {
          if (selectedDrop?.fide_id === item.fide_id) {
            setSelectedDrop(null);
            const newTournamentId = null;
            setDropPlayerTournamentId(newTournamentId);
            // Reload all players when deselecting
            setOffset(0);
            setAvailablePlayers([]);
            setHasMore(true);
            // Pass null directly to bypass state timing issue
            await loadAvailablePlayers(0, true, newTournamentId);
          } else {
            setSelectedDrop(item);
            // Set the tournament_id of the dropped player to filter available players
            const newTournamentId = item.tournament_id || null;
            setDropPlayerTournamentId(newTournamentId);
            // Reload players filtered by this tournament
            setOffset(0);
            setAvailablePlayers([]);
            setHasMore(true);
            // Pass tournament_id directly to bypass state timing issue
            await loadAvailablePlayers(0, true, newTournamentId);
          }
        }}
      >
        <Text style={styles.actionButtonText}>
          {selectedDrop?.fide_id === item.fide_id ? '✓ Selected' : 'Drop'}
        </Text>
      </TouchableOpacity>
    </View>
    );
  };

  const renderAvailablePlayer = ({ item }: { item: Player }) => {
    const playerStatus = playersInOngoingGames.get(item.fide_id);
    const isInOngoingGame = playersInOngoingGames.has(item.fide_id);
    const lichessUrl = playerStatus?.lichessUrl;
    return (
      <View style={[styles.playerCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        {isInOngoingGame && (
          <TouchableOpacity 
            style={styles.inGameBadge}
            onPress={() => lichessUrl && Linking.openURL(lichessUrl)}
            disabled={!lichessUrl}
          >
            <Text style={styles.inGameBadgeText}>
              {playerStatus?.status === 'ongoing' ? 'IN GAME' : 'PROCESSING'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={[styles.playerInfo, isInOngoingGame && { paddingLeft: 30 }]}
          onPress={() => onPlayerClick?.(item.fide_id, item)}
          disabled={!onPlayerClick}
        >
          <Text style={[styles.playerName, { color: colors.text }]}>
            {item.title && <Text style={{ color: '#fbbf24' }}>{item.title} </Text>}{item.name}
          </Text>
          <Text style={[styles.playerDetails, { color: colors.textSecondary }]}>
            {item.country} • {getRatingForTimeControl(item, timeControl)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={isInOngoingGame || !selectedDrop}
          style={[
            styles.actionButton,
            styles.pickupButton,
            selectedPickup?.fide_id === item.fide_id && styles.actionButtonSelected,
            (isInOngoingGame || !selectedDrop) && { opacity: 0.5 },
          ]}
          onPress={() => {
          if (selectedPickup?.fide_id === item.fide_id) {
            setSelectedPickup(null);
          } else {
            setSelectedPickup(item);
          }
        }}
      >
        <Text style={styles.actionButtonText}>
          {selectedPickup?.fide_id === item.fide_id ? '✓ Selected' : 'Pick Up'}
        </Text>
      </TouchableOpacity>
    </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>🔄 Open Market Trading</Text>
        <TouchableOpacity
          style={[styles.infoButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          onPress={() => Alert.alert(
            'Trading Rules',
            '• Can only trade players from the same tournament\n• Cannot trade players during their games\n• Select one player to drop and one to pick up, then tap Trade\n• Dropped players return to the open market for other teams'
          )}
        >
          <Text style={[styles.infoButtonText, { color: colors.primary }]}>ⓘ</Text>
        </TouchableOpacity>
      </View>
      
      {/* Sticky Swap Button at Top */}
      {selectedDrop && selectedPickup && (
        <View style={[styles.topButtonContainer, { backgroundColor: colors.primary, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.topSwapButton}
            onPress={handleSwapPlayers}
          >
            <Text style={styles.swapButtonText}>
              ✓ Swap: Drop {selectedDrop.name} → Pick Up {selectedPickup.name}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Current Roster */}
      <View style={styles.section}>
        <Text style={[styles.subsectionTitle, { color: colors.text }]}>Your Roster ({currentRoster.length})</Text>
        <FlatList
          data={currentRoster}
          renderItem={renderRosterPlayer}
          keyExtractor={(item) => `roster-${item.fide_id}`}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No players on roster</Text>
          }
        />
      </View>

      {/* Available Players */}
      <View style={styles.section}>
        <Text style={[styles.subsectionTitle, { color: colors.text }]}>Available Players</Text>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border }]}
          placeholder="Search by name or country..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={availablePlayers}
            renderItem={renderAvailablePlayer}
            keyExtractor={(item) => `available-${item.fide_id}`}
            scrollEnabled={false}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
              ) : hasMore && availablePlayers.length >= 50 ? (
                <TouchableOpacity
                  style={{ padding: 16, alignItems: 'center', backgroundColor: colors.cardBackground, borderRadius: 8, marginTop: 8 }}
                  onPress={() => handleLoadMore()}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Load More Players ({availablePlayers.length} loaded)</Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No players available</Text>
            }
          />
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpText: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  searchInput: {
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  playerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  playerDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  pickupButton: {
    backgroundColor: '#10b981',
  },
  actionButtonSelected: {
    backgroundColor: '#3b82f6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  inGameBadge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  inGameBadgeText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.3,
    transform: [{ rotate: '-90deg' }],
    width: 60,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
  },
  loader: {
    paddingVertical: 20,
  },
  topButtonContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  topSwapButton: {
    alignItems: 'center',
  },
  swapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
