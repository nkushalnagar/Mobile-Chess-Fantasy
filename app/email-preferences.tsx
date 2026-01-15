import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

interface EmailPreferences {
  weekly_digest: boolean;
  league_invites: boolean;
  tournament_updates: boolean;
  trade_notifications: boolean;
}

export default function EmailPreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<EmailPreferences>({
    weekly_digest: true,
    league_invites: true,
    tournament_updates: true,
    trade_notifications: true,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email_preferences')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.email_preferences) {
        setPreferences(data.email_preferences as EmailPreferences);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Error', 'Failed to load email preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ email_preferences: preferences })
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert('Success', 'Email preferences updated');
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (key: keyof EmailPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Email Preferences</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Email Preferences</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Choose which email notifications you'd like to receive
        </Text>

        <View style={styles.section}>
          <View style={[styles.preferenceItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceTitle, { color: colors.text }]}>📊 Weekly Digest</Text>
              <Text style={[styles.preferenceDescription, { color: colors.textSecondary }]}>
                Get a weekly summary of your fantasy performance, including points earned, rank changes, and top performers
              </Text>
            </View>
            <Switch
              value={preferences.weekly_digest}
              onValueChange={() => togglePreference('weekly_digest')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={preferences.weekly_digest ? colors.primary : colors.textTertiary}
            />
          </View>

          <View style={[styles.preferenceItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceTitle, { color: colors.text }]}>📨 League Invites</Text>
              <Text style={[styles.preferenceDescription, { color: colors.textSecondary }]}>
                Receive emails when someone invites you to join their league
              </Text>
            </View>
            <Switch
              value={preferences.league_invites}
              onValueChange={() => togglePreference('league_invites')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={preferences.league_invites ? colors.primary : colors.textTertiary}
            />
          </View>

          <View style={[styles.preferenceItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceTitle, { color: colors.text }]}>🏆 Tournament Updates</Text>
              <Text style={[styles.preferenceDescription, { color: colors.textSecondary }]}>
                Get notified when tournaments start or important tournament events occur
              </Text>
            </View>
            <Switch
              value={preferences.tournament_updates}
              onValueChange={() => togglePreference('tournament_updates')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={preferences.tournament_updates ? colors.primary : colors.textTertiary}
            />
          </View>

          <View style={[styles.preferenceItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceTitle, { color: colors.text }]}>🔄 Trade Notifications</Text>
              <Text style={[styles.preferenceDescription, { color: colors.textSecondary }]}>
                Receive emails about trade requests, acceptances, and rejections
              </Text>
            </View>
            <Switch
              value={preferences.trade_notifications}
              onValueChange={() => togglePreference('trade_notifications')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={preferences.trade_notifications ? colors.primary : colors.textTertiary}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.saveButtonDisabled]}
          onPress={savePreferences}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.note, { color: colors.textSecondary }]}>
          Note: You'll still receive important account-related emails regardless of these settings
        </Text>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
    fontSize: 28,
    color: '#fff',
    fontFamily: 'Montserrat-SemiBold',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat-SemiBold',
    color: '#fff',
  },
  placeholder: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 14,
    color: '#94a3b8',
    fontFamily: 'Montserrat-Regular',
    marginTop: 20,
    marginBottom: 24,
    lineHeight: 20,
  },
  section: {
    gap: 16,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat-SemiBold',
    color: '#fff',
    marginBottom: 6,
  },
  preferenceDescription: {
    fontSize: 13,
    fontFamily: 'Montserrat-Regular',
    color: '#94a3b8',
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat-SemiBold',
    color: '#fff',
  },
  note: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'Montserrat-Regular',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
  bottomPadding: {
    height: 40,
  },
});
