import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image, TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform, Switch, Animated, RefreshControl } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import SkeletonLoader from '@/components/SkeletonLoader';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH - 60; // 20px padding on each side + 20px for next card peek

// Knight emblem images
const KNIGHT_EMBLEMS = [
  require('@/assets/images/Untitled design/8.png'),
  require('@/assets/images/Untitled design/9.png'),
  require('@/assets/images/Untitled design/10.png'),
  require('@/assets/images/Untitled design/11.png'),
  require('@/assets/images/Untitled design/12.png'),
  require('@/assets/images/Untitled design/Untitled design (2).png'),
];

// Function to get a random emblem based on league ID (consistent per league)
const getEmblemForLeague = (leagueId: string) => {
  const hash = leagueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return KNIGHT_EMBLEMS[hash % KNIGHT_EMBLEMS.length];
};

interface League {
  id: string;
  name: string;
  max_members: number;
  picks_per_person: number;
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
  source_website?: string;
  link?: string;
  image_url?: string;
  published_at: string;
  reaction_count: number;
  comment_count: number;
  user_reaction?: string | null;
  reaction_counts?: Record<string, number>;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  like_count: number;
  user: {
    username: string;
  };
  user_liked?: boolean;
}

const REACTION_EMOJIS: Record<string, string> = {
  love: '❤️',
  fire: '🔥',
  thinking: '🤔',
  celebrate: '🎉',
  sad: '😢',
  dislike: '👎',
};

export default function HomeTab() {
  const { profile } = useAuth();
  const { theme, colors, toggleTheme } = useTheme();
  const { leagues, setLeagues, tournaments, setTournaments, newsPosts, setNewsPosts } = useDataCache();
  const router = useRouter();
  const [tournamentFilter, setTournamentFilter] = useState<'upcoming' | 'ongoing'>('upcoming');
  const [tournamentsExpanded, setTournamentsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const commentInputRef = useRef<TextInput>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const slideAnim = useState(new Animated.Value(-300))[0];
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Check if user needs to set username
    if (profile && !profile.username) {
      setShowUsernamePrompt(true);
      // Slide in animation
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        handleCloseUsernamePrompt();
      }, 5000);
    }
  }, [profile]);

  // Real-time subscription for comments when modal is open
  useEffect(() => {
    if (!selectedPost || !profile) return;

    const channel = supabase
      .channel(`comments_${selectedPost.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'news_comments',
          filter: `post_id=eq.${selectedPost.id}`,
        },
        async (payload) => {
          const newComment = payload.new as any;
          
          // Fetch username for the new comment
          const { data: profileData } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', newComment.user_id)
            .single();

          // Add the new comment to the list without showing loading
          setComments((current) => [{
            id: newComment.id,
            content: newComment.content,
            created_at: newComment.created_at,
            like_count: newComment.like_count || 0,
            user: { username: profileData?.username || 'Unknown' },
            user_liked: false,
          }, ...current]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPost, profile]);

  const handleCloseUsernamePrompt = () => {
    Animated.timing(slideAnim, {
      toValue: -300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowUsernamePrompt(false);
    });
  };

  // Fetch data only if we don't have it yet
  useEffect(() => {
    if (profile && leagues === null) {
      setLoading(true);
      fetchLeagues();
    }
    if (profile && tournaments === null) {
      fetchUpcomingTournaments();
    }
    if (profile && newsPosts === null) {
      fetchNewsPosts();
    }
  }, [profile, leagues, tournaments, newsPosts]);

  // Real-time subscription for comment and reaction updates
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('news_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'news_comments',
        },
        async (payload) => {
          const newComment = payload.new as any;
          const postId = newComment.post_id;

          setNewsPosts((currentPosts) => {
            if (!currentPosts) return currentPosts;
            return currentPosts.map((post: NewsPost) => 
              post.id === postId 
                ? { ...post, comment_count: (post.comment_count || 0) + 1 }
                : post
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'news_reactions',
        },
        async (payload) => {
          const reaction = payload.new as any;
          const postId = reaction?.post_id || (payload.old as any)?.post_id;
          if (!postId) return;

          // Refetch reaction counts for this post
          const { data: allReactions } = await supabase
            .from('news_reactions')
            .select('reaction_type')
            .eq('post_id', postId);

          const { data: userReaction } = await supabase
            .from('news_reactions')
            .select('reaction_type')
            .eq('post_id', postId)
            .eq('user_id', profile.id)
            .maybeSingle();

          const reactionCounts: Record<string, number> = {};
          allReactions?.forEach((r: any) => {
            reactionCounts[r.reaction_type] = (reactionCounts[r.reaction_type] || 0) + 1;
          });

          setNewsPosts((currentPosts) => {
            if (!currentPosts) return currentPosts;
            return currentPosts.map((post: NewsPost) => 
              post.id === postId 
                ? { 
                    ...post, 
                    user_reaction: userReaction?.reaction_type || null,
                    reaction_counts: reactionCounts,
                    reaction_count: Object.values(reactionCounts).reduce((a, b) => a + b, 0)
                  }
                : post
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchLeagues(),
      fetchUpcomingTournaments(),
      fetchNewsPosts()
    ]);
    setRefreshing(false);
  }, []);

  const fetchLeagues = async () => {
    if (!profile?.id) return;

    try {
      const { data, error} = await supabase
        .from('league_memberships')
        .select(`
          league_id,
          leagues (
            id,
            name,
            max_members,
            picks_per_person,
            league_type,
            min_player_rating,
            max_player_rating
          )
        `)
        .eq('user_id', profile.id);

      if (error) throw error;

      const leaguesData = data
        ?.map((membership: any) => membership.leagues)
        .filter(Boolean) || [];

      setLeagues(leaguesData);
    } catch (error) {
      console.error('Error fetching leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, start_date, end_date, location, time_control, status, is_active, icon_url')
        .in('status', ['upcoming', 'active'])
        .order('start_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      setTournaments(data || []);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    }
  };

  const removeDuplicatesAndSimilar = (posts: any[]) => {
    // Common words to ignore when comparing titles
    const commonWords = new Set([
      'the', 'and', 'on', 'a', 'an', 'in', 'to', 'of', 'for', 'with', 'at', 'by', 'from',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'chess', 'win', 'wins', 'won', 'lose', 'loses', 'lost', 'draw', 'draws', 'drew',
      'player', 'players', 'game', 'games', 'match', 'matches', 'fighting', 'fight', 'fights'
    ]);

    const normalizeTitle = (title: string) => {
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 0);
    };

    const getSignificantWords = (title: string) => {
      const words = normalizeTitle(title);
      return words.filter(word => !commonWords.has(word));
    };

    const areSimilar = (title1: string, title2: string) => {
      const words1 = getSignificantWords(title1);
      const words2 = getSignificantWords(title2);

      // Count matching significant words
      const matches = words1.filter(word => words2.includes(word)).length;

      // If 4+ significant words match, consider them similar
      return matches >= 4;
    };

    const uniquePosts: any[] = [];
    const seenTitles = new Set<string>();

    for (const post of posts) {
      // Check for exact duplicates
      if (seenTitles.has(post.title)) {
        continue;
      }

      // Check for similar titles
      const isSimilarToExisting = uniquePosts.some(existingPost => 
        areSimilar(post.title, existingPost.title)
      );

      if (!isSimilarToExisting) {
        uniquePosts.push(post);
        seenTitles.add(post.title);
      }
    }

    return uniquePosts;
  };

  const fetchNewsPosts = async () => {
    setNewsLoading(true);
    try {
      // Calculate date 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const { data: posts, error } = await supabase
        .from('news_posts')
        .select('*')
        .gte('published_at', twoDaysAgo.toISOString())
        .order('published_at', { ascending: false }); // Sort by date in database

      if (error) throw error;

      // Remove duplicates and similar articles
      const uniquePosts = removeDuplicatesAndSimilar(posts || []);

      // Sort by date (newest first), then by engagement
      // Date sorting is the PRIMARY sort - do not disrupt it
      const finalPosts = uniquePosts.sort((a: any, b: any) => {
        const dateA = new Date(a.published_at).getTime();
        const dateB = new Date(b.published_at).getTime();
        if (dateA !== dateB) {
          return dateB - dateA; // Newest first
        }

        const engagementA = (a.reaction_count || 0) + (a.comment_count || 0);
        const engagementB = (b.reaction_count || 0) + (b.comment_count || 0);
        return engagementB - engagementA;
      });

      // Fetch user's reactions and reaction counts for these posts
      if (profile?.id && finalPosts.length > 0) {
        const postIds = finalPosts.map(p => p.id);

        // Get user's reactions
        const { data: reactions } = await supabase
          .from('news_reactions')
          .select('post_id, reaction_type')
          .eq('user_id', profile.id)
          .in('post_id', postIds);

        // Get all reactions with counts
        const { data: allReactions } = await supabase
          .from('news_reactions')
          .select('post_id, reaction_type')
          .in('post_id', postIds);

        const reactionsMap = new Map(reactions?.map((r: any) => [r.post_id, r.reaction_type]));

        // Build reaction counts per post
        const reactionCounts: Record<string, Record<string, number>> = {};
        allReactions?.forEach((r: any) => {
          if (!reactionCounts[r.post_id]) reactionCounts[r.post_id] = {};
          reactionCounts[r.post_id][r.reaction_type] = (reactionCounts[r.post_id][r.reaction_type] || 0) + 1;
        });

        const postsWithReactions = finalPosts.map((post: any) => ({
          ...post,
          user_reaction: reactionsMap.get(post.id) || null,
          reaction_counts: reactionCounts[post.id] || {},
        }));

        setNewsPosts(postsWithReactions);
      } else {
        setNewsPosts(finalPosts);
      }
    } catch (error) {
      console.error('Error fetching news posts:', error);
    } finally {
      setNewsLoading(false);
    }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    try {
      const post = newsPosts?.find(p => p.id === postId);
      if (!post) return;
      
      const oldReaction = post.user_reaction;
      const oldCounts = { ...post.reaction_counts };
      
      // Optimistically update UI
      setNewsPosts((currentPosts) => {
        if (!currentPosts) return currentPosts;
        return currentPosts.map((p: NewsPost) => {
          if (p.id !== postId) return p;
          
          const newCounts = { ...p.reaction_counts };
          
          // Remove old reaction count
          if (oldReaction) {
            newCounts[oldReaction] = Math.max(0, (newCounts[oldReaction] || 0) - 1);
          }
          
          // Add new reaction count or remove if same
          if (oldReaction === reactionType) {
            return { ...p, user_reaction: null, reaction_counts: newCounts };
          } else {
            newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
            return { ...p, user_reaction: reactionType, reaction_counts: newCounts };
          }
        });
      });
      
      if (oldReaction === reactionType) {
        // Remove reaction if clicking the same one
        await supabase
          .from('news_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', profile!.id);
      } else {
        // Upsert will update if exists or insert if new
        await supabase
          .from('news_reactions')
          .upsert({
            post_id: postId,
            user_id: profile!.id,
            reaction_type: reactionType,
          }, {
            onConflict: 'post_id,user_id'
          });
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      // Revert on error
      fetchNewsPosts();
    }
  };

  const openComments = async (post: NewsPost) => {
    setSelectedPost(post);
    setNewComment(''); // Clear input when opening modal
    setCommentsLoading(true);
    try {
      const { data: commentsData, error } = await supabase
        .from('news_comments')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch usernames separately
      if (commentsData && commentsData.length > 0) {
        const userIds = commentsData.map(c => c.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p.username]));

        // Fetch user's likes on comments
        if (profile?.id) {
          const commentIds = commentsData.map(c => c.id);
          const { data: likes } = await supabase
            .from('news_comment_likes')
            .select('comment_id')
            .eq('user_id', profile.id)
            .in('comment_id', commentIds);

          const likesSet = new Set(likes?.map(l => l.comment_id));
          
          const commentsWithLikes = commentsData.map((comment: any) => ({
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            like_count: comment.like_count,
            user: { username: profilesMap.get(comment.user_id) || 'Unknown' },
            user_liked: likesSet.has(comment.id),
          }));

          setComments(commentsWithLikes);
        } else {
          const commentsWithUsernames = commentsData.map((comment: any) => ({
            id: comment.id,
            content: comment.content,
            created_at: comment.created_at,
            like_count: comment.like_count,
            user: { username: profilesMap.get(comment.user_id) || 'Unknown' },
            user_liked: false,
          }));

          setComments(commentsWithUsernames);
        }
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  const postComment = async () => {
    if (!profile?.id || !selectedPost || !newComment.trim() || sendingComment) return;

    const commentText = newComment.trim();
    setSendingComment(true);
    setNewComment('');

    try {
      await supabase
        .from('news_comments')
        .insert({
          post_id: selectedPost.id,
          user_id: profile.id,
          content: commentText,
        });

      // Real-time subscription will handle adding the comment to the list
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setSendingComment(false);
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!profile?.id) return;

    try {
      const comment = comments.find(c => c.id === commentId);
      
      if (comment?.user_liked) {
        await supabase
          .from('news_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', profile.id);
      } else {
        await supabase
          .from('news_comment_likes')
          .insert({
            comment_id: commentId,
            user_id: profile.id,
          });
      }

      if (selectedPost) {
        openComments(selectedPost);
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'Chess.com': return '#10b981'; // Green
      case 'ChessBase': return '#ef4444'; // Red
      case 'FIDE': return '#3b82f6'; // Blue
      case 'twitter': return '#1DA1F2';
      case 'blog': return '#10b981';
      case 'official': return '#7c3aed';
      default: return '#64748b';
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.primaryLight }]}>Hey {profile?.username}! 👋</Text>
          <View style={styles.themeToggle}>
            <Text style={[styles.themeLabel, { color: colors.textSecondary }]}>
              {theme === 'dark' ? '🌙' : '☀️'}
            </Text>
            <Switch
              value={theme === 'light'}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={theme === 'light' ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Username Setup Prompt - Slide-out Banner */}
        {showUsernamePrompt && (
          <Animated.View 
            style={[
              styles.usernamePromptBanner,
              { 
                backgroundColor: colors.primary,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.usernamePromptContent}>
              <Text style={styles.usernamePromptIcon}>👤</Text>
              <View style={styles.usernamePromptTextContainer}>
                <Text style={styles.usernamePromptTitle}>Set Your Username</Text>
                <Text style={styles.usernamePromptSubtitle}>
                  Choose a username in Profile Settings
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  handleCloseUsernamePrompt();
                  router.push('/profile');
                }}
                style={styles.usernamePromptButton}
              >
                <Text style={styles.usernamePromptButtonText}>Go →</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Leagues Carousel */}
        <View style={styles.carouselSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 12}
            decelerationRate="fast"
            contentContainerStyle={styles.carouselContent}
          >
            {leagues?.map((league) => {
              const getLeagueTypeLabel = () => {
                if (league.league_type === 'season') {
                  if (league.min_player_rating) {
                    return `Season (${league.min_player_rating}+)`;
                  }
                  return 'Season';
                }
                return 'Tournament';
              };
              
              return (
                <TouchableOpacity
                  key={league.id}
                  style={[styles.leagueCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                  onPress={() => router.push(`/league/${league.id}?from=home`)}
                >
                  <Image
                    source={getEmblemForLeague(league.id)}
                    style={styles.leagueEmblem}
                    resizeMode="contain"
                  />
                  <View style={styles.leagueInfo}>
                    <Text style={[styles.leagueName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                      {league.name}
                    </Text>
                    <View style={styles.membersRow}>
                      <Image
                        source={require('@/assets/images/fantasy pawns/15.png')}
                        style={styles.membersIcon}
                        tintColor={colors.textSecondary}
                      />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>{league.max_members} members</Text>
                    </View>
                  </View>
                  <View style={[styles.leagueTypeBadge, { borderColor: colors.primary }]}>
                    <Text style={[styles.leagueTypeText, { color: colors.text }]}>{getLeagueTypeLabel()}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            
            {/* Public Leagues Card */}
            <TouchableOpacity
              style={[styles.leagueCard, styles.publicLeaguesCard, { backgroundColor: colors.cardBackground, borderColor: colors.borderLight }]}
              onPress={() => router.push('/public-leagues?from=home')}
            >
              <Text style={styles.publicLeaguesIcon}>🌐</Text>
              <View style={styles.publicLeaguesCardInfo}>
                <Text style={[styles.publicLeaguesCardTitle, { color: colors.text }]}>Browse Public Leagues</Text>
                <Text style={[styles.publicLeaguesCardSubtitle, { color: colors.textSecondary }]}>Join community leagues</Text>
              </View>
              <Text style={[styles.publicLeaguesArrow, { color: colors.textTertiary }]}>›</Text>
            </TouchableOpacity>

            {/* Create League Card */}
            <TouchableOpacity
              style={[styles.leagueCard, styles.createLeagueCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => router.push('/create-league?from=home')}
            >
              <Text style={styles.createLeagueIcon}>+</Text>
              <Text style={styles.createLeagueText}>Create League</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Tournaments Section */}
        {tournaments && tournaments.length > 0 && (
          <View style={styles.tournamentsSection}>
            <TouchableOpacity
              style={[styles.tournamentsSectionHeader, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={() => setTournamentsExpanded(!tournamentsExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.headerLeft}>
                <Text style={[styles.tournamentsSectionTitle, { color: colors.text }]}>Tournaments</Text>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={[styles.filterBadge, { backgroundColor: colors.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setTournamentFilter(tournamentFilter === 'upcoming' ? 'ongoing' : 'upcoming');
                  }}
                >
                  <Text style={styles.filterBadgeText}>
                    {tournamentFilter === 'upcoming' ? 'Upcoming' : 'Ongoing'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.expandArrow, { color: colors.textSecondary }, tournamentsExpanded && styles.expandArrowRotated]}>
                  ›
                </Text>
              </View>
            </TouchableOpacity>
            
            {tournamentsExpanded && tournaments
              ?.filter((t) =>
                tournamentFilter === 'upcoming'
                  ? t.status === 'upcoming'
                  : t.status === 'active'
              )
              .map((tournament) => {
              const startDate = new Date(tournament.start_date);
              const endDate = new Date(tournament.end_date);
              const isActive = tournament.status === 'active';
              
              const formatTournamentDate = (date: Date) => {
                return date.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                });
              };

              const isUpcoming = tournament.status === 'upcoming';
              const isDraftable = isUpcoming && tournament.is_active;
              const CardWrapper = isActive ? TouchableOpacity : View;
              const cardProps = isActive
                ? {
                    onPress: () => router.push(`/(tabs)/feed?tournament_id=${tournament.id}`),
                    activeOpacity: 0.7,
                  }
                : {};

              // Calculate days until tournament starts
              const daysUntilStart = isUpcoming 
                ? Math.ceil((startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 0;
              
              // Determine countdown color based on days remaining
              const getCountdownColor = () => {
                if (daysUntilStart <= 2) return '#ef4444'; // Red - very close
                if (daysUntilStart <= 7) return '#f59e0b'; // Orange - medium
                return '#10b981'; // Green - far away
              };

              const getCountdownText = () => {
                if (daysUntilStart === 0) return 'Today';
                if (daysUntilStart === 1) return 'Tomorrow';
                return `${daysUntilStart}d`;
              };

              // Use icon_url from database
              const hasIcon = tournament.icon_url;

              return (
                <TouchableOpacity 
                  key={tournament.id}
                  onPress={() => router.push(`/tournament/${tournament.id}`)}
                  activeOpacity={0.7}
                >
                  <CardWrapper style={[styles.tournamentCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} {...cardProps}>
                    <View style={styles.tournamentHeader}>
                    <View style={styles.tournamentTitleRow}>
                      {hasIcon ? (
                        <Image
                          source={{ uri: tournament.icon_url }}
                          style={styles.tournamentLogo}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.tournamentIcon}>🏆</Text>
                      )}
                      <Text style={[styles.tournamentName, { color: colors.text }]} numberOfLines={2}>
                        {tournament.name}
                      </Text>
                    </View>
                    <View style={styles.badgeContainer}>
                      {isActive && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>LIVE</Text>
                        </View>
                      )}
                      {isUpcoming && (
                        <View style={[styles.countdownBadge, { backgroundColor: getCountdownColor() }]}>
                          <Text style={styles.countdownText}>{getCountdownText()}</Text>
                        </View>
                      )}
                      {isDraftable && (
                        <TouchableOpacity
                          style={styles.draftButton}
                          onPress={() => router.push('/(tabs)/leagues')}
                        >
                          <Text style={styles.draftButtonText}>Draft Now</Text>
                          <Text style={styles.draftButtonArrow}>→</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.tournamentDetails}>
                    <View style={styles.tournamentDetailRow}>
                      <Text style={styles.tournamentDetailIcon}>📅</Text>
                      <Text style={[styles.tournamentDetailText, { color: colors.textSecondary }]}>
                        {formatTournamentDate(startDate)} - {formatTournamentDate(endDate)}
                      </Text>
                    </View>
                    
                    {tournament.location && (
                      <View style={styles.tournamentDetailRow}>
                        <Text style={styles.tournamentDetailIcon}>📍</Text>
                        <Text style={[styles.tournamentDetailText, { color: colors.textSecondary }]}>{tournament.location}</Text>
                      </View>
                    )}
                    
                    {tournament.time_control && (
                      <View style={styles.tournamentDetailRow}>
                        <Text style={styles.tournamentDetailIcon}>⏱️</Text>
                        <Text style={[styles.tournamentDetailText, { color: colors.textSecondary }]}>
                          {tournament.time_control.charAt(0).toUpperCase() + tournament.time_control.slice(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                </CardWrapper>
              </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Feed Section */}
        <View style={styles.feedSection}>
          {newsLoading ? (
            <SkeletonLoader type="card" count={3} />
          ) : newsPosts?.map((post, index) => (
            <View key={post.id} style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.sourceBadge, { backgroundColor: getSourceColor(post.source) }]}>
                  <Text style={styles.sourceBadgeText}>
                    {post.source}
                  </Text>
                </View>
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formatDate(post.published_at)}</Text>
              </View>
              
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {(() => {
                  // Clean title by taking only the first occurrence if duplicated
                  const titleParts = post.title.split(/\n\s*\n/); // Split by double newlines
                  const uniqueTitle = titleParts[0].trim();
                  return uniqueTitle;
                })()}
              </Text>
              <Text style={[styles.cardText, { color: colors.textSecondary }]}>
                {(() => {
                  let content = post.content;
                  // Get the cleaned title
                  const titleParts = post.title.split(/\n\s*\n/);
                  const cleanTitle = titleParts[0].trim();
                  const escapedTitle = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  
                  // Remove ALL occurrences of the title (handles duplicates with paragraph breaks)
                  content = content.replace(new RegExp(`\\s*${escapedTitle}\\s*`, 'gi'), ' ');
                  
                  // Clean up multiple spaces and trim
                  content = content.replace(/\s+/g, ' ').trim();
                  
                  return content;
                })()}
              </Text>
              
              {post.link && (
                <TouchableOpacity 
                  style={styles.linkButton}
                  onPress={() => post.link && WebBrowser.openBrowserAsync(post.link)}
                >
                  <Text style={[styles.linkText, { color: colors.primary }]}>Read more →</Text>
                </TouchableOpacity>
              )}

              {/* Reactions Bar - Show all reactions in a line */}
              <View style={styles.reactionsRow}>
                {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => {
                  const count = post.reaction_counts?.[type] || 0;
                  const isActive = post.user_reaction === type;
                  
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.reactionButton, 
                        { backgroundColor: isActive ? colors.primary : colors.cardBackground },
                        isActive && styles.reactionButtonActive
                      ]}
                      onPress={() => handleReaction(post.id, type)}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                      {count > 0 && (
                        <Text style={[
                          styles.reactionCount, 
                          { color: isActive ? '#fff' : colors.textSecondary },
                          isActive && styles.reactionCountActive
                        ]}>
                          {count}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Comments Button */}
              <TouchableOpacity 
                style={styles.commentsButton}
                onPress={() => openComments(post)}
              >
                <Text style={styles.engagementIcon}>💬</Text>
                <Text style={[styles.engagementText, { color: colors.textSecondary }]}>{post.comment_count || 0} comments</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Comments Modal */}
        <Modal
          visible={selectedPost !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedPost(null)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Comments</Text>
                <TouchableOpacity onPress={() => setSelectedPost(null)}>
                  <Text style={[styles.closeButton, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.commentsContainer}
              >
                {commentsLoading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <View key={i} style={[styles.commentCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View style={styles.commentHeader}>
                          <View style={[styles.skeletonBox, { width: 100, height: 16, backgroundColor: colors.border }]} />
                          <View style={[styles.skeletonBox, { width: 60, height: 12, backgroundColor: colors.border }]} />
                        </View>
                        <View style={[styles.skeletonBox, { width: '100%', height: 40, marginTop: 8, backgroundColor: colors.border }]} />
                      </View>
                    ))}
                  </>
                ) : comments.length > 0 ? (
                  comments.map((comment) => (
                    <View key={comment.id} style={[styles.commentCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                      <View style={styles.commentHeader}>
                        <Text style={[styles.commentUsername, { color: colors.primary }]}>@{comment.user.username}</Text>
                        <Text style={[styles.commentDate, { color: colors.textSecondary }]}>{formatDate(comment.created_at)}</Text>
                      </View>
                      <Text style={[styles.commentContent, { color: colors.text }]}>{comment.content}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyCommentsContainer}>
                    <Text style={[styles.emptyCommentsText, { color: colors.textSecondary }]}>No comments yet. Be the first to comment!</Text>
                  </View>
                )}
              </ScrollView>

              <View style={[styles.commentInputContainer, { backgroundColor: colors.cardBackground, borderTopColor: colors.border }]}>
                <TextInput
                  ref={commentInputRef}
                  style={[styles.commentInputFullWidth, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  placeholder="Write a comment..."
                  placeholderTextColor={colors.textTertiary}
                  value={newComment}
                  onChangeText={setNewComment}
                  maxLength={500}
                  keyboardAppearance={colors.background === '#0f172a' ? 'dark' : 'light'}
                  returnKeyType="send"
                  enablesReturnKeyAutomatically={true}
                  blurOnSubmit={false}
                  onSubmitEditing={postComment}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    color: '#93c5fd',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeLabel: {
    fontSize: 18,
  },
  carouselSection: {
    marginBottom: 32,
  },
  carouselContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  leagueCard: {
    width: CARD_WIDTH,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueEmblem: {
    width: 60,
    height: 60,
    marginRight: 8,
    marginLeft: -8,
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
    marginTop: 4,
  },
  leagueDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: -4,
  },
  membersIcon: {
    width: 32,
    height: 32,
    marginRight: -4,
  },
  detailText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  leagueTypeBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leagueTypeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  publicLeaguesCard: {
    backgroundColor: '#334155',
    borderColor: '#475569',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  publicLeaguesIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  publicLeaguesCardInfo: {
    flex: 1,
  },
  publicLeaguesCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  publicLeaguesCardSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  publicLeaguesArrow: {
    fontSize: 24,
    color: '#64748b',
    marginLeft: 8,
  },
  createLeagueCard: {
    backgroundColor: '#7c3aed',
    borderColor: '#a78bfa',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  createLeagueIcon: {
    fontSize: 40,
    color: '#fff',
    fontWeight: '300',
    marginBottom: 4,
  },
  createLeagueText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  feedSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featuredCard: {
    backgroundColor: '#7c3aed',
    borderColor: '#a78bfa',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  featuredBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sourceBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 8,
  },
  linkText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
  },
  reactionsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 6,
    flexWrap: 'wrap',
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  reactionButtonActive: {
    backgroundColor: '#2563eb',
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  reactionCountActive: {
    color: '#fff',
  },
  commentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  engagementIcon: {
    fontSize: 18,
  },
  engagementText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    fontSize: 24,
    color: '#94a3b8',
    fontWeight: '300',
  },
  commentsContainer: {
    flex: 1,
    padding: 16,
  },
  commentCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#60a5fa',
  },
  commentDate: {
    fontSize: 12,
    color: '#64748b',
  },
  commentContent: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentLikeIcon: {
    fontSize: 16,
  },
  commentLikeText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    maxHeight: 100,
  },
  commentInputFullWidth: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    minHeight: 44,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  // Tournament styles
  tournamentsSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  tournamentsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  headerLeft: {
    justifyContent: 'center',
  },
  tournamentsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Montserrat-Bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  expandArrow: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#94a3b8',
    transform: [{ rotate: '0deg' }],
  },
  expandArrowRotated: {
    transform: [{ rotate: '90deg' }],
  },
  tournamentCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tournamentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  tournamentIcon: {
    fontSize: 24,
  },
  tournamentLogoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  tournamentLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  badgeContainer: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  activeBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  draftButtonContainer: {
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 8,
  },
  draftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 2,
  },
  draftButtonText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  draftButtonArrow: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  countdownBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 50,
  },
  countdownText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  tournamentDetails: {
    gap: 4,
  },
  tournamentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tournamentDetailRowWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  tournamentDetailIcon: {
    fontSize: 14,
  },
  tournamentDetailText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  usernamePromptBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  usernamePromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  usernamePromptIcon: {
    fontSize: 24,
  },
  usernamePromptTextContainer: {
    flex: 1,
  },
  usernamePromptTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  usernamePromptSubtitle: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
  },
  usernamePromptButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  usernamePromptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  skeletonBox: {
    borderRadius: 6,
    opacity: 0.5,
  },
  emptyCommentsContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCommentsText: {
    fontSize: 14,
    textAlign: 'center',
  },
  hybridModalContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  transparentOverlay: {
    flex: 0.2,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContentSolid: {
    flex: 0.8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
