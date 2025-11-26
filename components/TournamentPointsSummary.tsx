import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '@/lib/supabase';

interface TournamentPointsSummaryProps {
  tournamentId: string;
  leagueId: string;
  playerFideId: number;
  playerName: string;
  onGamePress?: (gameId: string) => void;
}

interface GamePointsData {
  game_id: string;
  total_points: number;
  white_player_fide_id: number;
  black_player_fide_id: number;
  white_player_name?: string;
  black_player_name?: string;
  result: string;
}

export default function TournamentPointsSummary({
  tournamentId,
  leagueId,
  playerFideId,
  playerName,
  onGamePress,
}: TournamentPointsSummaryProps) {
  const [games, setGames] = useState<GamePointsData[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournamentPoints();
  }, [tournamentId, leagueId, playerFideId]);

  const fetchTournamentPoints = async () => {
    try {
      // Fetch all game points for this player in this tournament
      const { data: gamePoints, error } = await supabase
        .from('game_fantasy_points')
        .select(`
          game_id,
          total_points,
          tournament_pairings!inner(
            white_player_fide_id,
            black_player_fide_id,
            result
          )
        `)
        .eq('tournament_id', tournamentId)
        .eq('league_id', leagueId)
        .eq('player_fide_id', playerFideId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const gamesData = gamePoints?.map((gp: any) => ({
        game_id: gp.game_id,
        total_points: gp.total_points,
        white_player_fide_id: gp.tournament_pairings.white_player_fide_id,
        black_player_fide_id: gp.tournament_pairings.black_player_fide_id,
        result: gp.tournament_pairings.result,
      })) || [];

      setGames(gamesData);
      
      // Calculate total
      const total = gamesData.reduce((sum, game) => sum + game.total_points, 0);
      setTotalPoints(total);
    } catch (error) {
      console.error('Error fetching tournament points:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2563eb" />
      </View>
    );
  }

  if (games.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No games played yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Total Points Header */}
      <View style={styles.header}>
        <Text style={styles.playerName}>{playerName}</Text>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Points</Text>
          <Text style={[
            styles.totalValue,
            totalPoints > 0 ? styles.positivePoints : styles.negativePoints
          ]}>
            {totalPoints > 0 ? '+' : ''}{totalPoints.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Games List */}
      <View style={styles.gamesContainer}>
        <Text style={styles.gamesTitle}>Games ({games.length})</Text>
        {games.map((game, index) => (
          <TouchableOpacity
            key={game.game_id}
            style={styles.gameRow}
            onPress={() => onGamePress?.(game.game_id)}
            disabled={!onGamePress}
          >
            <View style={styles.gameInfo}>
              <Text style={styles.gameNumber}>Game {index + 1}</Text>
              <Text style={styles.gameResult}>
                {game.white_player_fide_id === playerFideId ? '⚪' : '⚫'} {game.result}
              </Text>
            </View>
            <Text style={[
              styles.gamePoints,
              game.total_points > 0 ? styles.positivePoints : styles.negativePoints
            ]}>
              {game.total_points > 0 ? '+' : ''}{game.total_points.toFixed(2)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  playerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  positivePoints: {
    color: '#10b981',
  },
  negativePoints: {
    color: '#ef4444',
  },
  gamesContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  gamesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  gameInfo: {
    flex: 1,
  },
  gameNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  gameResult: {
    fontSize: 12,
    color: '#94a3b8',
  },
  gamePoints: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  noDataText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    padding: 16,
  },
});
