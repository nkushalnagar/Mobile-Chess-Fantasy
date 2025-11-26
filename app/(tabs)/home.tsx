import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Image, TextInput, Modal, ActivityIndicator, Linking } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

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
  like: '👍',
  love: '❤️',
  fire: '🔥',
  thinking: '🤔',
  celebrate: '🎉',
  sad: '😢',
};

export default function HomeTab() {
  const { profile } = useAuth();
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showReactions, setShowReactions] = useState<string | null>(null);

  useEffect(() => {
    fetchLeagues();
    fetchNewsPosts();
  }, [profile]);

  const fetchLeagues = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
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

  const fetchNewsPosts = async () => {
    try {
      // Calculate date 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const { data: posts, error } = await supabase
        .from('news_posts')
        .select('*')
        .gte('published_at', twoDaysAgo.toISOString());

      if (error) throw error;

      // Primary sort: by published_at (newest first), then by engagement
      const sortedByDateAndEngagement = (posts || []).slice().sort((a: any, b: any) => {
        const dateA = new Date(a.published_at).getTime();
        const dateB = new Date(b.published_at).getTime();
        if (dateA !== dateB) {
          return dateB - dateA; // Newest first
        }

        const engagementA = (a.reaction_count || 0) + (a.comment_count || 0);
        const engagementB = (b.reaction_count || 0) + (b.comment_count || 0);
        if (engagementA !== engagementB) {
          return engagementB - engagementA; // Higher engagement first
        }

        return 0;
      });

      // Tertiary preference: alternate between sources while mostly preserving sorted order
      const alternatedPosts: any[] = [];
      const remaining = [...sortedByDateAndEngagement];
      let lastSource: string | null = null;

      while (remaining.length > 0) {
        let indexToTake = 0;

        if (lastSource) {
          const altIndex = remaining.findIndex(p => p.source !== lastSource);
          if (altIndex !== -1) {
            indexToTake = altIndex;
          }
        }

        const [next] = remaining.splice(indexToTake, 1);
        alternatedPosts.push(next);
        lastSource = next?.source || null;
      }

      const finalPosts = alternatedPosts;

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
    }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    if (!profile?.id) return;

    try {
      const post = newsPosts.find(p => p.id === postId);
      
      if (post?.user_reaction === reactionType) {
        // Remove reaction if clicking the same one
        await supabase
          .from('news_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', profile.id);
      } else {
        // Upsert will update if exists or insert if new
        await supabase
          .from('news_reactions')
          .upsert({
            post_id: postId,
            user_id: profile.id,
            reaction_type: reactionType,
          }, {
            onConflict: 'post_id,user_id'
          });
      }

      fetchNewsPosts();
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  const openComments = async (post: NewsPost) => {
    setSelectedPost(post);
    
    try {
      const { data: commentsData, error } = await supabase
        .from('news_comments')
        .select(`
          id,
          content,
          created_at,
          like_count,
          user_id
        `)
        .eq('post_id', post.id)
        .is('parent_comment_id', null)
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
    }
  };

  const postComment = async () => {
    if (!profile?.id || !selectedPost || !newComment.trim()) return;

    try {
      await supabase
        .from('news_comments')
        .insert({
          post_id: selectedPost.id,
          user_id: profile.id,
          content: newComment.trim(),
        });

      setNewComment('');
      openComments(selectedPost);
      fetchNewsPosts();
    } catch (error) {
      console.error('Error posting comment:', error);
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
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.greeting}>Hey {profile?.username}! 👋</Text>

        {/* Leagues Carousel */}
        <View style={styles.carouselSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 12}
            decelerationRate="fast"
            contentContainerStyle={styles.carouselContent}
          >
            {leagues.map((league) => {
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
                  style={styles.leagueCard}
                  onPress={() => router.push(`/league/${league.id}`)}
                >
                  <Image
                    source={getEmblemForLeague(league.id)}
                    style={styles.leagueEmblem}
                    resizeMode="contain"
                  />
                  <View style={styles.leagueInfo}>
                    <Text style={styles.leagueName} numberOfLines={1} ellipsizeMode="tail">
                      {league.name}
                    </Text>
                    <View style={styles.membersRow}>
                      <Image
                        source={require('@/assets/images/fantasy pawns/15.png')}
                        style={styles.membersIcon}
                        tintColor="#94a3b8"
                      />
                      <Text style={styles.detailText}>{league.max_members} members</Text>
                    </View>
                  </View>
                  <View style={styles.leagueTypeBadge}>
                    <Text style={styles.leagueTypeText}>{getLeagueTypeLabel()}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            
            {/* Create League Card */}
            <TouchableOpacity
              style={[styles.leagueCard, styles.createLeagueCard]}
              onPress={() => router.push('/create-league')}
            >
              <Text style={styles.createLeagueIcon}>+</Text>
              <Text style={styles.createLeagueText}>Create League</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Feed Section */}
        <View style={styles.feedSection}>
          {newsPosts.map((post, index) => (
            <View key={post.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.sourceBadge, { backgroundColor: getSourceColor(post.source) }]}>
                  <Text style={styles.sourceBadgeText}>
                    {post.source}
                  </Text>
                </View>
                <Text style={styles.dateText}>{formatDate(post.published_at)}</Text>
              </View>
              
              <Text style={styles.cardTitle}>
                {(() => {
                  // Clean title by taking only the first occurrence if duplicated
                  const titleParts = post.title.split(/\n\s*\n/); // Split by double newlines
                  const uniqueTitle = titleParts[0].trim();
                  return uniqueTitle;
                })()}
              </Text>
              <Text style={styles.cardText}>
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
                  onPress={() => post.link && Linking.openURL(post.link)}
                >
                  <Text style={styles.linkText}>Read more →</Text>
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
                      style={[styles.reactionButton, isActive && styles.reactionButtonActive]}
                      onPress={() => handleReaction(post.id, type)}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                      {count > 0 && (
                        <Text style={[styles.reactionCount, isActive && styles.reactionCountActive]}>
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
                <Text style={styles.engagementText}>{post.comment_count} comments</Text>
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
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Comments</Text>
                <TouchableOpacity onPress={() => setSelectedPost(null)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.commentsContainer}>
                {comments.map((comment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentUsername}>@{comment.user.username}</Text>
                      <Text style={styles.commentDate}>{formatDate(comment.created_at)}</Text>
                    </View>
                    <Text style={styles.commentContent}>{comment.content}</Text>
                    <TouchableOpacity 
                      style={styles.commentLikeButton}
                      onPress={() => toggleCommentLike(comment.id)}
                    >
                      <Text style={styles.commentLikeIcon}>
                        {comment.user_liked ? '❤️' : '🤍'}
                      </Text>
                      <Text style={styles.commentLikeText}>{comment.like_count}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.commentInputContainer}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Write a comment..."
                  placeholderTextColor="#64748b"
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                />
                <TouchableOpacity 
                  style={styles.sendButton}
                  onPress={postComment}
                  disabled={!newComment.trim()}
                >
                  <Text style={styles.sendButtonText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    color: '#93c5fd',
    marginBottom: 20,
    paddingHorizontal: 20,
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
    backgroundColor: '#1e293b',
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
    maxHeight: '80%',
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
    maxHeight: 400,
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
    borderTopColor: '#334155',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
