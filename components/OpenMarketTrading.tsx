import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';

interface Player {
  fide_id: string;
  name: string;
  rating: number;
  country: string;
  title?: string;
}

interface OpenMarketTradingProps {
  leagueId: string;
  teamId: string;
  currentRoster: Player[];
  onTradeComplete: () => void;
}

export default function OpenMarketTrading({
  leagueId,
  teamId,
  currentRoster,
  onTradeComplete,
}: OpenMarketTradingProps) {
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDrop, setSelectedDrop] = useState<Player | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<Player | null>(null);

  useEffect(() => {
    loadAvailablePlayers();
  }, [searchQuery]);

  const loadAvailablePlayers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_draftable_players_paginated', {
        p_league_id: leagueId,
        p_search_query: searchQuery,
        p_limit: 50,
        p_offset: 0,
      });

      if (error) throw error;
      setAvailablePlayers(data || []);
    } catch (error) {
      console.error('Error loading available players:', error);
    } finally {
      setLoading(false);
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
                loadAvailablePlayers();
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
              });

              if (error) throw error;

              if (data.success) {
                Alert.alert('Success', data.message);
                onTradeComplete();
                loadAvailablePlayers();
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
              const { data, error } = await supabase.rpc('swap_player_open_market', {
                p_team_id: teamId,
                p_league_id: leagueId,
                p_drop_player_fide_id: selectedDrop.fide_id,
                p_pickup_player_fide_id: selectedPickup.fide_id,
              });

              if (error) throw error;

              if (data.success) {
                Alert.alert('Success', data.message);
                setSelectedDrop(null);
                setSelectedPickup(null);
                onTradeComplete();
                loadAvailablePlayers();
              } else {
                Alert.alert('Error', data.error);
              }
            } catch (error) {
              console.error('Error swapping players:', error);
              Alert.alert('Error', 'Failed to swap players');
            }
          },
        },
      ]
    );
  };

  const renderRosterPlayer = ({ item }: { item: Player }) => (
    <View style={styles.playerCard}>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {item.title && `${item.title} `}{item.name}
        </Text>
        <Text style={styles.playerDetails}>
          {item.country} • {item.rating}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.actionButton,
          selectedDrop?.fide_id === item.fide_id && styles.actionButtonSelected,
        ]}
        onPress={() => {
          if (selectedDrop?.fide_id === item.fide_id) {
            setSelectedDrop(null);
          } else {
            setSelectedDrop(item);
          }
        }}
      >
        <Text style={styles.actionButtonText}>
          {selectedDrop?.fide_id === item.fide_id ? '✓ Selected' : 'Drop'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderAvailablePlayer = ({ item }: { item: Player }) => (
    <View style={styles.playerCard}>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {item.title && `${item.title} `}{item.name}
        </Text>
        <Text style={styles.playerDetails}>
          {item.country} • {item.rating}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.actionButton,
          styles.pickupButton,
          selectedPickup?.fide_id === item.fide_id && styles.actionButtonSelected,
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

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>🔄 Open Market Trading</Text>

      {/* Current Roster */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Your Roster ({currentRoster.length})</Text>
        <FlatList
          data={currentRoster}
          renderItem={renderRosterPlayer}
          keyExtractor={(item) => item.fide_id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No players on roster</Text>
          }
        />
      </View>

      {/* Available Players */}
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Available Players</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or country..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
        ) : (
          <FlatList
            data={availablePlayers}
            renderItem={renderAvailablePlayer}
            keyExtractor={(item) => item.fide_id}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {searchQuery ? 'No players found' : 'No available players'}
              </Text>
            }
          />
        )}
      </View>

      {/* Swap Button */}
      {selectedDrop && selectedPickup && (
        <TouchableOpacity style={styles.swapButton} onPress={handleSwapPlayers}>
          <Text style={styles.swapButtonText}>
            Swap {selectedDrop.name} → {selectedPickup.name}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#0f172a',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  playerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  playerDetails: {
    fontSize: 12,
    color: '#94a3b8',
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
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    paddingVertical: 20,
  },
  loader: {
    paddingVertical: 20,
  },
  swapButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  swapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
