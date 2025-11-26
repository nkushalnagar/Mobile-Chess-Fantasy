import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, Switch } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Slider from '@react-native-community/slider';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface League {
  id: string;
  name: string;
  max_members: number;
  picks_per_person: number;
  owner_id: string;
  status: string;
  draft_scheduled_time: string | null;
  created_at: string;
}

interface LeagueSettings {
  use_prestige_factor: boolean;
  rating_weight: number;
  sharpe_weight: number;
  color_weight: number;
  psychological_weight: number;
}

type SettingsTab = 'basic' | 'advanced';

export default function LeagueSettingsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');
  const [maxMembers, setMaxMembers] = useState('10');
  const [picksPerPerson, setPicksPerPerson] = useState('5');
  const [inviteUsername, setInviteUsername] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  
  // Advanced settings
  const [fantasySettings, setFantasySettings] = useState<LeagueSettings>({
    use_prestige_factor: true,
    rating_weight: 60,
    sharpe_weight: 30,
    color_weight: 6,
    psychological_weight: 4,
  });
  const [savingAdvanced, setSavingAdvanced] = useState(false);

  useEffect(() => {
    fetchLeagueSettings();
    fetchUserTeam();
    if (activeTab === 'advanced') {
      fetchFantasySettings();
    }
  }, [id, activeTab]);

  const fetchLeagueSettings = async () => {
    try {
      const { data: leagueData, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setLeague(leagueData);
      setMaxMembers(leagueData.max_members.toString());
      setPicksPerPerson(leagueData.picks_per_person.toString());
      setIsOwner(leagueData.owner_id === user?.id);
    } catch (error) {
      console.error('Error fetching league settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTeam = async () => {
    try {
      const { data: teamData, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('league_id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (teamData) {
        setTeamId(teamData.id);
        setTeamName(teamData.name);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const updateTeamName = async () => {
    if (!teamId || !teamName.trim()) {
      Alert.alert('Error', 'Please enter a team name');
      return;
    }

    try {
      console.log('Updating team name:', { teamId, newName: teamName.trim() });
      
      const { data, error } = await supabase
        .from('teams')
        .update({ name: teamName.trim() })
        .eq('id', teamId)
        .select();

      if (error) {
        console.error('Update error:', error);
        throw error;
      }

      console.log('Update response:', data);
      Alert.alert('Success', 'Team name updated!');
    } catch (error) {
      console.error('Error updating team name:', error);
      Alert.alert('Error', 'Failed to update team name');
    }
  };

  const fetchFantasySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('league_settings')
        .select('*')
        .eq('league_id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFantasySettings({
          use_prestige_factor: data.use_prestige_factor,
          rating_weight: data.rating_weight,
          sharpe_weight: data.sharpe_weight,
          color_weight: data.color_weight,
          psychological_weight: data.psychological_weight,
        });
      }
    } catch (error) {
      console.error('Error fetching fantasy settings:', error);
    }
  };

  const getTotalWeight = () => {
    return Math.round(
      fantasySettings.rating_weight +
      fantasySettings.sharpe_weight +
      fantasySettings.color_weight +
      fantasySettings.psychological_weight
    );
  };

  const isWeightValid = () => {
    return getTotalWeight() === 100;
  };

  const handleSaveAdvancedSettings = async () => {
    if (!isOwner) return;

    setSavingAdvanced(true);
    try {
      const { error } = await supabase
        .from('league_settings')
        .update({
          use_prestige_factor: fantasySettings.use_prestige_factor,
          rating_weight: fantasySettings.rating_weight,
          sharpe_weight: fantasySettings.sharpe_weight,
          color_weight: fantasySettings.color_weight,
          psychological_weight: fantasySettings.psychological_weight,
          updated_at: new Date().toISOString(),
        })
        .eq('league_id', id);

      if (error) throw error;

      Alert.alert('Success', 'Fantasy points settings updated');
      fetchFantasySettings();
    } catch (error) {
      console.error('Error updating advanced settings:', error);
      Alert.alert('Error', 'Failed to update fantasy points settings');
    } finally {
      setSavingAdvanced(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!isOwner) return;

    try {
      const { error } = await supabase
        .from('leagues')
        .update({
          max_members: parseInt(maxMembers),
          picks_per_person: parseInt(picksPerPerson),
        })
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Success', 'League settings updated');
      setIsEditing(false);
      fetchLeagueSettings();
    } catch (error) {
      console.error('Error updating settings:', error);
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const handleInviteUser = async () => {
    if (!inviteUsername.trim() || !user) return;

    try {
      // Check if user exists
      const { data: inviteeProfile, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', inviteUsername)
        .single();

      if (profileError || !inviteeProfile) {
        Alert.alert('Error', 'User not found');
        return;
      }

      // Check if already invited
      const { count } = await supabase
        .from('league_invites')
        .select('*', { count: 'exact' })
        .eq('league_id', id)
        .eq('invitee_username', inviteUsername)
        .eq('status', 'pending');

      if (count && count > 0) {
        Alert.alert('Error', 'User has already been invited');
        return;
      }

      // Send invite
      const { error: inviteError } = await supabase
        .from('league_invites')
        .insert({
          league_id: id,
          inviter_id: user.id,
          invitee_username: inviteUsername,
          status: 'pending',
        });

      if (inviteError) throw inviteError;

      Alert.alert('Success', `Invite sent to ${inviteUsername}`);
      setInviteUsername('');
    } catch (error) {
      console.error('Error inviting user:', error);
      Alert.alert('Error', 'Failed to send invite');
    }
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
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>League Settings</Text>
      </View>

      {/* Tabs */}
      {isOwner && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'basic' && styles.activeTab]}
            onPress={() => setActiveTab('basic')}
          >
            <Text style={[styles.tabText, activeTab === 'basic' && styles.activeTabText]}>
              Basic
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'advanced' && styles.activeTab]}
            onPress={() => setActiveTab('advanced')}
          >
            <Text style={[styles.tabText, activeTab === 'advanced' && styles.activeTabText]}>
              Advanced
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Team Name - All members can edit */}
      {activeTab === 'basic' && teamId && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Team</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Team Name</Text>
            <TextInput
              style={styles.input}
              value={teamName}
              onChangeText={setTeamName}
              placeholder="Enter team name"
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity
              style={styles.saveTeamButton}
              onPress={updateTeamName}
            >
              <Text style={styles.saveTeamButtonText}>Save Team Name</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* League Info - Only show on Basic tab */}
      {activeTab === 'basic' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>League Name:</Text>
              <Text style={styles.infoValue}>{league.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={styles.infoValue}>{league.status}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created:</Text>
              <Text style={styles.infoValue}>
                {new Date(league.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Basic Settings Tab */}
      {activeTab === 'basic' && isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>League Settings</Text>
          
          <View style={styles.settingsCard}>
            {/* Max Members Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Max Members</Text>
                <Text style={styles.sliderValue}>{Math.round(parseInt(maxMembers))}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={2}
                maximumValue={50}
                step={1}
                value={parseInt(maxMembers)}
                onValueChange={(value) => setMaxMembers(value.toString())}
                minimumTrackTintColor="#2563eb"
                maximumTrackTintColor="#334155"
                thumbTintColor="#2563eb"
              />
              <Text style={styles.sliderDescription}>
                Maximum number of members allowed in this league
              </Text>
            </View>

            {/* Picks Per Person Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Picks Per Person</Text>
                <Text style={styles.sliderValue}>{Math.round(parseInt(picksPerPerson))}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={20}
                step={1}
                value={parseInt(picksPerPerson)}
                onValueChange={(value) => setPicksPerPerson(value.toString())}
                minimumTrackTintColor="#2563eb"
                maximumTrackTintColor="#334155"
                thumbTintColor="#2563eb"
              />
              <Text style={styles.sliderDescription}>
                Number of players each member can draft
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSaveSettings}
            style={styles.saveAdvancedButton}
          >
            <Text style={styles.saveAdvancedButtonText}>
              Save League Settings
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Advanced Settings Tab */}
      {activeTab === 'advanced' && isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fantasy Points Settings</Text>

          {/* Prestige Factor Toggle */}
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>Use Prestige Factor</Text>
                <Text style={styles.settingDescription}>
                  Multiply points by tournament prize fund / 10,000
                </Text>
              </View>
              <Switch
                value={fantasySettings.use_prestige_factor}
                onValueChange={(value) =>
                  setFantasySettings({ ...fantasySettings, use_prestige_factor: value })
                }
                trackColor={{ false: '#334155', true: '#3b82f6' }}
                thumbColor={fantasySettings.use_prestige_factor ? '#2563eb' : '#64748b'}
              />
            </View>
          </View>

          {/* Weight Sliders */}
          <View style={[styles.settingsCard, styles.weightSlidersCard]}>
            <Text style={styles.subsectionTitle}>Game Factor Weights (out of 100)</Text>
            
            {/* Rating Weight */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Rating Change</Text>
                <Text style={styles.sliderValue}>{Math.round(fantasySettings.rating_weight)}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={fantasySettings.rating_weight}
                onValueChange={(value) =>
                  setFantasySettings({ ...fantasySettings, rating_weight: value })
                }
                minimumTrackTintColor="#2563eb"
                maximumTrackTintColor="#334155"
                thumbTintColor="#2563eb"
              />
              <Text style={styles.sliderDescription}>
                Points from rating gain/loss (upsets and performance)
              </Text>
            </View>

            {/* Sharpe Weight */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Game Quality</Text>
                <Text style={styles.sliderValue}>{Math.round(fantasySettings.sharpe_weight)}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={fantasySettings.sharpe_weight}
                onValueChange={(value) =>
                  setFantasySettings({ ...fantasySettings, sharpe_weight: value })
                }
                minimumTrackTintColor="#2563eb"
                maximumTrackTintColor="#334155"
                thumbTintColor="#2563eb"
              />
              <Text style={styles.sliderDescription}>
                Consistency and quality of moves throughout the game
              </Text>
            </View>

            {/* Color Weight */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Color Factor</Text>
                <Text style={styles.sliderValue}>{Math.round(fantasySettings.color_weight)}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={fantasySettings.color_weight}
                onValueChange={(value) =>
                  setFantasySettings({ ...fantasySettings, color_weight: value })
                }
                minimumTrackTintColor="#2563eb"
                maximumTrackTintColor="#334155"
                thumbTintColor="#2563eb"
              />
              <Text style={styles.sliderDescription}>
                Bonus for winning with black, penalty for losing with white
              </Text>
            </View>

            {/* Psychological Weight */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>Psychological Factor</Text>
                <Text style={styles.sliderValue}>{Math.round(fantasySettings.psychological_weight)}</Text>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={fantasySettings.psychological_weight}
                onValueChange={(value) =>
                  setFantasySettings({ ...fantasySettings, psychological_weight: value })
                }
                minimumTrackTintColor="#2563eb"
                maximumTrackTintColor="#334155"
                thumbTintColor="#2563eb"
              />
              <Text style={styles.sliderDescription}>
                Points based on performance vs recent form
              </Text>
            </View>

            {/* Total Weight Display */}
            <View style={styles.totalWeightContainer}>
              <Text style={styles.totalWeightLabel}>Total Weight:</Text>
              <Text style={[
                styles.totalWeightValue,
                !isWeightValid() && styles.totalWeightInvalid
              ]}>
                {getTotalWeight()} / 100
              </Text>
            </View>
            {!isWeightValid() && (
              <Text style={styles.weightWarning}>
                Total weight must equal 100 to save
              </Text>
            )}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSaveAdvancedSettings}
            style={[
              styles.saveAdvancedButton,
              (!isWeightValid() || savingAdvanced) && styles.saveAdvancedButtonDisabled
            ]}
            disabled={!isWeightValid() || savingAdvanced}
          >
            <Text style={styles.saveAdvancedButtonText}>
              {savingAdvanced ? 'Saving...' : 'Save Fantasy Points Settings'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Invite Users (Owner Only) */}
      {activeTab === 'basic' && isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite Users</Text>
          <View style={styles.inviteCard}>
            <TextInput
              style={styles.inviteInput}
              value={inviteUsername}
              onChangeText={setInviteUsername}
              placeholder="Enter username"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={handleInviteUser}
              style={styles.inviteButton}
              disabled={!inviteUsername.trim()}
            >
              <Text style={styles.inviteButtonText}>Send Invite</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Non-Owner View */}
      {!isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Settings</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Max Members:</Text>
              <Text style={styles.infoValue}>{league.max_members}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Picks Per Person:</Text>
              <Text style={styles.infoValue}>{league.picks_per_person}</Text>
            </View>
          </View>
          <Text style={styles.notOwnerText}>
            Only the league owner can modify settings
          </Text>
        </View>
      )}
      </ScrollView>
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
  backButton: {
    padding: 8,
    marginBottom: 8,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    color: '#94a3b8',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  editButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#64748b',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  weightSlidersCard: {
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    color: '#94a3b8',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  settingInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 16,
    minWidth: 80,
    textAlign: 'right',
  },
  inviteCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  inviteInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
  },
  inviteButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notOwnerText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
  },
  // Tab styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
  activeTabText: {
    color: '#fff',
  },
  // Advanced settings styles
  infoBox: {
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoBoxText: {
    fontSize: 14,
    color: '#93c5fd',
    lineHeight: 20,
  },
  settingLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingDescription: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  sliderContainer: {
    marginBottom: 24,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderDescription: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  totalWeightContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  totalWeightLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
  totalWeightValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  totalWeightInvalid: {
    color: '#ef4444',
  },
  weightWarning: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 8,
  },
  saveAdvancedButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveAdvancedButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  saveAdvancedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  saveTeamButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveTeamButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
