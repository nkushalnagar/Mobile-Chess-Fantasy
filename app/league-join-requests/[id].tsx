import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface JoinRequest {
  id: string;
  league_id: string;
  user_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  username: string;
}

export default function LeagueJoinRequestsScreen() {
  const router = useRouter();
  const { id, returnTab } = useLocalSearchParams();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchJoinRequests();
    }
  }, [id]);

  const fetchJoinRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('league_join_requests')
        .select(`
          *,
          profiles!league_join_requests_user_id_fkey(username)
        `)
        .eq('league_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const requestsWithUsernames = (data || []).map(request => ({
        ...request,
        username: request.profiles?.username || 'Unknown'
      }));

      setRequests(requestsWithUsernames);
    } catch (error) {
      console.error('Error fetching join requests:', error);
      Alert.alert('Error', 'Failed to load join requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string, userId: string) => {
    try {
      setProcessing(requestId);

      // 1. Update request status
      const { error: updateError } = await supabase
        .from('league_join_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // 2. Add user to league (team will be auto-created by trigger)
      const { error: membershipError } = await supabase
        .from('league_memberships')
        .insert({
          league_id: id,
          user_id: userId,
          role: 'member'
        });

      if (membershipError) throw membershipError;

      Alert.alert('Success', 'User has been added to the league!');
      fetchJoinRequests();
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept join request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setProcessing(requestId);

      const { error } = await supabase
        .from('league_join_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert('Request Rejected', 'The join request has been rejected');
      fetchJoinRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('Error', 'Failed to reject join request');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'accepted': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#64748b';
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity 
            onPress={() => router.push(`/league/${id}?tab=teams`)} 
            style={styles.backButton}
          >
            <Text style={[styles.backButtonText, { color: colors.primary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Join Requests</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyStateText, { color: colors.text }]}>No join requests</Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                Join requests will appear here when users request to join your league
              </Text>
            </View>
          ) : (
            requests.map((request) => (
              <View key={request.id} style={[styles.requestCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestInfo}>
                    <Text style={[styles.username, { color: colors.text }]}>@{request.username}</Text>
                    <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(request.created_at)}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(request.status) + '20' }
                  ]}>
                    <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.messageContainer, { backgroundColor: colors.background }]}>
                  <Text style={[styles.messageLabel, { color: colors.textSecondary }]}>Message:</Text>
                  <Text style={[styles.messageText, { color: colors.text }]}>{request.message}</Text>
                </View>

                {request.status === 'pending' && (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton, { backgroundColor: colors.border }]}
                      onPress={() => handleReject(request.id)}
                      disabled={processing === request.id}
                    >
                      <Text style={styles.actionButtonText}>
                        {processing === request.id ? 'Processing...' : 'Reject'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.acceptButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleAccept(request.id, request.user_id)}
                      disabled={processing === request.id}
                    >
                      <Text style={styles.actionButtonText}>
                        {processing === request.id ? 'Processing...' : 'Accept'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  requestCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageContainer: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButton: {
  },
  acceptButton: {
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
