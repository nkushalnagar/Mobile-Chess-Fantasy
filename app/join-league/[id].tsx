import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface League {
  id: string;
  name: string;
  league_type: string;
  max_members: number;
  member_count: number;
  owner_username: string;
}

export default function JoinLeagueScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user, profile } = useAuth();
  const { colors } = useTheme();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchLeagueInfo();
      checkExistingRequest();
    }
  }, [id]);

  const fetchLeagueInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select(`
          *,
          league_memberships(count),
          profiles!leagues_owner_id_fkey(username)
        `)
        .eq('id', id)
        .eq('is_public', true)
        .single();

      if (error) throw error;

      setLeague({
        ...data,
        member_count: data.league_memberships?.[0]?.count || 0,
        owner_username: data.profiles?.username || 'Unknown'
      });
    } catch (error) {
      console.error('Error fetching league:', error);
      Alert.alert('Error', 'Failed to load league information');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const checkExistingRequest = async () => {
    try {
      const { data, error } = await supabase
        .from('league_join_requests')
        .select('*')
        .eq('league_id', id)
        .eq('user_id', user?.id)
        .single();

      if (data) {
        setExistingRequest(data);
      }
    } catch (error) {
      // No existing request, which is fine
    }
  };

  const handleSubmitRequest = async () => {
    if (!message.trim()) {
      Alert.alert('Error', 'Please explain why you want to join this league');
      return;
    }

    if (!user || !league) return;

    // Check if league is full
    if (league.member_count >= league.max_members) {
      Alert.alert('League Full', 'This league has reached its maximum number of members');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('league_join_requests')
        .insert({
          league_id: id,
          user_id: user.id,
          message: message.trim(),
          status: 'pending'
        });

      if (error) throw error;

      Alert.alert(
        'Request Sent!',
        'Your join request has been sent to the league owner. You\'ll be notified when they respond.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error submitting join request:', error);
      if (error.code === '23505') {
        Alert.alert('Already Requested', 'You have already submitted a join request for this league');
      } else {
        Alert.alert('Error', 'Failed to submit join request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!league) {
    return null;
  }

  if (existingRequest) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={[styles.backButtonText, { color: colors.primary }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Join Request</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.content}>
            <View style={[styles.statusCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>Request Status</Text>
              <View style={[
                styles.statusBadge,
                existingRequest.status === 'pending' && styles.statusPending,
                existingRequest.status === 'accepted' && styles.statusAccepted,
                existingRequest.status === 'rejected' && styles.statusRejected,
              ]}>
                <Text style={styles.statusText}>
                  {existingRequest.status.charAt(0).toUpperCase() + existingRequest.status.slice(1)}
                </Text>
              </View>
              <Text style={[styles.statusMessage, { color: colors.textSecondary }]}>
                {existingRequest.status === 'pending' && 'Your request is awaiting review by the league owner.'}
                {existingRequest.status === 'accepted' && 'Your request has been accepted! You can now access the league.'}
                {existingRequest.status === 'rejected' && 'Your request was not accepted at this time.'}
              </Text>
              {existingRequest.status === 'accepted' && (
                <TouchableOpacity
                  style={[styles.goToLeagueButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push(`/league/${id}`)}
                >
                  <Text style={styles.goToLeagueButtonText}>Go to League</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.primary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Join League</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={[styles.leagueInfo, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.leagueName, { color: colors.text }]}>{league.name}</Text>
            <Text style={[styles.leagueOwner, { color: colors.textSecondary }]}>Owned by @{league.owner_username}</Text>
            <View style={styles.leagueStats}>
              <Text style={[styles.leagueStat, { color: colors.textSecondary }]}>
                {league.member_count}/{league.max_members} members
              </Text>
              <Text style={[styles.leagueStat, { color: colors.textSecondary }]}>•</Text>
              <Text style={[styles.leagueStat, { color: colors.textSecondary }]}>
                {league.league_type === 'season' ? 'Season' : 'Tournament'}
              </Text>
            </View>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>Why do you want to join this league?</Text>
            <Text style={[styles.helpText, { color: colors.textSecondary }]}>
              Tell the league owner why you'd be a great addition to their league
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
              value={message}
              onChangeText={setMessage}
              placeholder="I'm an active player who loves chess and would contribute to the league..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.primary }, (!message.trim() || submitting) && [styles.submitButtonDisabled, { backgroundColor: colors.border }]]}
              onPress={handleSubmitRequest}
              disabled={!message.trim() || submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Sending Request...' : 'Send Join Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  leagueInfo: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
  },
  leagueName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  leagueOwner: {
    fontSize: 16,
    marginBottom: 12,
  },
  leagueStats: {
    flexDirection: 'row',
    gap: 8,
  },
  leagueStat: {
    fontSize: 14,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusPending: {
    backgroundColor: '#f59e0b20',
  },
  statusAccepted: {
    backgroundColor: '#10b98120',
  },
  statusRejected: {
    backgroundColor: '#ef444420',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f59e0b',
  },
  statusMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  goToLeagueButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  goToLeagueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
