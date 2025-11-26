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
} from 'react-native';
import { supabase } from '@/lib/supabase';

interface Player {
  fide_id: string;
  name: string;
  rating: number;
  country?: string;
  title?: string;
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
}

export default function PlayerTrades({
  leagueId,
  teamId,
  userId,
  currentRoster,
  allTeams,
  onTradeComplete,
}: PlayerTradesProps) {
  const [pendingTrades, setPendingTrades] = useState<Trade[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTargetTeam, setSelectedTargetTeam] = useState<Team | null>(null);
  const [targetTeamRoster, setTargetTeamRoster] = useState<Player[]>([]);
  const [mySelectedPlayers, setMySelectedPlayers] = useState<Set<string>>(new Set());
  const [theirSelectedPlayers, setTheirSelectedPlayers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPendingTrades();
  }, []);

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

  const loadTargetTeamRoster = async (team: Team) => {
    try {
      const { data, error } = await supabase
        .from('team_players')
        .select(`
          player_fide_id,
          players(fide_id, name, rating, country, title)
        `)
        .eq('team_id', team.id)
        .eq('league_id', leagueId);

      if (error) throw error;

      const players = data?.map((tp: any) => tp.players).filter(Boolean) || [];
      setTargetTeamRoster(players);
    } catch (error) {
      console.error('Error loading target team roster:', error);
    }
  };

  const handleSelectTargetTeam = async (team: Team) => {
    setSelectedTargetTeam(team);
    setMySelectedPlayers(new Set());
    setTheirSelectedPlayers(new Set());
    await loadTargetTeamRoster(team);
  };

  const toggleMyPlayer = (fideId: string) => {
    const newSet = new Set(mySelectedPlayers);
    if (newSet.has(fideId)) {
      newSet.delete(fideId);
    } else {
      newSet.add(fideId);
    }
    setMySelectedPlayers(newSet);
  };

  const toggleTheirPlayer = (fideId: string) => {
    const newSet = new Set(theirSelectedPlayers);
    if (newSet.has(fideId)) {
      newSet.delete(fideId);
    } else {
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
    <View style={styles.tradeCard}>
      <View style={styles.tradeHeader}>
        <Text style={styles.tradeDirection}>
          {item.direction === 'incoming' ? '📥 Incoming' : '📤 Outgoing'}
        </Text>
        <Text style={styles.tradeUsername}>{item.other_username}</Text>
      </View>

      <View style={styles.tradeDetails}>
        <View style={styles.tradeColumn}>
          <Text style={styles.tradeColumnTitle}>You Give:</Text>
          {(item.direction === 'outgoing' ? item.from_players : item.to_players).map((player) => (
            <Text key={player.fide_id} style={styles.playerText}>
              {player.title && `${player.title} `}{player.name}
            </Text>
          ))}
        </View>

        <Text style={styles.tradeArrow}>↔</Text>

        <View style={styles.tradeColumn}>
          <Text style={styles.tradeColumnTitle}>You Get:</Text>
          {(item.direction === 'outgoing' ? item.to_players : item.from_players).map((player) => (
            <Text key={player.fide_id} style={styles.playerText}>
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
        <Text style={styles.sectionTitle}>🔄 Player Trades</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>+ Propose Trade</Text>
        </TouchableOpacity>
      </View>

      {pendingTrades.length === 0 ? (
        <Text style={styles.emptyText}>No pending trades</Text>
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
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Propose Trade</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Select Target Team */}
            {!selectedTargetTeam ? (
              <View>
                <Text style={styles.stepTitle}>Select Team to Trade With:</Text>
                {otherTeams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    style={styles.teamOption}
                    onPress={() => handleSelectTargetTeam(team)}
                  >
                    <Text style={styles.teamOptionText}>{team.username}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View>
                <Text style={styles.stepTitle}>Trading with: {selectedTargetTeam.username}</Text>

                {/* Your Players */}
                <Text style={styles.subsectionTitle}>Your Players (select to offer):</Text>
                {currentRoster.map((player) => (
                  <TouchableOpacity
                    key={player.fide_id}
                    style={[
                      styles.playerOption,
                      mySelectedPlayers.has(player.fide_id) && styles.playerOptionSelected,
                    ]}
                    onPress={() => toggleMyPlayer(player.fide_id)}
                  >
                    <Text style={styles.playerOptionText}>
                      {player.title && `${player.title} `}{player.name} ({player.rating})
                    </Text>
                    {mySelectedPlayers.has(player.fide_id) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}

                {/* Their Players */}
                <Text style={styles.subsectionTitle}>Their Players (select to request):</Text>
                {targetTeamRoster.map((player) => (
                  <TouchableOpacity
                    key={player.fide_id}
                    style={[
                      styles.playerOption,
                      theirSelectedPlayers.has(player.fide_id) && styles.playerOptionSelected,
                    ]}
                    onPress={() => toggleTheirPlayer(player.fide_id)}
                  >
                    <Text style={styles.playerOptionText}>
                      {player.title && `${player.title} `}{player.name} ({player.rating})
                    </Text>
                    {theirSelectedPlayers.has(player.fide_id) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}

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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
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
