import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { getRatingForTimeControl } from '@/utils/ratingHelper';
import { checkPlayersInOngoingGames } from '@/utils/checkPlayerInOngoingGame';

interface Player {
  fide_id: string;
  name: string;
  rating: number;
  rapid_rating?: number;
  blitz_rating?: number;
  country?: string;
  title?: string;
  tournament_id?: string | null;
  season_id?: string | null;
}

interface Team {
  id: string;
  name: string;
  username: string;
}

interface Trade {
  trade_id: string;
  direction: 'incoming' | 'outgoing';
  other_team_name: string;
  other_username: string;
  from_players: Player[];
  to_players: Player[];
  created_at: string;
}

interface PlayerTradesProps {
  leagueId: string;
  teamId: string;
  userId: string;
  currentRoster: Player[];
  allTeams: Team[];
  onTradeComplete: () => void;
  league?: { league_type?: string; current_tournament_id?: string | null };
  timeControl?: string;
}

export default function PlayerTrades({
  leagueId,
  teamId,
  userId,
  currentRoster,
  allTeams,
  onTradeComplete,
  league,
  timeControl,
}: PlayerTradesProps) {
  const { colors } = useTheme();
  const [pendingTrades, setPendingTrades] = useState<Trade[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTargetTeam, setSelectedTargetTeam] = useState<Team | null>(null);
  const [targetTeamRoster, setTargetTeamRoster] = useState<Player[]>([]);
  const [mySelectedPlayers, setMySelectedPlayers] = useState<Set<string>>(new Set());
  const [theirSelectedPlayers, setTheirSelectedPlayers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [filteredCurrentRoster, setFilteredCurrentRoster] = useState<Player[]>(currentRoster);
  const [filteredTargetRoster, setFilteredTargetRoster] = useState<Player[]>([]);
  const [playersInOngoingGames, setPlayersInOngoingGames] = useState<Map<string, { status: 'ongoing' | 'processing', lichessUrl: string }>>(new Map());

  useEffect(() => {
    loadPendingTrades();
  }, []);

  // Update filtered rosters when currentRoster changes
  useEffect(() => {
    if (selectedTournamentId) {
      setFilteredCurrentRoster(currentRoster.filter(p => p.tournament_id === selectedTournamentId));
    } else {
      setFilteredCurrentRoster(currentRoster);
    }
  }, [currentRoster, selectedTournamentId]);

  // Check for players in ongoing games when rosters or tournament changes
  useEffect(() => {
    if (filteredCurrentRoster.length > 0 || filteredTargetRoster.length > 0) {
      loadOngoingGameStatus();
    }
  }, [filteredCurrentRoster, filteredTargetRoster, selectedTournamentId]);

  const loadPendingTrades = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_pending_trades', {
        p_league_id: leagueId,
        p_user_id: userId,
      });

      if (error) throw error;
      setPendingTrades(data || []);
    } catch (error) {
      console.error('Error loading pending trades:', error);
    }
  };

  const loadOngoingGameStatus = async () => {
    try {
      const allFideIds = [
        ...filteredCurrentRoster.map(p => p.fide_id),
        ...filteredTargetRoster.map(p => p.fide_id)
      ];
      
      if (allFideIds.length === 0) return;
      
      console.log('🎮 Checking ongoing games for players:', allFideIds.length, 'players');
      console.log('🎮 Current roster FIDs:', filteredCurrentRoster.map(p => p.fide_id));
      console.log('🎮 Target roster FIDs:', filteredTargetRoster.map(p => p.fide_id));
      const ongoingMap = await checkPlayersInOngoingGames(
        allFideIds,
        selectedTournamentId || undefined,
        leagueId
      );
      console.log('🎮 Found ongoing games:', ongoingMap.size);
      console.log('🎮 Players in ongoing games:', Array.from(ongoingMap.keys()));
      setPlayersInOngoingGames(ongoingMap);
    } catch (error) {
      console.error('Error checking ongoing games:', error);
    }
  };

  const loadTargetTeamRoster = async (team: Team) => {
    try {
      // For tournament leagues, show all players from all drafted tournaments
      let query = supabase
        .from('team_players')
        .select(`
          player_fide_id,
          tournament_id,
          season_id,
          players(fide_id, name, rating, rapid_rating, blitz_rating, country, title)
        `)
        .eq('team_id', team.id)
        .eq('league_id', leagueId);

      // No filtering by current_tournament_id - show all drafted players

      const { data, error } = await query;

      if (error) throw error;

      const players = data?.map((tp: any) => ({
        ...tp.players,
        tournament_id: tp.tournament_id,
        season_id: tp.season_id
      })).filter(Boolean) || [];
      setTargetTeamRoster(players);
      
      // Filter by selected tournament if one is selected
      if (selectedTournamentId) {
        const filtered = players.filter(p => p.tournament_id === selectedTournamentId);
        setFilteredTargetRoster(filtered);
      } else {
        setFilteredTargetRoster(players);
      }
    } catch (error) {
      console.error('Error loading target team roster:', error);
    }
  };

  const handleSelectTargetTeam = async (team: Team) => {
    setSelectedTargetTeam(team);
    setMySelectedPlayers(new Set());
    setTheirSelectedPlayers(new Set());
    setSelectedTournamentId(null);
    setFilteredCurrentRoster(currentRoster);
    await loadTargetTeamRoster(team);
  };

  const toggleMyPlayer = (fideId: string) => {
    const player = currentRoster.find(p => p.fide_id === fideId);
    const newSet = new Set(mySelectedPlayers);
    
    if (newSet.has(fideId)) {
      newSet.delete(fideId);
      // If no players selected, clear tournament filter
      if (newSet.size === 0) {
        console.log('🔄 Cleared my player selection, showing all players');
        setSelectedTournamentId(null);
        setFilteredCurrentRoster(currentRoster);
        setFilteredTargetRoster(targetTeamRoster);
      }
    } else {
      // First selection sets the tournament filter
      if (newSet.size === 0 && player?.tournament_id) {
        console.log('📍 Selected my player from tournament:', player.tournament_id);
        setSelectedTournamentId(player.tournament_id);
        // Filter both rosters by this tournament
        setFilteredCurrentRoster(currentRoster.filter(p => p.tournament_id === player.tournament_id));
        setFilteredTargetRoster(targetTeamRoster.filter(p => p.tournament_id === player.tournament_id));
      }
      newSet.add(fideId);
    }
    setMySelectedPlayers(newSet);
  };

  const toggleTheirPlayer = (fideId: string) => {
    const player = targetTeamRoster.find(p => p.fide_id === fideId);
    const newSet = new Set(theirSelectedPlayers);
    
    if (newSet.has(fideId)) {
      newSet.delete(fideId);
      // If no players selected, clear tournament filter
      if (newSet.size === 0) {
        console.log('🔄 Cleared their player selection, showing all players');
        setSelectedTournamentId(null);
        setFilteredCurrentRoster(currentRoster);
        setFilteredTargetRoster(targetTeamRoster);
      }
    } else {
      // First selection sets the tournament filter
      if (newSet.size === 0 && player?.tournament_id) {
        console.log('📍 Selected their player from tournament:', player.tournament_id);
        setSelectedTournamentId(player.tournament_id);
        // Filter both rosters by this tournament
        setFilteredCurrentRoster(currentRoster.filter(p => p.tournament_id === player.tournament_id));
        setFilteredTargetRoster(targetTeamRoster.filter(p => p.tournament_id === player.tournament_id));
      }
      newSet.add(fideId);
    }
    setTheirSelectedPlayers(newSet);
  };

  const handleCreateTrade = async () => {
    if (mySelectedPlayers.size === 0 || theirSelectedPlayers.size === 0) {
      Alert.alert('Error', 'Please select at least one player from each team');
      return;
    }

    if (!selectedTargetTeam) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('create_trade_request', {
        p_league_id: leagueId,
        p_from_team_id: teamId,
        p_to_team_id: selectedTargetTeam.id,
        p_from_player_fide_ids: Array.from(mySelectedPlayers),
        p_to_player_fide_ids: Array.from(theirSelectedPlayers),
      });

      if (error) throw error;

      if (data.success) {
        Alert.alert('Success', data.message);
        setShowCreateModal(false);
        setSelectedTargetTeam(null);
        setMySelectedPlayers(new Set());
        setTheirSelectedPlayers(new Set());
        loadPendingTrades();
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      console.error('Error creating trade:', error);
      Alert.alert('Error', 'Failed to create trade request');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTrade = async (tradeId: string) => {
    Alert.alert(
      'Accept Trade',
      'Are you sure you want to accept this trade?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('accept_trade_request', {
                p_trade_id: tradeId,
                p_user_id: userId,
              });

              if (error) throw error;

              if (data.success) {
                Alert.alert('Success', data.message);
                loadPendingTrades();
                onTradeComplete();
              } else {
                Alert.alert('Error', data.error);
              }
            } catch (error) {
              console.error('Error accepting trade:', error);
              Alert.alert('Error', 'Failed to accept trade');
            }
          },
        },
      ]
    );
  };

  const handleDeclineTrade = async (tradeId: string) => {
    try {
      const { data, error } = await supabase.rpc('decline_trade_request', {
        p_trade_id: tradeId,
        p_user_id: userId,
      });

      if (error) throw error;

      if (data.success) {
        Alert.alert('Success', data.message);
        loadPendingTrades();
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      console.error('Error declining trade:', error);
      Alert.alert('Error', 'Failed to decline trade');
    }
  };

  const handleCancelTrade = async (tradeId: string) => {
    try {
      const { data, error } = await supabase.rpc('cancel_trade_request', {
        p_trade_id: tradeId,
        p_user_id: userId,
      });

      if (error) throw error;

      if (data.success) {
        Alert.alert('Success', data.message);
        loadPendingTrades();
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      console.error('Error cancelling trade:', error);
      Alert.alert('Error', 'Failed to cancel trade');
    }
  };

  const renderTradeItem = ({ item }: { item: Trade }) => (
    <View style={[styles.tradeCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={styles.tradeHeader}>
        <Text style={[styles.tradeDirection, { color: colors.primary }]}>
          {item.direction === 'incoming' ? '📥 Incoming' : '📤 Outgoing'}
        </Text>
        <Text style={[styles.tradeUsername, { color: colors.textSecondary }]}>{item.other_username}</Text>
      </View>

      <View style={styles.tradeDetails}>
        <View style={styles.tradeColumn}>
          <Text style={[styles.tradeColumnTitle, { color: colors.textSecondary }]}>You Give:</Text>
          {(item.direction === 'outgoing' ? item.from_players : item.to_players).map((player) => (
            <Text key={player.fide_id} style={[styles.playerText, { color: colors.text }]}>
              {player.title && `${player.title} `}{player.name}
            </Text>
          ))}
        </View>

        <Text style={[styles.tradeArrow, { color: colors.textSecondary }]}>↔</Text>

        <View style={styles.tradeColumn}>
          <Text style={[styles.tradeColumnTitle, { color: colors.textSecondary }]}>You Get:</Text>
          {(item.direction === 'outgoing' ? item.to_players : item.from_players).map((player) => (
            <Text key={player.fide_id} style={[styles.playerText, { color: colors.text }]}>
              {player.title && `${player.title} `}{player.name}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.tradeActions}>
        {item.direction === 'incoming' ? (
          <>
            <TouchableOpacity
              style={[styles.tradeButton, styles.acceptButton]}
              onPress={() => handleAcceptTrade(item.trade_id)}
            >
              <Text style={styles.tradeButtonText}>✓ Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tradeButton, styles.declineButton]}
              onPress={() => handleDeclineTrade(item.trade_id)}
            >
              <Text style={styles.tradeButtonText}>✗ Decline</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.tradeButton, styles.cancelButton]}
            onPress={() => handleCancelTrade(item.trade_id)}
          >
            <Text style={styles.tradeButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const otherTeams = allTeams.filter(t => t.id !== teamId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🔄 Player Trades</Text>
          <TouchableOpacity
            style={[styles.infoButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => Alert.alert(
              'Trading Rules',
              '• Can only trade players from the same tournament\n• Cannot trade players during their games\n• Select players from both teams, then send the trade request\n• Both teams must have the same number of players in the trade'
            )}
          >
            <Text style={[styles.infoButtonText, { color: colors.primary }]}>ⓘ</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>+ Propose Trade</Text>
        </TouchableOpacity>
      </View>

      {pendingTrades.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pending trades</Text>
      ) : (
        <FlatList
          data={pendingTrades}
          renderItem={renderTradeItem}
          keyExtractor={(item) => item.trade_id}
          scrollEnabled={false}
        />
      )}

      {/* Create Trade Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Propose Trade</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={[styles.closeButton, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Select Target Team */}
            {!selectedTargetTeam ? (
              <View>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Select Team to Trade With:</Text>
                {otherTeams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={[styles.teamOption, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                    onPress={() => handleSelectTargetTeam(team)}
                  >
                    <Text style={[styles.teamOptionText, { color: colors.text }]}>{team.username}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Trading with: {selectedTargetTeam.username}</Text>

                {/* Your Players */}
                <Text style={[styles.subsectionTitle, { color: colors.text }]}>Your Players (select to offer):</Text>
                {filteredCurrentRoster.map((player) => {
                  const playerStatus = playersInOngoingGames.get(player.fide_id);
                  const isInOngoingGame = !!playerStatus;
                  const lichessUrl = playerStatus?.lichessUrl;
                  return (
                    <TouchableOpacity
                      key={player.fide_id}
                      disabled={isInOngoingGame}
                      style={[
                        styles.playerOption,
                        { backgroundColor: colors.cardBackground, borderColor: colors.border },
                        mySelectedPlayers.has(player.fide_id) && styles.playerOptionSelected,
                        isInOngoingGame && { opacity: 0.5 },
                      ]}
                      onPress={() => toggleMyPlayer(player.fide_id)}
                    >
                      {isInOngoingGame && (
                        <TouchableOpacity 
                          style={styles.inGameBadge}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (lichessUrl) Linking.openURL(lichessUrl);
                          }}
                          disabled={!lichessUrl}
                        >
                          <Text style={[
                            styles.inGameBadgeText,
                            playerStatus?.status === 'processing' && { fontSize: 5.5, letterSpacing: 0.2 }
                          ]}>
                {playerStatus?.status === 'ongoing' ? 'IN GAME' : 'PROCESSING'}
              </Text>
                        </TouchableOpacity>
                      )}
                      <Text style={[styles.playerOptionText, { color: colors.text }, isInOngoingGame && { paddingLeft: 30 }]}>
                        {player.title && `${player.title} `}{player.name} ({getRatingForTimeControl(player, timeControl)})
                      </Text>
                      {mySelectedPlayers.has(player.fide_id) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Their Players */}
                <Text style={[styles.subsectionTitle, { color: colors.text }]}>Their Players (select to request):</Text>
                {filteredTargetRoster.map((player) => {
                  const playerStatus = playersInOngoingGames.get(player.fide_id);
                  const isInOngoingGame = !!playerStatus;
                  const lichessUrl = playerStatus?.lichessUrl;
                  const isDisabled = isInOngoingGame || mySelectedPlayers.size === 0;
                  if (isInOngoingGame) {
                    console.log('🎮 Their player in game:', player.name, player.fide_id);
                  }
                  return (
                    <TouchableOpacity
                      key={player.fide_id}
                      disabled={isDisabled}
                      style={[
                        styles.playerOption,
                        { backgroundColor: colors.cardBackground, borderColor: colors.border },
                        theirSelectedPlayers.has(player.fide_id) && styles.playerOptionSelected,
                        isDisabled && { opacity: 0.5 },
                      ]}
                      onPress={() => toggleTheirPlayer(player.fide_id)}
                    >
                      {isInOngoingGame && (
                        <TouchableOpacity 
                          style={styles.inGameBadge}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (lichessUrl) Linking.openURL(lichessUrl);
                          }}
                          disabled={!lichessUrl}
                        >
                          <Text style={[
                            styles.inGameBadgeText,
                            playerStatus?.status === 'processing' && { fontSize: 5.5, letterSpacing: 0.2 }
                          ]}>
                {playerStatus?.status === 'ongoing' ? 'IN GAME' : 'PROCESSING'}
              </Text>
                        </TouchableOpacity>
                      )}
                      <Text style={[styles.playerOptionText, { color: colors.text }, isInOngoingGame && { paddingLeft: 30 }]}>
                        {player.title && `${player.title} `}{player.name} ({getRatingForTimeControl(player, timeControl)})
                      </Text>
                      {theirSelectedPlayers.has(player.fide_id) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (mySelectedPlayers.size === 0 || theirSelectedPlayers.size === 0 || loading) &&
                      styles.submitButtonDisabled,
                  ]}
                  onPress={handleCreateTrade}
                  disabled={mySelectedPlayers.size === 0 || theirSelectedPlayers.size === 0 || loading}
                >
                  <Text style={styles.submitButtonText}>
                    {loading ? 'Sending...' : 'Send Trade Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
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
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 1,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    paddingVertical: 20,
  },
  tradeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tradeDirection: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
  },
  tradeUsername: {
    fontSize: 14,
    color: '#94a3b8',
  },
  tradeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tradeColumn: {
    flex: 1,
  },
  tradeColumnTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  playerText: {
    fontSize: 13,
    color: '#fff',
    marginBottom: 4,
  },
  tradeArrow: {
    fontSize: 24,
    color: '#64748b',
    marginHorizontal: 16,
  },
  tradeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  tradeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  declineButton: {
    backgroundColor: '#ef4444',
  },
  cancelButton: {
    backgroundColor: '#64748b',
  },
  tradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    fontSize: 28,
    color: '#94a3b8',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    marginBottom: 12,
  },
  teamOption: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  teamOptionText: {
    fontSize: 16,
    color: '#fff',
  },
  playerOption: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a8a',
  },
  playerOptionText: {
    fontSize: 14,
    color: '#fff',
  },
  checkmark: {
    fontSize: 18,
    color: '#3b82f6',
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
  submitButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
