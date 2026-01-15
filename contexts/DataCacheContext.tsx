import React, { createContext, useContext, useState, ReactNode } from 'react';

interface League {
  id: string;
  name: string;
  max_members: number;
  picks_per_person: number;
  created_at: string;
  league_type?: string;
  min_player_rating?: number;
  max_player_rating?: number;
}

interface Tournament {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location?: string;
  time_control?: string;
  status: string;
  is_active?: boolean;
  icon_url?: string;
}

interface NewsPost {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string;
  link?: string;
  image_url?: string;
  published_at: string;
  created_at: string;
  reaction_counts?: any;
  user_reaction?: string | null;
  reaction_count?: number;
  comment_count?: number;
}

interface Player {
  fide_id: string;
  name: string;
  rating: number | null;
  country: string | null;
  title: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  rapid_rating: number | null;
  blitz_rating: number | null;
}

interface TournamentPlayers {
  [tournamentId: string]: Player[];
}

interface DataCacheContextType {
  // Home page data
  leagues: League[] | null;
  setLeagues: (leagues: League[]) => void;
  tournaments: Tournament[] | null;
  setTournaments: (tournaments: Tournament[]) => void;
  newsPosts: NewsPost[] | null;
  setNewsPosts: (posts: NewsPost[]) => void;
  
  // Leagues page data (separate from home page leagues)
  leaguesPageData: League[] | null;
  setLeaguesPageData: (leagues: League[]) => void;
  
  // Tournament players cache
  tournamentPlayers: TournamentPlayers;
  setTournamentPlayers: (tournamentId: string, players: Player[]) => void;
  getTournamentPlayers: (tournamentId: string) => Player[] | undefined;
  
  // Clear cache functions
  clearHomeCache: () => void;
  clearLeaguesPageCache: () => void;
  clearTournamentPlayersCache: () => void;
  clearAllCache: () => void;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

export function DataCacheProvider({ children }: { children: ReactNode }) {
  const [leagues, setLeagues] = useState<League[] | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [newsPosts, setNewsPosts] = useState<NewsPost[] | null>(null);
  const [leaguesPageData, setLeaguesPageData] = useState<League[] | null>(null);
  const [tournamentPlayers, setTournamentPlayersState] = useState<TournamentPlayers>({});

  const setTournamentPlayers = (tournamentId: string, players: Player[]) => {
    setTournamentPlayersState(prev => ({
      ...prev,
      [tournamentId]: players
    }));
  };

  const getTournamentPlayers = (tournamentId: string): Player[] | undefined => {
    return tournamentPlayers[tournamentId];
  };

  const clearHomeCache = () => {
    setLeagues(null);
    setTournaments(null);
    setNewsPosts(null);
  };

  const clearLeaguesPageCache = () => {
    setLeaguesPageData(null);
  };

  const clearTournamentPlayersCache = () => {
    setTournamentPlayersState({});
  };

  const clearAllCache = () => {
    clearHomeCache();
    clearLeaguesPageCache();
    clearTournamentPlayersCache();
  };

  return (
    <DataCacheContext.Provider
      value={{
        leagues,
        setLeagues,
        tournaments,
        setTournaments,
        newsPosts,
        setNewsPosts,
        leaguesPageData,
        setLeaguesPageData,
        tournamentPlayers,
        setTournamentPlayers,
        getTournamentPlayers,
        clearHomeCache,
        clearLeaguesPageCache,
        clearTournamentPlayersCache,
        clearAllCache,
      }}
    >
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
}
