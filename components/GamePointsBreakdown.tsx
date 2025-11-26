import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';

interface GamePointsBreakdownProps {
  gameId: string;
  leagueId: string;
  playerFideId: number;
}

interface GamePoints {
  total_points: number;
  rating_points: number;
  sharpe_points: number;
  color_points: number;
  psychological_points: number;
  prestige_multiplier: number;
  base_points: number;
}

export default function GamePointsBreakdown({ gameId, leagueId, playerFideId }: GamePointsBreakdownProps) {
  const [points, setPoints] = useState<GamePoints | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGamePoints();
  }, [gameId, leagueId, playerFideId]);

  const fetchGamePoints = async () => {
    try {
      const { data, error } = await supabase
        .from('game_fantasy_points')
        .select('*')
        .eq('game_id', gameId)
        .eq('league_id', leagueId)
        .eq('player_fide_id', playerFideId)
        .single();

      if (error) throw error;

      if (data) {
        setPoints({
          total_points: data.total_points,
          rating_points: data.rating_points,
          sharpe_points: data.sharpe_points,
          color_points: data.color_points,
          psychological_points: data.psychological_points,
          prestige_multiplier: data.prestige_multiplier,
          base_points: data.base_points,
        });
      }
    } catch (error) {
      console.error('Error fetching game points:', error);
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

  if (!points) {
    return (
      <View style={styles.container}>
        <Text style={styles.noDataText}>No points data available</Text>
      </View>
    );
  }

  const hasPrestige = points.prestige_multiplier !== 1.0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fantasy Points Breakdown</Text>
      
      {/* Base Points */}
      <View style={styles.pointsCard}>
        <View style={styles.pointRow}>
          <Text style={styles.pointLabel}>Rating Change</Text>
          <Text style={styles.pointValue}>
            {points.rating_points > 0 ? '+' : ''}{points.rating_points.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.pointRow}>
          <Text style={styles.pointLabel}>Game Quality</Text>
          <Text style={styles.pointValue}>
            {points.sharpe_points > 0 ? '+' : ''}{points.sharpe_points.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.pointRow}>
          <Text style={styles.pointLabel}>Color Factor</Text>
          <Text style={styles.pointValue}>
            {points.color_points > 0 ? '+' : ''}{points.color_points.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.pointRow}>
          <Text style={styles.pointLabel}>Psychological Factor</Text>
          <Text style={styles.pointValue}>
            {points.psychological_points > 0 ? '+' : ''}{points.psychological_points.toFixed(2)}
          </Text>
        </View>

        {hasPrestige && (
          <>
            <View style={styles.divider} />
            <View style={styles.pointRow}>
              <Text style={styles.pointLabel}>Base Points</Text>
              <Text style={styles.pointValue}>{points.base_points.toFixed(2)}</Text>
            </View>
            <View style={styles.pointRow}>
              <Text style={styles.pointLabel}>Prestige Multiplier</Text>
              <Text style={styles.pointValue}>×{points.prestige_multiplier.toFixed(2)}</Text>
            </View>
          </>
        )}

        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Points</Text>
          <Text style={[
            styles.totalValue,
            points.total_points > 0 ? styles.positivePoints : styles.negativePoints
          ]}>
            {points.total_points > 0 ? '+' : ''}{points.total_points.toFixed(2)}
          </Text>
        </View>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  pointsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
  },
  pointRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  pointLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  pointValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  positivePoints: {
    color: '#10b981',
  },
  negativePoints: {
    color: '#ef4444',
  },
  noDataText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
