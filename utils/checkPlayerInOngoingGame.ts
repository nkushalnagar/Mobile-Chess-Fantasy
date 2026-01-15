import { supabase } from '@/lib/supabase';

// Cache to store ongoing games data (keyed by leagueId-tournamentId)
const ongoingGamesCache = new Map<string, Map<string, { status: 'ongoing' | 'processing', lichessUrl: string }>>();
const cacheTimestamps = new Map<string, number>();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Check if a player is currently in an ongoing game
 * @param playerFideId - Player's FIDE ID
 * @param tournamentId - Tournament ID (optional, checks all tournaments if not provided)
 * @returns Promise<boolean> - true if player is in an ongoing game
 */
export async function checkPlayerInOngoingGame(
  playerFideId: string,
  tournamentId?: string
): Promise<boolean> {
  try {
    const query = supabase
      .from('tournament_pairings')
      .select('id')
      .eq('result', 'ongoing')
      .or(`white_player_fide_id.eq.${playerFideId},black_player_fide_id.eq.${playerFideId}`)
      .limit(1);

    if (tournamentId) {
      query.eq('tournament_id', tournamentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking player ongoing game:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking player ongoing game:', error);
    return false;
  }
}

/**
 * Check multiple players for ongoing games
 * @param playerFideIds - Array of player FIDE IDs
 * @param tournamentId - Tournament ID (optional)
 * @param leagueId - League ID for caching (optional but recommended)
 * @returns Promise<Map<string, { status: 'ongoing' | 'processing', lichessUrl: string }>> - Map of FIDE IDs to their status and Lichess URLs
 */
export async function checkPlayersInOngoingGames(
  playerFideIds: string[],
  tournamentId?: string,
  leagueId?: string
): Promise<Map<string, { status: 'ongoing' | 'processing', lichessUrl: string }>> {
  try {
    if (playerFideIds.length === 0) {
      return new Map();
    }

    // Check cache if leagueId is provided
    if (leagueId) {
      const cacheKey = `${leagueId}-${tournamentId || 'all'}`;
      const cachedData = ongoingGamesCache.get(cacheKey);
      const cacheTime = cacheTimestamps.get(cacheKey);
      
      if (cachedData && cacheTime && (Date.now() - cacheTime < CACHE_DURATION)) {
        console.log('✅ Using cached ongoing games data for:', cacheKey);
        return cachedData;
      }
    }

    // If no specific tournament, get all tournaments this league has drafted for
    let leagueTournamentIds: string[] = [];
    let isSeasonLeague = false;
    
    if (!tournamentId && leagueId) {
      const { data: leagueTournaments } = await supabase
        .from('team_players')
        .select('tournament_id, season_id')
        .eq('league_id', leagueId);
      
      // Check if this is a season league (has season_id, no tournament_id)
      isSeasonLeague = leagueTournaments?.some(t => t.season_id && !t.tournament_id) || false;
      
      if (!isSeasonLeague) {
        // Tournament league: get specific tournament IDs
        leagueTournamentIds = [...new Set(leagueTournaments?.map(t => t.tournament_id).filter(Boolean) || [])];
      }
      // For season leagues, we don't filter by tournament - check all tournaments
    }

    const query = supabase
      .from('tournament_pairings')
      .select('white_player_fide_id, black_player_fide_id, lichess_game_url, result, fantasy_points_calculated')
      .or('result.eq.ongoing,and(result.in.(white_win,black_win,draw),fantasy_points_calculated.eq.false)');

    if (tournamentId) {
      // Specific tournament requested
      query.eq('tournament_id', tournamentId);
    } else if (isSeasonLeague) {
      // Season league: check ALL tournaments (players can be in any tournament)
      // No filter needed - query already checks all pairings
    } else if (leagueTournamentIds.length > 0) {
      // Tournament league: only check the league's specific tournaments
      query.in('tournament_id', leagueTournamentIds);
    } else if (!leagueId) {
      // If no leagueId provided, check all tournaments (backward compatibility)
      // This case shouldn't happen in normal usage
    } else {
      // League has no tournaments drafted, return empty
      return new Map();
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error checking players ongoing games:', error);
      return new Map();
    }

    const ongoingPlayersMap = new Map<string, { status: 'ongoing' | 'processing', lichessUrl: string }>();
    
    data?.forEach((pairing) => {
      // Determine status: 'ongoing' if game is in progress, 'processing' if waiting for fantasy points
      const status = pairing.result === 'ongoing' ? 'ongoing' : 'processing';
      
      // Store ALL players in ongoing games, not just the ones we're checking
      // This way the cache works for any subset of players
      ongoingPlayersMap.set(pairing.white_player_fide_id, {
        status,
        lichessUrl: pairing.lichess_game_url || ''
      });
      ongoingPlayersMap.set(pairing.black_player_fide_id, {
        status,
        lichessUrl: pairing.lichess_game_url || ''
      });
    });

    // Cache the result if leagueId is provided
    if (leagueId) {
      const cacheKey = `${leagueId}-${tournamentId || 'all'}`;
      ongoingGamesCache.set(cacheKey, ongoingPlayersMap);
      cacheTimestamps.set(cacheKey, Date.now());
      console.log('💾 Cached ongoing games data for:', cacheKey);
    }

    return ongoingPlayersMap;
  } catch (error) {
    console.error('Error checking players ongoing games:', error);
    return new Map();
  }
}
