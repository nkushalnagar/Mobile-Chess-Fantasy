import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Player {
  fide_id: string;
  name: string;
  rating: number;
  country: string;
  title?: string;
}

interface DraftState {
  id: string;
  league_id: string;
  current_pick_number: number;
  current_round: number;
  current_team_id: string | null;
  pick_deadline: string | null;
  is_active: boolean;
}

interface DraftPick {
  id: string;
  league_id: string;
  team_id: string;
  player_fide_id: string;
  pick_number: number;
  round: number;
  player?: Player;
}

interface TeamMember {
  user_id: string;
  team_id: string;
  draft_order: number;
  profile: {
    username: string;
  };
}

export default function DraftRoomScreen() {
  const { id: leagueId } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [players, setPlayers] = useState<Player[]>([]);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [draftOrder, setDraftOrder] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [pickingInProgress, setPickingInProgress] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [league, setLeague] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const timerRef = useRef<{
    teamId: string | null;
    deadline: string | null;
    intervalId: NodeJS.Timeout | null;
  }>({
    teamId: null,
    deadline: null,
    intervalId: null,
  });

  const searchStateRef = useRef({ page: 0, query: '' });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, [leagueId]);

  // Setup real-time subscriptions
  useEffect(() => {
    if (!leagueId) return;

    console.log('📡 Setting up real-time subscriptions');

    let pollInterval: NodeJS.Timeout | null = null;
    let isActive = true;

    const draftStateChannel = supabase
      .channel(`draft_state:${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draft_state',
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          console.log('🔄 Draft state update:', payload.eventType);
          console.log('New state:', {
            active: payload.new?.is_active,
            pick: payload.new?.current_pick_number,
            round: payload.new?.current_round,
            team: payload.new?.current_team_id,
          });
          
          // Stop polling if draft becomes inactive
          if (payload.new?.is_active === false) {
            console.log('🛑 Draft completed, stopping polling');
            isActive = false;
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
          
          loadDraftState();
        }
      )
      .subscribe((status) => {
        console.log('Draft state channel status:', status);
      });

    const draftPicksChannel = supabase
      .channel(`draft_picks:${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_players',
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          console.log('✅ New pick detected');
          loadDraftPicks();
        }
      )
      .subscribe((status) => {
        console.log('Draft picks channel status:', status);
      });

    // Poll for updates as backup (every 3 seconds)
    pollInterval = setInterval(() => {
      if (isActive) {
        loadDraftState();
        loadDraftPicks();
        // Refresh available players with current page/search state
        loadPlayers(searchStateRef.current.page, searchStateRef.current.query, false);
      }
    }, 3000);

    return () => {
      console.log('🧹 Cleaning up subscriptions');
      if (pollInterval) clearInterval(pollInterval);
      supabase.removeChannel(draftStateChannel);
      supabase.removeChannel(draftPicksChannel);
    };
  }, [leagueId]);

  // Countdown timer
  useEffect(() => {
    if (!draftState?.pick_deadline || !draftState?.is_active || players.length === 0) {
      if (timerRef.current.intervalId) {
        clearInterval(timerRef.current.intervalId);
        timerRef.current.intervalId = null;
      }
      return;
    }

    const currentTeam = draftState.current_team_id;
    const currentDeadline = draftState.pick_deadline;

    if (
      timerRef.current.teamId === currentTeam &&
      timerRef.current.deadline === currentDeadline &&
      timerRef.current.intervalId !== null
    ) {
      return;
    }

    if (timerRef.current.intervalId) {
      clearInterval(timerRef.current.intervalId);
    }

    const interval = setInterval(() => {
      const deadline = new Date(draftState.pick_deadline!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadline - now) / 1000));

      setTimeRemaining(remaining);

      if (remaining === 0 && !pickingInProgress) {
        handleAutoPick();
      }
    }, 1000);

    timerRef.current = {
      teamId: currentTeam,
      deadline: currentDeadline,
      intervalId: interval,
    };

    return () => {
      if (timerRef.current.intervalId) {
        clearInterval(timerRef.current.intervalId);
        timerRef.current.intervalId = null;
      }
    };
  }, [draftState?.pick_deadline, draftState?.current_team_id, pickingInProgress, players.length]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load league info
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .single();

      setLeague(leagueData);
      setIsOwner(leagueData?.owner_id === user?.id);

      // Get user's team_id
      const { data: membership } = await supabase
        .from('league_memberships')
        .select('team_id')
        .eq('league_id', leagueId)
        .eq('user_id', user?.id)
        .single();

      setTeamId(membership?.team_id || null);

      // Load all data in parallel
      await Promise.all([
        loadPlayers(0, ''),
        loadDraftOrder(),
        loadDraftState(),
        loadDraftPicks(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load draft room');
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async (page = 0, search = '', append = false) => {
    // Only show loading on initial load or when appending
    if (append) setLoadingMore(true);
    
    try {
      // Use the paginated function with search
      const { data, error } = await supabase
        .rpc('get_draftable_players_paginated', { 
          p_league_id: leagueId,
          p_search_query: search,
          p_limit: 100,
          p_offset: page * 100
        });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setTotalPlayers(data[0].total_count || 0);
        
        if (append) {
          setPlayers(prev => [...prev, ...data]);
        } else {
          setPlayers(data);
        }
      } else {
        if (!append) setPlayers([]);
        setTotalPlayers(0);
      }
      
      setCurrentPage(page);
      searchStateRef.current = { page, query: search };
    } finally {
      setLoadingMore(false);
    }
  };

  const loadDraftOrder = async () => {
    const { data, error } = await supabase
      .from('league_memberships')
      .select('user_id, team_id, draft_order, profile:profiles!user_id(username)')
      .eq('league_id', leagueId)
      .not('draft_order', 'is', null)
      .order('draft_order', { ascending: true });

    if (error) throw error;
    setDraftOrder((data as any) || []);
  };

  const loadDraftState = async () => {
    const { data, error } = await supabase
      .from('draft_state')
      .select('*')
      .eq('league_id', leagueId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading draft state:', error);
      throw error;
    }
    
    console.log('✅ Draft state loaded:', {
      pick: data?.current_pick_number,
      round: data?.current_round,
      team: data?.current_team_id,
      active: data?.is_active,
    });
    
    setDraftState(data);
  };

  const loadDraftPicks = async () => {
    const { data, error } = await supabase
      .from('team_players')
      .select('*, player:players(name, rating, country, title)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    // Map to old format for compatibility
    const picks = data?.map((tp: any, index: number) => ({
      id: tp.id,
      league_id: tp.league_id,
      team_id: tp.team_id,
      player_fide_id: tp.player_fide_id,
      pick_number: index + 1,
      round: Math.floor(index / (league?.max_members || 1)) + 1,
      player: tp.player
    })) || [];
    setDraftPicks(picks);
  };

  const handlePickPlayer = async () => {
    if (!selectedPlayer || !teamId || !draftState || pickingInProgress) return;

    if (draftState.current_team_id !== teamId) {
      Alert.alert('Not Your Turn', "It's not your turn to pick!");
      return;
    }

    setPickingInProgress(true);

    try {
      const { error: pickError } = await supabase
        .from('team_players')
        .insert({
          league_id: leagueId as string,
          team_id: teamId,
          player_fide_id: selectedPlayer.fide_id,
          tournament_id: league?.league_type === 'tournament' ? (league?.current_tournament_id || null) : null,
          season_id: league?.league_type === 'season' ? (league?.season_id || null) : null,
          fantasy_score: 0,
        });

      if (pickError) throw pickError;

      await advanceDraft();
      setSelectedPlayer(null);
    } catch (error) {
      console.error('Error picking player:', error);
      Alert.alert('Error', 'Failed to pick player');
    } finally {
      setPickingInProgress(false);
    }
  };

  const handleAutoPick = async () => {
    if (!draftState || pickingInProgress || players.length === 0) {
      console.log('⚠️ Cannot auto-pick:', { 
        hasDraftState: !!draftState, 
        pickingInProgress, 
        playersCount: players.length 
      });
      return;
    }

    setPickingInProgress(true);
    console.log('🤖 Auto-picking for team:', draftState.current_team_id);

    try {
      const pickedPlayerIds = draftPicks.map((p) => p.player_fide_id);
      const availablePlayers = players.filter(
        (p) => !pickedPlayerIds.includes(p.fide_id)
      );

      console.log('📊 Available players:', availablePlayers.length);

      if (availablePlayers.length === 0) {
        console.log('❌ No available players');
        setPickingInProgress(false);
        return;
      }

      const autoPick = availablePlayers[0];
      console.log('🎯 Auto-picking:', autoPick.name);

      // Check if already picked
      const { data: existingPick, error: checkError } = await supabase
        .from('team_players')
        .select('id')
        .eq('league_id', leagueId)
        .eq('player_fide_id', autoPick.fide_id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing pick:', checkError);
        setPickingInProgress(false);
        return;
      }

      if (existingPick) {
        console.log('⚠️ Player already picked, reloading...');
        await loadDraftPicks();
        setPickingInProgress(false);
        return;
      }

      const { error: pickError } = await supabase
        .from('team_players')
        .insert({
          league_id: leagueId as string,
          team_id: draftState.current_team_id!,
          player_fide_id: autoPick.fide_id,
          tournament_id: league?.league_type === 'tournament' ? (league?.current_tournament_id || null) : null,
          season_id: league?.league_type === 'season' ? (league?.season_id || null) : null,
          fantasy_score: 0,
        });

      if (pickError) {
        if (pickError.code === '23505') {
          console.log('⚠️ Duplicate pick (race condition)');
          setPickingInProgress(false);
          return;
        }
        console.error('❌ Error saving auto-pick:', pickError);
        setPickingInProgress(false);
        return;
      }

      console.log('✅ Auto-pick saved');
      await advanceDraft();
    } catch (error: any) {
      console.error('❌ Error auto-picking:', error);
      // Don't show alert for network errors during auto-pick
      if (error?.message?.includes('Network request failed')) {
        console.log('Network error during auto-pick, will retry on next poll');
      }
    } finally {
      setPickingInProgress(false);
    }
  };

  const advanceDraft = async () => {
    if (!draftState || !league) {
      console.log('⚠️ Cannot advance draft:', { hasDraftState: !!draftState, hasLeague: !!league });
      return;
    }

    console.log('⏭️ Advancing draft...');

    const totalPicks = league.picks_per_person * league.max_members;
    const nextPickNumber = draftState.current_pick_number + 1;

    console.log('📊 Draft progress:', {
      currentPick: draftState.current_pick_number,
      totalPicks,
      nextPick: nextPickNumber,
    });

    if (nextPickNumber > totalPicks) {
      console.log('🏁 Draft complete!');
      // Draft complete
      await supabase
        .from('draft_state')
        .update({
          is_active: false,
          pick_deadline: null,
        })
        .eq('league_id', leagueId);

      await supabase
        .from('leagues')
        .update({ status: 'active' })
        .eq('id', leagueId);

      // Reload draft state to show complete screen
      await loadDraftState();
      return;
    }

    // Calculate next team (snake draft)
    const nextRound = Math.ceil(nextPickNumber / draftOrder.length);
    const positionInRound = ((nextPickNumber - 1) % draftOrder.length);
    
    // Snake draft: reverse order on even rounds
    const isReverseRound = nextRound % 2 === 0;
    const nextTeamIndex = isReverseRound 
      ? (draftOrder.length - 1 - positionInRound)
      : positionInRound;
    
    const nextTeam = draftOrder[nextTeamIndex];
    
    if (!nextTeam) {
      console.error('❌ Could not find next team!', {
        nextTeamIndex,
        draftOrderLength: draftOrder.length,
      });
      return;
    }

    const nextTeamId = nextTeam.team_id;

    console.log('📍 Next pick:', {
      nextPick: nextPickNumber,
      nextRound,
      nextTeam: nextTeam.profile?.username,
      isReverseRound,
      positionInRound,
      nextTeamIndex,
    });

    const { error } = await supabase
      .from('draft_state')
      .update({
        current_pick_number: nextPickNumber,
        current_round: nextRound,
        current_team_id: nextTeamId,
        pick_deadline: new Date(Date.now() + 30000).toISOString(),
      })
      .eq('league_id', leagueId);

    if (error) {
      console.error('❌ Error updating draft state:', error);
    } else {
      console.log('✅ Draft state updated');
    }
  };

  const stopDraft = async () => {
    Alert.alert(
      'Stop Draft',
      'Are you sure you want to stop the draft? This will end the draft and set the league to active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Draft',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('draft_state')
                .update({ is_active: false, pick_deadline: null })
                .eq('league_id', leagueId);

              await supabase
                .from('leagues')
                .update({ status: 'active' })
                .eq('id', leagueId);

              router.back();
            } catch (error) {
              console.error('Error stopping draft:', error);
              Alert.alert('Error', 'Failed to stop draft');
            }
          },
        },
      ]
    );
  };

  const restartDraft = async () => {
    Alert.alert(
      'Restart Draft',
      'Are you sure you want to restart the draft? This will clear all picks and reset to the beginning.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all team_players for this league
              await supabase
                .from('team_players')
                .delete()
                .eq('league_id', leagueId);

              // Delete draft state
              await supabase
                .from('draft_state')
                .delete()
                .eq('league_id', leagueId);

              // Set league back to open
              await supabase
                .from('leagues')
                .update({ status: 'open' })
                .eq('id', leagueId);

              Alert.alert('Success', 'Draft has been reset. Returning to league page.');
              router.back();
            } catch (error) {
              console.error('Error restarting draft:', error);
              Alert.alert('Error', 'Failed to restart draft');
            }
          },
        },
      ]
    );
  };

  // Handle search with debounce
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    
    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      setCurrentPage(0);
      loadPlayers(0, text, false);
    }, 500);
    
    setSearchDebounceTimer(timer);
  };
  
  // Load more players when scrolling
  const handleLoadMore = () => {
    if (loadingMore) return;
    if (players.length >= totalPlayers) return;
    
    loadPlayers(currentPage + 1, searchQuery, true);
  };

  const isMyTurn = draftState?.current_team_id === teamId;
  const currentTeamMember = draftOrder.find(
    (t) => t.team_id === draftState?.current_team_id
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!draftState?.is_active) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.completeContainer}>
            <Text style={styles.completeText}>🎉</Text>
            <Text style={styles.completeTitle}>Draft Finished!</Text>
            <Text style={styles.completeSubtitle}>
              All picks have been made. Good luck in the tournament!
            </Text>
            <TouchableOpacity style={styles.completeButton} onPress={() => router.back()}>
              <Text style={styles.completeButtonText}>Back to League</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Draft Room</Text>
          {isOwner && (
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={restartDraft} style={styles.restartButton}>
                <Text style={styles.restartButtonText}>Restart</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={stopDraft} style={styles.stopButton}>
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Draft Status */}
        <View style={[styles.statusBar, isMyTurn && styles.statusBarMyTurn]}>
          <View style={styles.statusLeft}>
            <Text style={styles.statusLabel}>
              {isMyTurn ? '🎯 YOUR TURN' : '⏳ Waiting...'}
            </Text>
            <Text style={styles.statusText}>
              Pick {draftState.current_pick_number} • Round {draftState.current_round}
            </Text>
            <Text style={styles.statusPicker}>
              {currentTeamMember?.profile?.username || 'Unknown'} is picking
            </Text>
          </View>
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{timeRemaining}s</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Draft Order Sidebar */}
          <View style={styles.sidebar}>
            <Text style={styles.sidebarTitle}>Draft Order</Text>
            <ScrollView style={styles.sidebarScroll}>
              {draftOrder.map((member, index) => {
                const isCurrent = member.team_id === draftState.current_team_id;
                const isUser = member.team_id === teamId;
                const teamPicks = draftPicks.filter(
                  (p) => p.team_id === member.team_id
                );
                const pickCount = teamPicks.length;
                const isExpanded = expandedTeams.has(member.team_id);

                return (
                  <View key={member.team_id}>
                    <TouchableOpacity
                      style={[
                        styles.orderItem,
                        isCurrent && styles.orderItemCurrent,
                        isUser && styles.orderItemUser,
                      ]}
                      onPress={() => {
                        const newExpanded = new Set(expandedTeams);
                        if (isExpanded) {
                          newExpanded.delete(member.team_id);
                        } else {
                          newExpanded.add(member.team_id);
                        }
                        setExpandedTeams(newExpanded);
                      }}
                    >
                      <Text style={styles.orderNumber}>{index + 1}</Text>
                      <View style={styles.orderInfo}>
                        <Text
                          style={[styles.orderName, isCurrent && styles.orderNameCurrent]}
                          numberOfLines={1}
                        >
                          {member.profile?.username}
                          {isUser && ' (You)'}
                        </Text>
                        <Text style={styles.orderPicks}>{pickCount} picks</Text>
                      </View>
                      <Text style={styles.expandArrow}>{isExpanded ? '▼' : '▶'}</Text>
                    </TouchableOpacity>
                    {isExpanded && pickCount > 0 && (
                      <View style={styles.teamPicksList}>
                        {teamPicks.map((pick, idx) => (
                          <View key={pick.id} style={styles.teamPickItem}>
                            <Text style={styles.teamPickNumber}>{idx + 1}.</Text>
                            <Text style={styles.teamPickName}>
                              {pick.player?.title && `${pick.player.title} `}
                              {pick.player?.name}
                            </Text>
                            <Text style={styles.teamPickRating}>{pick.player?.rating}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Player Selection */}
          <View style={styles.mainContent}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search players..."
              placeholderTextColor="#64748b"
              value={searchQuery}
              onChangeText={handleSearch}
            />

            <View style={styles.playerListHeader}>
              <Text style={styles.playerListCount}>
                {totalPlayers} players available
              </Text>
            </View>

            <FlatList
              data={players}
              keyExtractor={(item) => item.fide_id}
              renderItem={({ item }) => {
                const isSelected = selectedPlayer?.fide_id === item.fide_id;
                return (
                  <TouchableOpacity
                    style={[styles.playerCard, isSelected && styles.playerCardSelected]}
                    onPress={() => setSelectedPlayer(item)}
                    disabled={!isMyTurn}
                  >
                    <View style={styles.playerInfo}>
                      <Text style={styles.playerName}>
                        {item.title && `${item.title} `}
                        {item.name}
                      </Text>
                      <Text style={styles.playerDetails}>
                        {item.country} • {item.rating}
                      </Text>
                    </View>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No players found' : 'No players available'}
                </Text>
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator color="#2563eb" />
                  </View>
                ) : players.length < totalPlayers ? (
                  <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
                    <Text style={styles.loadMoreText}>Load More</Text>
                  </TouchableOpacity>
                ) : null
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
            />

            {/* Pick Button */}
            {isMyTurn && selectedPlayer && (
              <TouchableOpacity
                style={[styles.pickButton, pickingInProgress && styles.pickButtonDisabled]}
                onPress={handlePickPlayer}
                disabled={pickingInProgress}
              >
                {pickingInProgress ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.pickButtonText}>
                    Pick {selectedPlayer.title ? `${selectedPlayer.title} ` : ''}{selectedPlayer.name}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  restartButton: {
    padding: 8,
  },
  restartButtonText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    padding: 8,
  },
  stopButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  statusBarMyTurn: {
    backgroundColor: '#065f46',
  },
  statusLeft: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  statusPicker: {
    fontSize: 12,
    color: '#94a3b8',
  },
  timerContainer: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginLeft: 12,
  },
  timerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 140,
    backgroundColor: '#1e293b',
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  sidebarTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    padding: 12,
    paddingBottom: 8,
  },
  sidebarScroll: {
    flex: 1,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  orderItemCurrent: {
    backgroundColor: '#10b981',
  },
  orderItemUser: {
    backgroundColor: '#1e40af',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginRight: 8,
    width: 20,
  },
  orderInfo: {
    flex: 1,
  },
  orderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  orderNameCurrent: {
    fontWeight: 'bold',
  },
  orderPicks: {
    fontSize: 10,
    color: '#64748b',
  },
  mainContent: {
    flex: 1,
    padding: 16,
  },
  searchInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  playerListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerListCount: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
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
  playerCardSelected: {
    backgroundColor: '#1e40af',
    borderColor: '#2563eb',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  playerDetails: {
    fontSize: 14,
    color: '#94a3b8',
  },
  checkmark: {
    fontSize: 20,
    color: '#10b981',
    marginLeft: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
  },
  pickButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  pickButtonDisabled: {
    opacity: 0.6,
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  completeText: {
    fontSize: 64,
    marginBottom: 16,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
  },
  completeButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingMore: {
    padding: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  loadMoreText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  expandArrow: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 8,
  },
  teamPicksList: {
    backgroundColor: '#0f172a',
    paddingLeft: 32,
    paddingRight: 8,
    paddingVertical: 4,
  },
  teamPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  teamPickNumber: {
    fontSize: 12,
    color: '#64748b',
    width: 20,
  },
  teamPickName: {
    fontSize: 13,
    color: '#cbd5e1',
    flex: 1,
  },
  teamPickRating: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
