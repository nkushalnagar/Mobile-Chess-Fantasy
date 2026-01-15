import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (token) {
      loadInviteDetails();
    }
  }, [token]);

  const loadInviteDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('email_invites')
        .select(`
          *,
          leagues:league_id (
            id,
            name,
            is_public
          ),
          profiles:inviter_id (
            username
          )
        `)
        .eq('invite_token', token)
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        Alert.alert('Error', 'Invite not found or has expired');
        router.replace('/');
        return;
      }

      // Check if invite is expired
      if (new Date(data.expires_at) < new Date()) {
        Alert.alert('Error', 'This invite has expired');
        router.replace('/');
        return;
      }

      setInviteData(data);
    } catch (error) {
      console.error('Error loading invite:', error);
      Alert.alert('Error', 'Failed to load invite details');
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!user) {
      // User needs to sign up/login first
      Alert.alert(
        'Account Required',
        'You need to create an account or sign in to accept this invite.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Up',
            onPress: () => router.push(`/signup?invite_token=${token}`),
          },
        ]
      );
      return;
    }

    setAccepting(true);

    try {
      const { data, error } = await supabase.rpc('accept_email_invite', {
        p_invite_token: token,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (!data.success) {
        Alert.alert('Error', data.error || 'Failed to accept invite');
        return;
      }

      Alert.alert(
        'Success!',
        `You've joined ${data.league_name}!`,
        [
          {
            text: 'View League',
            onPress: () => router.replace(`/league/${data.league_id}`),
          },
        ]
      );
    } catch (error) {
      console.error('Error accepting invite:', error);
      Alert.alert('Error', 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Invite',
      'Are you sure you want to decline this invite?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => router.replace('/'),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#60a5fa" />
        <Text style={styles.loadingText}>Loading invite...</Text>
      </View>
    );
  }

  if (!inviteData) {
    return null;
  }

  const expiresAt = new Date(inviteData.expires_at);
  const daysUntilExpiry = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🏆</Text>
        <Text style={styles.title}>League Invite</Text>
        
        <View style={styles.inviteCard}>
          <Text style={styles.inviteText}>
            <Text style={styles.bold}>{inviteData.profiles?.username || 'Someone'}</Text>
            {' '}invited you to join
          </Text>
          <Text style={styles.leagueName}>{inviteData.leagues?.name}</Text>
          
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type:</Text>
              <Text style={styles.detailValue}>
                {inviteData.leagues?.is_public ? 'Public' : 'Private'} League
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expires:</Text>
              <Text style={styles.detailValue}>
                {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'}
              </Text>
            </View>
          </View>
        </View>

        {!user && (
          <View style={styles.signupPrompt}>
            <Text style={styles.signupText}>
              You'll need to create an account or sign in to accept this invite.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.acceptButton, accepting && styles.buttonDisabled]}
          onPress={handleAcceptInvite}
          disabled={accepting}
        >
          {accepting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.acceptButtonText}>
              {user ? 'Accept Invite' : 'Sign Up & Accept'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.declineButton}
          onPress={handleDecline}
          disabled={accepting}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94a3b8',
    fontFamily: 'Montserrat-Regular',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
    marginBottom: 24,
  },
  inviteCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inviteText: {
    fontSize: 16,
    color: '#cbd5e1',
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
    marginBottom: 12,
  },
  bold: {
    fontFamily: 'Montserrat-SemiBold',
    color: '#60a5fa',
  },
  leagueName: {
    fontSize: 24,
    fontFamily: 'Montserrat-Bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Montserrat-Regular',
  },
  detailValue: {
    fontSize: 14,
    color: '#e2e8f0',
    fontFamily: 'Montserrat-SemiBold',
  },
  signupPrompt: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  signupText: {
    fontSize: 14,
    color: '#93c5fd',
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  acceptButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  acceptButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat-SemiBold',
    color: '#fff',
  },
  declineButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  declineButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat-SemiBold',
    color: '#94a3b8',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
