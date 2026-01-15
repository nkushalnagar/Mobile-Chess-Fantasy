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
import { useTheme } from '@/contexts/ThemeContext';
import PlayerProfileModal from '@/components/PlayerProfileModal';
import { getRatingForTimeControl } from '@/utils/ratingHelper';

const getTitleColor = (title: string | undefined): string => {
  if (!title) return '#94a3b8';
  if (title === 'GM') return '#fbbf24';
  if (title === 'IM') return '#a78bfa';
  if (title === 'FM') return '#60a5fa';
  if (title === 'WGM') return '#fbbf24';
  if (title === 'WIM') return '#a78bfa';
  if (title === 'WFM') return '#60a5fa';
  if (title === 'CM' || title === 'NM' || title === 'WCM' || title === 'WNM') return '#34d399';
  return '#94a3b8';
};

interface Player {
  fide_id: string;
  name: string;
  rating: number;
  rapid_rating?: number;
  blitz_rating?: number;
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
  tournament_id?: string | null;
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
  const { colors } = useTheme();

  const [players, setPlayers] = useState<Player[]>([]);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [draftOrder, setDraftOrder] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(60);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedProfilePlayer, setSelectedProfilePlayer] = useState<Player | null>(null);
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

  // Ref to track current tournament_id for realtime subscriptions
  const tournamentIdRef = useRef<string | null>(null);

  const searchStateRef = useRef({ page: 0, query: '' });

  // Update tournamentIdRef whenever draftState changes
  useEffect(() => {
    if (draftState?.tournament_id) {
      tournamentIdRef.current = draftState.tournament_id;
    }
  }, [draftState?.tournament_id]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, [leagueId]);

  // Setup real-time subscriptions
  useEffect(() => {
    if (!leagueId) return;

    console.log('📡 Setting up real-time subscriptions');

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
        (payload: any) => {
          console.log('🔄 Draft state update:', payload.eventType);
          const newState = payload.new as any;
          console.log('New state:', {
            active: newState?.is_active,
            pick: newState?.current_pick_number,
            round: newState?.current_round,
            team: newState?.current_team_id,
          });
          
          if (newState?.is_active === false) {
            console.log('🛑 Draft completed');
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
        (payload) => {
          console.log('✅ New pick detected via realtime:', payload);
          loadDraftPicks();
          // Refresh available players to remove the drafted player immediately
          // Always reset to page 0 when refreshing after a pick
          loadPlayers(0, searchStateRef.current.query, false, tournamentIdRef.current);
        }
      )
      .subscribe((status) => {
        console.log('Draft picks channel status:', status);
        if (status === 'SUBSCRIPTION_ERROR') {
          console.error('❌ Failed to subscribe to draft picks channel');
        }
      });

    return () => {
      console.log('🧹 Cleaning up subscriptions');
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

      // Load draft state first (needed for tournament_id)
      const draftStateData = await loadDraftState();
      
      // Get tournament_id from draft state
      const tournamentId = draftStateData?.tournament_id;
      
      console.log('🔍 Tournament ID for draft:', {
        fromDraftState: draftStateData?.tournament_id,
        using: tournamentId
      });
      
      // Update the ref with the tournament_id
      if (tournamentId) {
        tournamentIdRef.current = tournamentId;
      } else if (leagueData?.league_type === 'tournament') {
        // For tournament leagues, tournament_id is required
        throw new Error('Draft state is missing tournament_id for tournament league');
      }
      
      // Then load other data in parallel, passing tournament_id directly
      await Promise.all([
        loadPlayers(0, '', false, tournamentId),
        loadDraftOrder(),
        loadDraftPicks(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load draft room');
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async (page = 0, search = '', append = false, tournamentId?: string | null) => {
    // Only show loading on initial load or when appending
    if (append) setLoadingMore(true);
    
    try {
      // Use tournament_id from parameter, or fall back to ref (which always has current value)
      const tournamentIdToUse = tournamentId !== undefined ? tournamentId : tournamentIdRef.current;
      
      console.log('🔍 loadPlayers called:', {
        page,
        search,
        append,
        tournamentIdParam: tournamentId,
        tournamentIdRef: tournamentIdRef.current,
        using: tournamentIdToUse
      });
      
      // Use the paginated function with search
      const { data, error } = await supabase
        .rpc('get_draftable_players_paginated', { 
          p_league_id: leagueId,
          p_tournament_id: tournamentIdToUse || null,
          p_search_query: search,
          p_limit: 100,
          p_offset: page * 100
        });

      if (error) throw error;
      
      console.log('📊 loadPlayers result:', {
        dataLength: data?.length,
        totalCount: data?.[0]?.total_count,
        append
      });
      
      if (data && data.length > 0) {
        setTotalPlayers(data[0].total_count || 0);
        
        if (append) {
          // Deduplicate when appending to prevent duplicate keys
          setPlayers(prev => {
            const existingIds = new Set(prev.map(p => p.fide_id));
            const newPlayers = data.filter(p => !existingIds.has(p.fide_id));
            return [...prev, ...newPlayers];
          });
        } else {
          // Deduplicate on initial load as well
          const uniquePlayers = data.filter((player, index, self) => 
            index === self.findIndex(p => p.fide_id === player.fide_id)
          );
          setPlayers(uniquePlayers);
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
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error loading draft state:', error);
      throw error;
    }
    
    // Get the first (most recent) draft state
    const draftStateData = data?.[0] || null;
    
    console.log('✅ Draft state loaded:', {
      pick: draftStateData?.current_pick_number,
      round: draftStateData?.current_round,
      team: draftStateData?.current_team_id,
      active: draftStateData?.is_active,
      tournament_id: draftStateData?.tournament_id,
    });
    
    setDraftState(draftStateData);
    return draftStateData;
  };

  const loadDraftPicks = async () => {
    // Build query to filter by tournament_id if this is a tournament league
    let query = supabase
      .from('team_players')
      .select('*, player:players(name, rating, rapid_rating, blitz_rating, country, title)')
      .eq('league_id', leagueId);
    
    // Filter by tournament_id if available (for tournament leagues)
    if (tournamentIdRef.current) {
      query = query.eq('tournament_id', tournamentIdRef.current);
    }
    
    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;
    
    console.log('📊 Loaded draft picks:', {
      total: data?.length,
      tournament_id: tournamentIdRef.current
    });
    
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

    // Optimistic UI update - add pick immediately
    const optimisticPickNumber = draftPicks.length + 1;
    const optimisticPick = {
      id: `temp-${Date.now()}`,
      league_id: leagueId as string,
      team_id: teamId,
      player_fide_id: selectedPlayer.fide_id,
      pick_number: optimisticPickNumber,
      round: Math.floor((optimisticPickNumber - 1) / (league?.max_members || 1)) + 1,
      player: {
        fide_id: selectedPlayer.fide_id,
        name: selectedPlayer.name,
        rating: selectedPlayer.rating,
        rapid_rating: selectedPlayer.rapid_rating,
        blitz_rating: selectedPlayer.blitz_rating,
        country: selectedPlayer.country,
        title: selectedPlayer.title,
      }
    };

    // Update UI immediately
    setDraftPicks([...draftPicks, optimisticPick]);
    setSelectedPlayer(null);

    // Remove picked player from available players list
    setPlayers(players.filter(p => p.fide_id !== selectedPlayer.fide_id));

    // Optimistically update draft state to show next pick
    const totalPicks = league.picks_per_person * league.max_members;
    const nextPickNumber = draftState.current_pick_number + 1;
    const nextRound = Math.ceil(nextPickNumber / draftOrder.length);
    const positionInRound = ((nextPickNumber - 1) % draftOrder.length);
    const isReverseRound = nextRound % 2 === 0;
    const nextTeamIndex = isReverseRound 
      ? (draftOrder.length - 1 - positionInRound)
      : positionInRound;
    const nextTeam = draftOrder[nextTeamIndex];

    if (nextPickNumber <= totalPicks && nextTeam) {
      setDraftState({
        ...draftState,
        current_pick_number: nextPickNumber,
        current_round: nextRound,
        current_team_id: nextTeam.team_id,
      });
    }

    try {
      // Ensure we have either tournament_id or season_id (required by constraint)
      const tournamentId = league?.league_type === 'tournament' ? draftState?.tournament_id : null;
      const seasonId = league?.league_type === 'season' ? league?.season_id : null;

      if (!tournamentId && !seasonId) {
        throw new Error('League configuration error: missing tournament or season');
      }

      const { error: pickError } = await supabase
        .from('team_players')
        .insert({
          league_id: leagueId as string,
          team_id: teamId,
          player_fide_id: optimisticPick.player_fide_id,
          tournament_id: draftState?.tournament_id || null,
          season_id: seasonId,
          fantasy_score: 0,
        });

      if (pickError) throw pickError;

      await advanceDraft();
      
      // Reload to get real data with correct IDs
      await loadDraftPicks();
    } catch (error: any) {
      console.error('Error picking player:', error);
      
      // Check if it's a duplicate key error (player already picked on another device)
      if (error?.code === '23505') {
        console.log('⚠️ Player already picked on another device, refreshing...');
        Alert.alert('Player Already Picked', 'This player was just picked on another device. Please select another player.');
        
        // Immediately refresh all data to get the latest state
        await Promise.all([
          loadDraftState(),
          loadDraftPicks(),
          loadPlayers(searchStateRef.current.page, searchStateRef.current.query, false, draftState?.tournament_id)
        ]);
      } else {
        Alert.alert('Error', 'Failed to pick player');
      }
      
      // Rollback optimistic update on error
      setDraftPicks(draftPicks);
      setSelectedPlayer(null);
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

      // Refresh data one more time right before picking to minimize race conditions
      await Promise.all([
        loadDraftPicks(),
        loadPlayers(searchStateRef.current.page, searchStateRef.current.query, false, draftState?.tournament_id)
      ]);

      // Re-check available players after refresh
      const refreshedPickedIds = draftPicks.map((p) => p.player_fide_id);
      const refreshedAvailable = players.filter(
        (p) => !refreshedPickedIds.includes(p.fide_id)
      );

      if (refreshedAvailable.length === 0 || !refreshedAvailable.find(p => p.fide_id === autoPick.fide_id)) {
        console.log('⚠️ Player no longer available after refresh, aborting auto-pick');
        setPickingInProgress(false);
        return;
      }

      // Ensure we have either tournament_id or season_id (required by constraint)
      const tournamentId = league?.league_type === 'tournament' ? draftState?.tournament_id : null;
      const seasonId = league?.league_type === 'season' ? league?.season_id : null;

      console.log('🔍 League config:', {
        league_type: league?.league_type,
        draft_state_tournament_id: draftState?.tournament_id,
        season_id: league?.season_id,
        tournamentId,
        seasonId
      });

      if (!tournamentId && !seasonId) {
        console.error('❌ Missing tournament_id or season_id');
        Alert.alert('Error', 'League configuration error: missing tournament or season');
        setPickingInProgress(false);
        return;
      }

      const { error: pickError } = await supabase
        .from('team_players')
        .insert({
          league_id: leagueId as string,
          team_id: draftState.current_team_id!,
          player_fide_id: autoPick.fide_id,
          tournament_id: tournamentId,
          season_id: seasonId,
          fantasy_score: 0,
        });

      if (pickError) {
        if (pickError.code === '23505') {
          console.log('⚠️ Duplicate pick (race condition), refreshing data...');
          // Immediately refresh all data to sync with other devices
          await Promise.all([
            loadDraftState(),
            loadDraftPicks(),
            loadPlayers(searchStateRef.current.page, searchStateRef.current.query, false, draftState?.tournament_id)
          ]);
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
    console.log('🚀 advanceDraft called');
    
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
      willComplete: nextPickNumber > totalPicks,
    });

    if (nextPickNumber > totalPicks) {
      console.log('🏁 Draft complete! All picks made.');
      console.log('📊 Final stats:', {
        currentPick: draftState.current_pick_number,
        totalPicks,
        nextPick: nextPickNumber,
        leagueId,
      });
      
      try {
        // Call RPC function to complete draft (bypasses RLS)
        console.log('🔄 Calling complete_draft RPC...');
        const { data, error } = await supabase.rpc('complete_draft', {
          p_league_id: leagueId
        });

        if (error) throw error;
        
        console.log('✅ Draft completion response:', data);

        // Verify the completion was successful
        if (data?.league_status !== 'active' || data?.draft_active !== false) {
          console.warn('⚠️ Draft completion verification failed:', data);
          throw new Error('Draft completion verification failed');
        }

        console.log('✅ SUCCESS: Draft completed and verified');

        // Reload draft state to show completion screen
        await loadDraftState();
        
      } catch (error) {
        console.error('❌ Error completing draft:', error);
        Alert.alert('Error', 'Failed to complete draft. Please contact support.');
      }
      
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
        pick_deadline: new Date(Date.now() + 60000).toISOString(), // 60 seconds for all picks
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
              // Use RPC to atomically complete the draft
              const { error: completeError } = await supabase
                .rpc('complete_draft', { p_league_id: leagueId });

              if (completeError) {
                console.error('❌ Error stopping draft:', completeError);
                throw completeError;
              }

              console.log('✅ Draft stopped, league set to active');
              router.push('/(tabs)/leagues');
            } catch (error) {
              console.error('Error stopping draft:', error);
              Alert.alert('Error', 'Failed to stop draft and update league status');
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
      loadPlayers(0, text, false, draftState?.tournament_id);
    }, 500);
    
    setSearchDebounceTimer(timer);
  };
  
  // Load more players when scrolling
  const handleLoadMore = () => {
    if (loadingMore) return;
    if (players.length >= totalPlayers) return;
    
    loadPlayers(currentPage + 1, searchQuery, true, draftState?.tournament_id);
  };

  const isMyTurn = draftState?.current_team_id === teamId;
  const currentTeamMember = draftOrder.find(
    (t) => t.team_id === draftState?.current_team_id
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!draftState?.is_active) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.completeContainer}>
            <Text style={styles.completeText}>🎉</Text>
            <Text style={[styles.completeTitle, { color: colors.text }]}>Draft Finished!</Text>
            <Text style={[styles.completeSubtitle, { color: colors.textSecondary }]}>
              All picks have been made. Good luck in the tournament!
            </Text>
            <TouchableOpacity 
              style={[styles.completeButton, { backgroundColor: colors.primary }]} 
              onPress={() => router.push(`/league/${leagueId}`)}
            >
              <Text style={styles.completeButtonText}>View {league?.name}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.completeButton, styles.secondaryButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} 
              onPress={() => router.push('/(tabs)/leagues')}
            >
              <Text style={[styles.completeButtonText, styles.secondaryButtonText, { color: colors.primary }]}>Back to My Leagues</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/leagues')} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.primary }]}>← My Leagues</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Draft Room</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Draft Status */}
        <View style={[styles.statusBar, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }, isMyTurn && { backgroundColor: '#10b981' }]}>
          <View style={styles.statusLeft}>
            <Text style={[styles.statusLabel, { color: isMyTurn ? '#fff' : colors.text }]}>
              {isMyTurn ? '🎯 YOUR TURN' : '⏳ Waiting...'}
            </Text>
            <Text style={[styles.statusText, { color: isMyTurn ? '#fff' : colors.textSecondary }]}>
              Pick {draftState.current_pick_number} • Round {draftState.current_round}
            </Text>
            <Text style={[styles.statusPicker, { color: isMyTurn ? 'rgba(255, 255, 255, 0.8)' : colors.textSecondary }]}>
              {currentTeamMember?.profile?.username || 'Unknown'} is picking
            </Text>
          </View>
          <View style={[styles.timerContainer, { backgroundColor: colors.primary }]}>
            <Text style={styles.timerText}>{timeRemaining}s</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Draft Order Sidebar */}
          <View style={[styles.sidebar, { backgroundColor: colors.cardBackground, borderRightColor: colors.border }]}>
            <Text style={[styles.sidebarTitle, { color: colors.text }]}>Draft Order</Text>
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
                        { backgroundColor: colors.background },
                        isCurrent && { backgroundColor: colors.primary + '20' },
                        isUser && { borderLeftColor: colors.primary },
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
                      <Text style={[styles.orderNumber, { color: colors.textSecondary }]}>{index + 1}</Text>
                      <View style={styles.orderInfo}>
                        <Text
                          style={[styles.orderName, { color: colors.text }, isCurrent && styles.orderNameCurrent]}
                          numberOfLines={1}
                        >
                          {member.profile?.username}
                          {isUser && ' (You)'}
                        </Text>
                        <Text style={[styles.orderPicks, { color: colors.textSecondary }]}>{pickCount} picks</Text>
                      </View>
                      <Text style={[styles.expandArrow, { color: colors.textSecondary }]}>{isExpanded ? '▼' : '▶'}</Text>
                    </TouchableOpacity>
                    {isExpanded && pickCount > 0 && (
                      <View style={[styles.teamPicksList, { backgroundColor: colors.background }]}>
                        {teamPicks.map((pick, idx) => (
                          <View key={pick.id} style={styles.teamPickItem}>
                            <Text style={[styles.teamPickNumber, { color: colors.textSecondary }]}>{idx + 1}.</Text>
                            <Text style={[styles.teamPickName, { color: colors.text }]}>
                              {pick.player?.title && (
                                <Text style={{ color: getTitleColor(pick.player.title) }}>
                                  {pick.player.title}{' '}
                                </Text>
                              )}
                              {pick.player?.name}
                            </Text>
                            <Text style={[styles.teamPickRating, { color: colors.textSecondary }]}>{getRatingForTimeControl(pick.player || { rating: 0 }, league?.time_control)}</Text>
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
              style={[styles.searchInput, { backgroundColor: colors.cardBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="Search players..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
            />

            <View style={styles.playerListHeader}>
              <Text style={[styles.playerListCount, { color: colors.textSecondary }]}>
                {totalPlayers} players available
              </Text>
            </View>

            <FlatList
              data={players}
              keyExtractor={(item, index) => `${item.fide_id}-${index}`}
              renderItem={({ item }) => {
                const isSelected = selectedPlayer?.fide_id === item.fide_id;
                return (
                  <TouchableOpacity
                    style={[styles.playerCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }, isSelected && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                    onPress={() => setSelectedPlayer(item)}
                    disabled={!isMyTurn}
                  >
                    <View style={styles.playerInfo}>
                      <View style={styles.playerNameRow}>
                        <Text style={[styles.playerName, { color: colors.text }]}>
                          {item.title && (
                            <Text style={{ color: getTitleColor(item.title) }}>
                              {item.title}{' '}
                            </Text>
                          )}
                          {item.name}
                        </Text>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setSelectedProfilePlayer(item);
                            setProfileModalVisible(true);
                          }}
                          style={styles.infoIconButton}
                        >
                          <Text style={[styles.infoIcon, { color: colors.primary }]}>ⓘ</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.playerDetails, { color: colors.textSecondary }]}>
                        {item.country} • {getRatingForTimeControl(item, league?.time_control)}
                      </Text>
                    </View>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchQuery ? 'No players found' : 'No players available'}
                </Text>
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : players.length < totalPlayers ? (
                  <TouchableOpacity style={[styles.loadMoreButton, { backgroundColor: colors.cardBackground }]} onPress={handleLoadMore}>
                    <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load More</Text>
                  </TouchableOpacity>
                ) : null
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
            />

            {/* Pick Button */}
            {isMyTurn && selectedPlayer && (
              <TouchableOpacity
                style={[styles.pickButton, { backgroundColor: colors.primary }, pickingInProgress && styles.pickButtonDisabled]}
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

      {/* Player Profile Modal */}
      {selectedProfilePlayer && (
        <PlayerProfileModal
          visible={profileModalVisible}
          player={selectedProfilePlayer}
          onClose={() => {
            setProfileModalVisible(false);
            setSelectedProfilePlayer(null);
          }}
        />
      )}
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
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  infoIconButton: {
    padding: 6,
    marginLeft: 6,
  },
  infoIcon: {
    fontSize: 18,
    color: '#60a5fa',
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
    marginBottom: 12,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  secondaryButtonText: {
    color: '#2563eb',
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
  teamPickInfoButton: {
    padding: 4,
    marginHorizontal: 6,
  },
  teamPickRating: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
});
