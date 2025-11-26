import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SlidersIcon from '@/components/SlidersIcon';
import OpenMarketTrading from '@/components/OpenMarketTrading';
import PlayerTrades from '@/components/PlayerTrades';

interface League {
  id: string;
  name: string;
  max_members: number;
  picks_per_person: number;
  owner_id: string;
  status: string;
  current_tournament_id: string | null;
  league_type: 'tournament' | 'season';
  season_id: string | null;
}

interface Tournament {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  status?: string;
  time_control?: string;
}

interface Team {
  id: string;
  name: string;
  user_id: string;
  username: string;
}

interface Player {
  fide_id: string;
  name: string;
  rating: number;
  country: string;
  title?: string;
  fantasy_score?: number;
}

interface TeamRoster {
  team_id: string;
  players: Player[];
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  team_name: string;
  points: number;
}

interface Matchup {
  id: string;
  round_number: number;
  white_player: Player;
  black_player: Player;
  status: string;
  white_classical_score: number;
  black_classical_score: number;
  white_fantasy_points?: number;
  black_fantasy_points?: number;
}

type TabType = 'teams' | 'leaderboard' | 'matchups';

export default function LeagueDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [league, setLeague] = useState<League | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('matchups');
  
  // Teams tab data
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamRosters, setTeamRosters] = useState<Record<string, Player[]>>({});
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [userRoster, setUserRoster] = useState<Player[]>([]);
  
  // Leaderboard tab data
  const [currentLeaderboard, setCurrentLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [overallLeaderboard, setOverallLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  // Matchups tab data
  const [matchups, setMatchups] = useState<any[]>([]);
  const [userPlayerIds, setUserPlayerIds] = useState<string[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [isOwner, setIsOwner] = useState(false);
  const [startingDraft, setStartingDraft] = useState(false);
  const [tournamentPlayerCount, setTournamentPlayerCount] = useState<number>(0);
  const [warningDismissed, setWarningDismissed] = useState(false);

  useEffect(() => {
    fetchLeagueDetails();
  }, [id]);

  useEffect(() => {
    if (league) {
      // Always fetch teams for member count display
      fetchTeams();
      
      // Fetch tab-specific data
      if (activeTab === 'leaderboard') {
        fetchLeaderboards();
      } else if (activeTab === 'matchups') {
        fetchMatchups();
      }
    }
  }, [league, activeTab, currentRound]);

  // Refetch teams when screen comes into focus (e.g., after editing team name)
  useFocusEffect(
    useCallback(() => {
      if (league) {
        fetchTeams();
      }
    }, [league])
  );

  const fetchLeagueDetails = async () => {
    try {
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', id)
        .single();

      if (leagueError) throw leagueError;
      setLeague(leagueData);
      setIsOwner(leagueData.owner_id === user?.id);

      // Fetch current tournament with full details
      let tournamentId = leagueData.current_tournament_id;
      
      // For tournament leagues, verify current tournament is still active
      if (leagueData.league_type === 'tournament') {
        let needsNewTournament = !tournamentId;
        
        // If we have a tournament ID, check if it's still active
        if (tournamentId) {
          const { data: currentTournament } = await supabase
            .from('tournaments')
            .select('is_active')
            .eq('id', tournamentId)
            .single();
          
          // If tournament is no longer active, we need a new one
          if (!currentTournament?.is_active) {
            needsNewTournament = true;
            tournamentId = null;
          }
        }
        
        // Find a new active tournament if needed
        if (needsNewTournament) {
          const { data: activeTournaments } = await supabase
            .from('tournaments')
            .select('id')
            .eq('is_active', true)
            .order('start_date', { ascending: false })
            .limit(1);
          
          if (activeTournaments && activeTournaments.length > 0) {
            tournamentId = activeTournaments[0].id;
            // Update the league with this tournament
            await supabase
              .from('leagues')
              .update({ current_tournament_id: tournamentId })
              .eq('id', leagueData.id);
          } else {
            // No active tournaments available, clear the current one
            await supabase
              .from('leagues')
              .update({ current_tournament_id: null })
              .eq('id', leagueData.id);
          }
        }
      }
      
      if (tournamentId) {
        const { data: tournamentData } = await supabase
          .from('tournaments')
          .select('id, name, start_date, end_date, location, status, time_control')
          .eq('id', tournamentId)
          .single();
        
        setTournament(tournamentData);

        // Fetch tournament player count
        const { count } = await supabase
          .from('tournament_standings')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', tournamentId);
        
        setTournamentPlayerCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching league details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          user_id
        `)
        .eq('league_id', id);

      if (error) throw error;

      // Fetch usernames separately
      const userIds = teamsData?.map(t => t.user_id) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.username]) || []);

      const teamsList = teamsData?.map((item: any) => ({
        id: item.id,
        name: item.name,
        user_id: item.user_id,
        username: profilesMap.get(item.user_id) || 'Unknown',
      })) || [];

      setTeams(teamsList);
      
      // Find user's team
      const userTeam = teamsData?.find((item: any) => item.user_id === user?.id);
      if (userTeam?.id) {
        setUserTeamId(userTeam.id);
        // Fetch user's roster for open market trading
        fetchUserRoster(userTeam.id);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };
  
  const fetchUserRoster = async (teamId: string) => {
    try {
      // For tournament leagues without an active tournament, clear roster
      if (league?.league_type === 'tournament' && !league?.current_tournament_id) {
        setUserRoster([]);
        return;
      }

      let query = supabase
        .from('team_players')
        .select(`
          player_fide_id,
          fantasy_score,
          players(fide_id, name, rating, country, title)
        `)
        .eq('team_id', teamId)
        .eq('league_id', id);

      // Filter by tournament for tournament leagues
      if (league?.league_type === 'tournament' && league?.current_tournament_id) {
        query = query.eq('tournament_id', league.current_tournament_id);
      }

      const { data: teamPlayers, error } = await query;

      if (error) throw error;

      const players = teamPlayers?.map((tp: any) => ({
        ...tp.players,
        fantasy_score: tp.fantasy_score
      })).filter(Boolean) || [];
      
      setUserRoster(players);
    } catch (error) {
      console.error('Error fetching user roster:', error);
    }
  };

  const fetchTeamRoster = async (teamId: string) => {
    // Toggle expansion state
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
      setExpandedTeams(newExpanded);
      return;
    }

    // If roster already loaded, just expand it
    if (teamRosters[teamId]) {
      newExpanded.add(teamId);
      setExpandedTeams(newExpanded);
      return;
    }

    // Don't try to fetch if team_id is null (user hasn't joined/drafted yet)
    if (!teamId || teamId === 'null') {
      setTeamRosters(prev => ({ ...prev, [teamId]: [] }));
      newExpanded.add(teamId);
      setExpandedTeams(newExpanded);
      return;
    }

    try {
      // For tournament leagues without an active tournament, show empty roster
      if (league?.league_type === 'tournament' && !league?.current_tournament_id) {
        setTeamRosters(prev => ({ ...prev, [teamId]: [] }));
        newExpanded.add(teamId);
        setExpandedTeams(newExpanded);
        return;
      }

      let query = supabase
        .from('team_players')
        .select(`
          player_fide_id,
          fantasy_score,
          players(fide_id, name, rating, country, title)
        `)
        .eq('team_id', teamId)
        .eq('league_id', id);

      // Filter by tournament for tournament leagues
      if (league?.league_type === 'tournament' && league?.current_tournament_id) {
        query = query.eq('tournament_id', league.current_tournament_id);
      }

      const { data: teamPlayers, error } = await query;

      if (error) throw error;

      const players = teamPlayers?.map((tp: any) => ({
        ...tp.players,
        fantasy_score: tp.fantasy_score
      })).filter(Boolean) || [];
      setTeamRosters(prev => ({ ...prev, [teamId]: players }));
      newExpanded.add(teamId);
      setExpandedTeams(newExpanded);
    } catch (error) {
      console.error('Error fetching team roster:', error);
    }
  };

  const fetchLeaderboards = async () => {
    try {
      // Fetch league members
      const { data: membersData } = await supabase
        .from('league_memberships')
        .select(`
          user_id,
          team_id,
          profile:profiles!user_id(username)
        `)
        .eq('league_id', id);

      if (!membersData) return;

      const currentScores: LeaderboardEntry[] = [];
      
      // CURRENT LEADERBOARD
      // For tournament leagues: current tournament only
      // For season leagues: all time in the season
      for (const member of membersData) {
        // Skip if no team_id yet
        if (!member.team_id) {
          currentScores.push({
            user_id: member.user_id,
            username: (member as any).profile?.username || 'Unknown',
            team_name: `${(member as any).profile?.username || 'Unknown'}'s Team`,
            points: 0,
          });
          continue;
        }

        // Get team's cumulative total points and name
        // This includes all points earned, regardless of current roster
        const { data: teamData } = await supabase
          .from('teams')
          .select('total_points, name')
          .eq('id', member.team_id)
          .single();

        const totalPoints = teamData?.total_points || 0;

        currentScores.push({
          user_id: member.user_id,
          username: (member as any).profile?.username || 'Unknown',
          team_name: teamData?.name || `${(member as any).profile?.username || 'Unknown'}'s Team`,
          points: totalPoints,
        });
      }

      currentScores.sort((a, b) => b.points - a.points);
      setCurrentLeaderboard(currentScores);

      // OVERALL LEADERBOARD
      // For tournament leagues: sum of all finalized tournament scores
      // For season leagues: same as current (since it's cumulative)
      const overallScores: Record<string, LeaderboardEntry> = {};

      if (league?.league_type === 'tournament') {
        // Tournament league: fetch from tournament_scores (finalized tournaments)
        for (const member of membersData) {
          const { data: tournamentScores } = await supabase
            .from('tournament_scores')
            .select('total_points')
            .eq('league_id', id)
            .eq('user_id', member.user_id);

          const totalPoints = tournamentScores?.reduce((sum, ts) => sum + (ts.total_points || 0), 0) || 0;

          // Get team name
          let teamName = `${(member as any).profile?.username || 'Unknown'}'s Team`;
          if (member.team_id) {
            const { data: teamData } = await supabase
              .from('teams')
              .select('name')
              .eq('id', member.team_id)
              .single();
            teamName = teamData?.name || teamName;
          }

          overallScores[member.user_id] = {
            user_id: member.user_id,
            username: (member as any).profile?.username || 'Unknown',
            team_name: teamName,
            points: totalPoints,
          };
        }
      } else {
        // Season league: overall = current (it's already cumulative)
        currentScores.forEach(score => {
          overallScores[score.user_id] = { ...score };
        });
      }

      const overallList = Object.values(overallScores).sort((a, b) => b.points - a.points);
      setOverallLeaderboard(overallList);

    } catch (error) {
      console.error('Error fetching leaderboards:', error);
    }
  };

  const fetchMatchups = async () => {
    if (!user) return;

    try {
      // Get user's team
      const { data: membership } = await supabase
        .from('league_memberships')
        .select('team_id')
        .eq('league_id', id)
        .eq('user_id', user.id)
        .single();

      if (!membership?.team_id) {
        setMatchups([]);
        return;
      }

      // For tournament leagues without active tournament, clear matchups
      if (league?.league_type === 'tournament' && !league?.current_tournament_id) {
        setMatchups([]);
        return;
      }

      // Get user's players
      let playersQuery = supabase
        .from('team_players')
        .select('player_fide_id')
        .eq('team_id', membership.team_id)
        .eq('league_id', id);

      // Filter by tournament for tournament leagues
      if (league?.league_type === 'tournament' && league?.current_tournament_id) {
        playersQuery = playersQuery.eq('tournament_id', league.current_tournament_id);
      }

      const { data: teamPlayers } = await playersQuery;

      const playerIds = teamPlayers?.map(p => p.player_fide_id) || [];
      setUserPlayerIds(playerIds);

      if (playerIds.length === 0) {
        setMatchups([]);
        return;
      }

      // Get matchups for user's players from tournament_pairings
      let matchupsQuery = supabase
        .from('tournament_pairings')
        .select(`
          id,
          round_number,
          result,
          white_player_fide_id,
          black_player_fide_id,
          white_player:players!tournament_pairings_white_player_fide_id_fkey(fide_id, name, rating, country, title),
          black_player:players!tournament_pairings_black_player_fide_id_fkey(fide_id, name, rating, country, title)
        `)
        .eq('round_number', currentRound)
        .or(`white_player_fide_id.in.(${playerIds.join(',')}),black_player_fide_id.in.(${playerIds.join(',')})`)
        .order('round_number');

      // Filter by tournament for tournament leagues
      if (league?.league_type === 'tournament' && league?.current_tournament_id) {
        matchupsQuery = matchupsQuery.eq('tournament_id', league.current_tournament_id);
      }

      const { data: matchupsData } = await matchupsQuery;

      // Fetch fantasy points for these games
      const gameIds = matchupsData?.map((m: any) => m.id) || [];
      let fantasyPointsMap: Record<string, { white: number; black: number }> = {};

      if (gameIds.length > 0) {
        const { data: pointsData } = await supabase
          .from('game_fantasy_points')
          .select('game_id, player_fide_id, total_points')
          .eq('league_id', id)
          .in('game_id', gameIds);

        // Build map of game_id -> {white_points, black_points}
        pointsData?.forEach((p: any) => {
          if (!fantasyPointsMap[p.game_id]) {
            fantasyPointsMap[p.game_id] = { white: 0, black: 0 };
          }
          // Find which player this is using fide_id fields
          const matchup = matchupsData?.find((m: any) => m.id === p.game_id);
          if (matchup) {
            if (matchup.white_player_fide_id === p.player_fide_id) {
              fantasyPointsMap[p.game_id].white = p.total_points;
            } else if (matchup.black_player_fide_id === p.player_fide_id) {
              fantasyPointsMap[p.game_id].black = p.total_points;
            }
          }
        });
      }

      // Map to old format for compatibility
      // Note: Supabase returns foreign key relations as arrays, so we take the first element
      const formattedMatchups = matchupsData?.map((m: any) => ({
        id: m.id,
        round_number: m.round_number,
        white_player: Array.isArray(m.white_player) ? m.white_player[0] : m.white_player,
        black_player: Array.isArray(m.black_player) ? m.black_player[0] : m.black_player,
        status: m.result || 'scheduled',
        white_classical_score: m.result === 'white_win' ? 1 : m.result === 'draw' ? 0.5 : 0,
        black_classical_score: m.result === 'black_win' ? 1 : m.result === 'draw' ? 0.5 : 0,
        white_fantasy_points: fantasyPointsMap[m.id]?.white,
        black_fantasy_points: fantasyPointsMap[m.id]?.black,
      })) || [];

      setMatchups(formattedMatchups as any);
    } catch (error) {
      console.error('Error fetching matchups:', error);
    }
  };

  const startDraft = async () => {
    if (!league || !user) return;

    try {
      setStartingDraft(true);

      // 1. Update league status to 'drafting'
      const { error: statusError } = await supabase
        .from('leagues')
        .update({ status: 'drafting' })
        .eq('id', league.id);

      if (statusError) throw statusError;

      // 2. Get all league members
      const { data: memberships, error: membersError } = await supabase
        .from('league_memberships')
        .select('id, user_id, team_id')
        .eq('league_id', league.id);

      if (membersError) throw membersError;

      // 3. Randomize draft order
      const shuffled = [...(memberships || [])].sort(() => Math.random() - 0.5);
      
      // 4. Update each membership with draft_order
      for (let i = 0; i < shuffled.length; i++) {
        const { error: orderError } = await supabase
          .from('league_memberships')
          .update({ draft_order: i + 1 })
          .eq('id', shuffled[i].id);

        if (orderError) throw orderError;
      }

      // 5. Create draft_state
      const firstTeamId = shuffled[0]?.team_id;
      const { error: draftStateError } = await supabase
        .from('draft_state')
        .insert({
          league_id: league.id,
          current_pick_number: 1,
          current_team_id: firstTeamId,
          pick_deadline: new Date(Date.now() + 30000).toISOString(),
          is_active: true
        });

      if (draftStateError) throw draftStateError;

      // 6. Update local state and navigate to draft room
      setLeague(prev => prev ? { ...prev, status: 'drafting' } : null);
      router.push(`/draft-room/${id}`);
      
    } catch (error) {
      console.error('Error starting draft:', error);
      Alert.alert('Error', 'Failed to start draft');
    } finally {
      setStartingDraft(false);
    }
  };

  const renderTeamsTab = () => (
    <ScrollView style={styles.tabContent}>
      {teams.length === 0 ? (
        <Text style={styles.emptyText}>No teams yet</Text>
      ) : (
        teams.map((team) => (
          <View key={team.id} style={styles.teamCard}>
            <TouchableOpacity
              onPress={() => fetchTeamRoster(team.id)}
              style={styles.teamHeader}
            >
              <View style={styles.teamHeaderLeft}>
                <Image
                  source={require('@/assets/images/fantasy pawns/14.png')}
                  style={styles.teamAvatar}
                  tintColor="#2563eb"
                />
                <Text style={styles.teamName}>{team.name}</Text>
              </View>
              <Text style={styles.expandIcon}>
                {expandedTeams.has(team.id) ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {expandedTeams.has(team.id) && teamRosters[team.id] && (
              <View style={styles.rosterContainer}>
                {teamRosters[team.id].length === 0 ? (
                  <Text style={styles.emptyRosterText}>No players drafted yet</Text>
                ) : (
                  teamRosters[team.id].map((player) => (
                    <View key={player.fide_id} style={styles.playerRow}>
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>
                          {player.title && <Text style={styles.playerTitle}>{player.title} </Text>}
                          {player.name}
                        </Text>
                        <Text style={styles.playerDetails}>
                          {player.country} • {player.rating}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        ))
      )}
      
      {/* Player Trades - Only show if user has a team AND league is active (draft complete) */}
      {userTeamId && user && league?.status === 'active' && (
        <View style={styles.tradesSection}>
          <PlayerTrades
            leagueId={id as string}
            teamId={userTeamId}
            userId={user.id}
            currentRoster={userRoster}
            allTeams={teams}
            onTradeComplete={() => {
              fetchTeams(); // Refresh all teams
              if (userTeamId) fetchUserRoster(userTeamId); // Refresh user's roster
            }}
          />
        </View>
      )}
      
      {/* Open Market Trading - Only show if user has a team AND league is active (draft complete) */}
      {userTeamId && league?.status === 'active' && (
        <View style={styles.openMarketSection}>
          <OpenMarketTrading
            leagueId={id as string}
            teamId={userTeamId}
            currentRoster={userRoster}
            onTradeComplete={() => {
              fetchTeams(); // Refresh all teams
              if (userTeamId) fetchUserRoster(userTeamId); // Refresh user's roster
            }}
          />
        </View>
      )}
    </ScrollView>
  );

  const renderLeaderboardTab = () => (
    <ScrollView style={styles.tabContent}>
      {league?.league_type === 'season' ? (
        // Season League: Single leaderboard
        <View style={styles.leaderboardSection}>
          <Text style={styles.leaderboardTitle}>Season Standings</Text>
          {currentLeaderboard.length === 0 ? (
            <Text style={styles.emptyText}>No scores yet</Text>
          ) : (
            currentLeaderboard.map((entry, index) => (
              <View key={entry.user_id} style={styles.leaderboardRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <Image
                  source={require('@/assets/images/fantasy pawns/13.png')}
                  style={styles.leaderboardAvatar}
                  tintColor={index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#cd7f32' : '#64748b'}
                />
                <View style={styles.leaderboardInfo}>
                  <Text style={styles.leaderboardName}>{entry.team_name}</Text>
                </View>
                <Text style={styles.leaderboardPoints}>{entry.points} pts</Text>
              </View>
            ))
          )}
        </View>
      ) : (
        // Tournament League: Two leaderboards
        <>
          {/* Current Tournament */}
          <View style={styles.leaderboardSection}>
            <Text style={styles.leaderboardTitle}>Current Tournament</Text>
            {currentLeaderboard.length === 0 ? (
              <Text style={styles.emptyText}>No scores yet</Text>
            ) : (
              currentLeaderboard.map((entry, index) => (
                <View key={entry.user_id} style={styles.leaderboardRow}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                  <Image
                    source={require('@/assets/images/fantasy pawns/13.png')}
                    style={styles.leaderboardAvatar}
                    tintColor={index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#cd7f32' : '#64748b'}
                  />
                  <View style={styles.leaderboardInfo}>
                    <Text style={styles.leaderboardName}>{entry.team_name}</Text>
                  </View>
                  <Text style={styles.leaderboardPoints}>{entry.points} pts</Text>
                </View>
              ))
            )}
          </View>

          {/* Overall Standings */}
          <View style={styles.leaderboardSection}>
            <Text style={styles.leaderboardTitle}>Overall Season</Text>
            {overallLeaderboard.length === 0 ? (
              <Text style={styles.emptyText}>No overall scores yet</Text>
            ) : (
              overallLeaderboard.map((entry, index) => (
                <View key={entry.user_id} style={styles.leaderboardRow}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                  <Image
                    source={require('@/assets/images/fantasy pawns/13.png')}
                    style={styles.leaderboardAvatar}
                    tintColor={index === 0 ? '#fbbf24' : index === 1 ? '#94a3b8' : index === 2 ? '#cd7f32' : '#64748b'}
                  />
                  <View style={styles.leaderboardInfo}>
                    <Text style={styles.leaderboardName}>{entry.team_name}</Text>
                  </View>
                  <Text style={styles.leaderboardPoints}>{entry.points} pts</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );

  const getTournamentStatus = () => {
    if (!tournament?.start_date) return 'upcoming';
    const now = new Date();
    const startDate = new Date(tournament.start_date);
    return now >= startDate ? 'ongoing' : 'upcoming';
  };

  const renderMatchupsTab = () => {
    const tournamentStatus = getTournamentStatus();
    
    return (
      <View style={styles.tabContent}>
        {/* Tournament Info Banner - Only on Matchups Tab */}
        {league?.current_tournament_id && tournament && (
          <View style={styles.upcomingTournamentBox}>
            <View style={styles.upcomingTournamentHeader}>
              <Text style={styles.upcomingTournamentIcon}>
                {tournamentStatus === 'upcoming' ? '📅' : '🏆'}
              </Text>
              <Text style={styles.upcomingTournamentTitle}>
                {tournamentStatus === 'upcoming' ? 'Upcoming Tournament' : 'Ongoing Tournament'}
              </Text>
            </View>
            <Text style={styles.upcomingTournamentName}>{tournament.name}</Text>
            {tournament.location && (
              <Text style={styles.upcomingTournamentLocation}>📍 {tournament.location}</Text>
            )}
            <View style={styles.upcomingTournamentDivider} />
            <View style={styles.upcomingTournamentDraftInfo}>
              <Text style={styles.upcomingTournamentLabel}>
                {tournamentStatus === 'upcoming' ? 'Tournament Starts:' : 'Started:'}
              </Text>
              <Text style={styles.upcomingTournamentDate}>
                {tournament.start_date
                  ? new Date(tournament.start_date).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                  : 'Date TBD'}
              </Text>
            </View>
            {tournamentStatus === 'upcoming' && (
              <Text style={styles.upcomingTournamentNote}>
                Make sure to complete your draft before the tournament begins!
              </Text>
            )}
          </View>
        )}

        {/* Round Selector */}
        <View style={styles.roundSelector}>
        <TouchableOpacity
          onPress={() => setCurrentRound(Math.max(1, currentRound - 1))}
          disabled={currentRound === 1}
          style={[styles.roundButton, currentRound === 1 && styles.roundButtonDisabled]}
        >
          <Text style={styles.roundButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.roundText}>Round {currentRound}</Text>
        <TouchableOpacity
          onPress={() => setCurrentRound(Math.min(7, currentRound + 1))}
          disabled={currentRound === 7}
          style={[styles.roundButton, currentRound === 7 && styles.roundButtonDisabled]}
        >
          <Text style={styles.roundButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {matchups.length === 0 ? (
        <Text style={styles.emptyText}>No matchups for your players in this round</Text>
      ) : (
        matchups.map((matchup) => {
          const isWhiteMyPlayer = userPlayerIds.includes((matchup.white_player as any)?.fide_id);
          const isBlackMyPlayer = userPlayerIds.includes((matchup.black_player as any)?.fide_id);
          return (
          <View key={matchup.id} style={styles.matchupCard}>
            <View style={styles.matchupRow}>
              <View style={[styles.playerSide, isWhiteMyPlayer && styles.myPlayerSide]}>
                <View style={styles.playerNameRow}>
                  <Text style={styles.matchupPlayerName}>
                    {(matchup.white_player as any)?.title && (
                      <Text style={styles.playerTitle}>{(matchup.white_player as any).title} </Text>
                    )}
                    {(matchup.white_player as any)?.name || 'TBD'}
                  </Text>
                  {matchup.white_fantasy_points !== undefined && (
                    <Text style={[
                      styles.fantasyPoints,
                      matchup.white_fantasy_points > 0 ? styles.positivePoints : styles.negativePoints
                    ]}>
                      {matchup.white_fantasy_points > 0 ? '+' : ''}{matchup.white_fantasy_points.toFixed(1)}
                    </Text>
                  )}
                </View>
                <Text style={styles.matchupPlayerInfo}>
                  {(matchup.white_player as any)?.country} • {(matchup.white_player as any)?.rating}
                </Text>
              </View>
              <View style={styles.matchupScore}>
                <Text style={styles.scoreText}>
                  {matchup.white_classical_score} - {matchup.black_classical_score}
                </Text>
                <Text style={styles.statusText}>{matchup.status}</Text>
              </View>
              <View style={[styles.playerSide, isBlackMyPlayer && styles.myPlayerSide]}>
                <View style={styles.playerNameRow}>
                  <Text style={styles.matchupPlayerName}>
                    {(matchup.black_player as any)?.title && (
                      <Text style={styles.playerTitle}>{(matchup.black_player as any).title} </Text>
                    )}
                    {(matchup.black_player as any)?.name || 'TBD'}
                  </Text>
                  {matchup.black_fantasy_points !== undefined && (
                    <Text style={[
                      styles.fantasyPoints,
                      matchup.black_fantasy_points > 0 ? styles.positivePoints : styles.negativePoints
                    ]}>
                      {matchup.black_fantasy_points > 0 ? '+' : ''}{matchup.black_fantasy_points.toFixed(1)}
                    </Text>
                  )}
                </View>
                <Text style={styles.matchupPlayerInfo}>
                  {(matchup.black_player as any)?.country} • {(matchup.black_player as any)?.rating}
                </Text>
              </View>
            </View>
          </View>
        );
        })
      )}
    </View>
    );
  };

  if (loading) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}

if (!league) {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.errorText}>League not found</Text>
    </View>
  );
}

return (
  <>
    <Stack.Screen options={{ headerShown: false }} />
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.leagueName}>{league.name}</Text>
            {tournament && (
              <Text style={styles.tournamentName}>📍 {tournament.name}</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => router.push(`/league-settings/${id}`)}
            style={styles.settingsButton}
          >
            <SlidersIcon size={24} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'matchups' && styles.activeTab]}
          onPress={() => setActiveTab('matchups')}
        >
          <Text style={[styles.tabText, activeTab === 'matchups' && styles.activeTabText]}>
            Matchups
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'leaderboard' && styles.activeTab]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.activeTabText]}>
            Leaderboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'teams' && styles.activeTab]}
          onPress={() => setActiveTab('teams')}
        >
          <Text style={[styles.tabText, activeTab === 'teams' && styles.activeTabText]}>
            Teams
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'matchups' && renderMatchupsTab()}
        {activeTab === 'leaderboard' && renderLeaderboardTab()}
        {activeTab === 'teams' && renderTeamsTab()}
        
        {/* Member Capacity Notification - Show when not at max capacity */}
        {isOwner && league.status === 'open' && teams.length < league.max_members && (
          <View style={styles.capacityNotification}>
            <Text style={styles.capacityTitle}>👥 Waiting for Members</Text>
            <Text style={styles.capacityText}>
              {teams.length} of {league.max_members} members have joined. You need all {league.max_members} members to start the draft.
            </Text>
            <Text style={styles.capacityHint}>
              💡 Tip: You can change the max members in league settings if you want to start sooner.
            </Text>
          </View>
        )}

        {/* High Picks Warning - Show when total picks > tournament players */}
        {!warningDismissed && isOwner && league.status === 'open' && league.league_type === 'tournament' && tournamentPlayerCount > 0 && (
          (() => {
            const totalPicks = league.picks_per_person * league.max_members;
            const picksPerPersonRatio = league.picks_per_person / tournamentPlayerCount;
            
            // Warn if total picks exceeds available players OR picks per person ratio > 1:5
            if (totalPicks > tournamentPlayerCount || picksPerPersonRatio > 0.2) {
              return (
                <View style={styles.warningNotification}>
                  <View style={styles.warningHeader}>
                    <Text style={styles.warningTitle}>⚠️ Draft Configuration Warning</Text>
                    <TouchableOpacity 
                      onPress={() => setWarningDismissed(true)}
                      style={styles.closeButton}
                    >
                      <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  {totalPicks > tournamentPlayerCount ? (
                    <>
                      <Text style={styles.warningText}>
                        Total picks needed: {league.max_members} members × {league.picks_per_person} picks = {totalPicks} picks
                      </Text>
                      <Text style={styles.warningText}>
                        Available players: {tournamentPlayerCount}
                      </Text>
                      <Text style={styles.warningText}>
                        ⚠️ Not enough players! Members may be forced to pick fewer than {league.picks_per_person} players, or some members may not be able to draft at all.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.warningText}>
                        Picks per person ({league.picks_per_person}) is high relative to tournament size ({tournamentPlayerCount} players).
                      </Text>
                      <Text style={styles.warningText}>
                        This may cause teammates to face each other. Consider reducing picks per person in settings.
                      </Text>
                    </>
                  )}
                </View>
              );
            }
            return null;
          })()
        )}

        {/* Start Draft Button - Only show for owner when league is open and all spots filled */}
        {isOwner && league.status === 'open' && teams.length === league.max_members && (
          <View style={styles.startDraftContainer}>
            {league.league_type === 'tournament' && !league.current_tournament_id ? (
              <>
                <Text style={styles.startDraftTitle}>📅 No Active Tournament</Text>
                <Text style={styles.startDraftText}>
                  No tournaments right now. Check back soon for the next tournament announcement!
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.startDraftTitle}>🎯 Ready to Draft!</Text>
                <Text style={styles.startDraftText}>
                  All {league.max_members} members have joined. Start the draft to begin picking players!
                </Text>
                <TouchableOpacity
                  style={[styles.startDraftButton, startingDraft && styles.startDraftButtonDisabled]}
                  onPress={startDraft}
                  disabled={startingDraft}
                >
                  {startingDraft ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.startDraftButtonText}>Start Draft</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 20,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 24,
  },
  leagueName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  tournamentName: {
    fontSize: 11,
    color: '#94a3b8',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#2563eb',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  teamCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  teamHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teamAvatar: {
    width: 32,
    height: 32,
  },
  teamName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  teamOwner: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 16,
    color: '#94a3b8',
  },
  rosterContainer: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    padding: 16,
    paddingTop: 12,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 2,
  },
  playerTitle: {
    color: '#fbbf24',
    fontWeight: '600',
  },
  playerDetails: {
    fontSize: 12,
    color: '#94a3b8',
  },
  emptyRosterText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 8,
  },
  leaderboardSection: {
    marginBottom: 32,
  },
  leaderboardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  leaderboardAvatar: {
    width: 28,
    height: 28,
    marginRight: 12,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  leaderboardTeam: {
    fontSize: 12,
    color: '#94a3b8',
  },
  leaderboardPoints: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#60a5fa',
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
  matchupCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  matchupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerSide: {
    flex: 1,
  },
  myPlayerSide: {
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  matchupPlayerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  matchupPlayerInfo: {
    fontSize: 11,
    color: '#94a3b8',
  },
  matchupScore: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#60a5fa',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'capitalize',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
  },
  startDraftContainer: {
    margin: 16,
    marginTop: 24,
    marginBottom: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  startDraftTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginBottom: 6,
  },
  startDraftText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 12,
  },
  startDraftButton: {
    backgroundColor: '#10b981',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  startDraftButtonDisabled: {
    opacity: 0.6,
  },
  startDraftButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  upcomingTournamentBox: {
    margin: 16,
    marginBottom: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
  },
  upcomingTournamentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  upcomingTournamentIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  upcomingTournamentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upcomingTournamentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  upcomingTournamentLocation: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
  },
  upcomingTournamentDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  upcomingTournamentDraftInfo: {
    marginBottom: 8,
  },
  upcomingTournamentLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  upcomingTournamentDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#60a5fa',
  },
  upcomingTournamentNote: {
    fontSize: 12,
    color: '#fbbf24',
    fontStyle: 'italic',
    marginTop: 4,
  },
  capacityNotification: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  capacityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  capacityText: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 8,
    lineHeight: 20,
  },
  capacityHint: {
    fontSize: 12,
    color: '#93c5fd',
    fontStyle: 'italic',
  },
  warningNotification: {
    backgroundColor: '#7c2d12',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  warningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#fcd34d',
    fontWeight: 'bold',
  },
  warningText: {
    fontSize: 14,
    color: '#fcd34d',
    marginBottom: 6,
    lineHeight: 20,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fantasyPoints: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#1e293b',
  },
  positivePoints: {
    color: '#10b981',
  },
  negativePoints: {
    color: '#ef4444',
  },
  tradesSection: {
    marginTop: 24,
    borderTopWidth: 2,
    borderTopColor: '#334155',
    paddingTop: 16,
  },
  openMarketSection: {
    marginTop: 24,
    borderTopWidth: 2,
    borderTopColor: '#334155',
    paddingTop: 16,
  },
});
