import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface SkeletonLoaderProps {
  type?: 'matchup' | 'league' | 'card';
  count?: number;
}

export default function SkeletonLoader({ type = 'card', count = 3 }: SkeletonLoaderProps) {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  const renderMatchupSkeleton = () => (
    <Animated.View 
      style={[
        styles.matchupCard, 
        { 
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
          opacity 
        }
      ]}
    >
      <View style={styles.matchupRow}>
        <View style={styles.playerSide}>
          <View style={[styles.skeletonText, styles.skeletonName, { backgroundColor: colors.border }]} />
          <View style={[styles.skeletonText, styles.skeletonInfo, { backgroundColor: colors.border }]} />
        </View>
        <View style={styles.matchupScore}>
          <View style={[styles.skeletonText, styles.skeletonScore, { backgroundColor: colors.border }]} />
        </View>
        <View style={styles.playerSide}>
          <View style={[styles.skeletonText, styles.skeletonName, { backgroundColor: colors.border }]} />
          <View style={[styles.skeletonText, styles.skeletonInfo, { backgroundColor: colors.border }]} />
        </View>
      </View>
    </Animated.View>
  );

  const renderLeagueSkeleton = () => (
    <Animated.View 
      style={[
        styles.leagueCard, 
        { 
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
          opacity 
        }
      ]}
    >
      <View style={[styles.skeletonText, styles.skeletonLeagueName, { backgroundColor: colors.border }]} />
      <View style={[styles.skeletonText, styles.skeletonLeagueInfo, { backgroundColor: colors.border }]} />
    </Animated.View>
  );

  const renderCardSkeleton = () => (
    <Animated.View 
      style={[
        styles.card, 
        { 
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
          opacity 
        }
      ]}
    >
      <View style={[styles.skeletonText, styles.skeletonCardTitle, { backgroundColor: colors.border }]} />
      <View style={[styles.skeletonText, styles.skeletonCardContent, { backgroundColor: colors.border }]} />
    </Animated.View>
  );

  const renderSkeleton = () => {
    switch (type) {
      case 'matchup':
        return renderMatchupSkeleton();
      case 'league':
        return renderLeagueSkeleton();
      default:
        return renderCardSkeleton();
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index}>{renderSkeleton()}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  matchupCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerSide: {
    flex: 1,
  },
  matchupScore: {
    paddingHorizontal: 16,
  },
  leagueCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  skeletonText: {
    borderRadius: 6,
    marginBottom: 8,
  },
  skeletonName: {
    height: 20,
    width: '70%',
  },
  skeletonInfo: {
    height: 14,
    width: '50%',
  },
  skeletonScore: {
    height: 24,
    width: 60,
  },
  skeletonLeagueName: {
    height: 24,
    width: '60%',
    marginBottom: 12,
  },
  skeletonLeagueInfo: {
    height: 16,
    width: '40%',
  },
  skeletonCardTitle: {
    height: 20,
    width: '50%',
    marginBottom: 12,
  },
  skeletonCardContent: {
    height: 16,
    width: '80%',
  },
});
