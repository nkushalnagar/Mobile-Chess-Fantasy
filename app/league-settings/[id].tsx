import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, Switch, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import NumberStepper from '@/components/NumberStepper';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface League {
  id: string;
  name: string;
  max_members: number;
  picks_per_person: number;
  owner_id: string;
  status: string;
  draft_scheduled_time: string | null;
  created_at: string;
  is_public?: boolean;
}

interface LeagueSettings {
  use_prestige_factor: boolean;
  rating_weight: number;
  sharpe_weight: number;
  color_weight: number;
  psychological_weight: number;
}

type SettingsTab = 'basic' | 'advanced';

interface LeagueSettingsProps {
  leagueId?: string;
  onClose?: () => void;
}

export default function LeagueSettingsScreen({ leagueId, onClose }: LeagueSettingsProps = {}) {
  const params = useLocalSearchParams();
  const id = leagueId || params.id;
  const tab = params.tab;
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic');
  const [maxMembers, setMaxMembers] = useState('10');
  const [picksPerPerson, setPicksPerPerson] = useState('5');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMode, setInviteMode] = useState<'username' | 'email'>('username');
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Advanced settings
  const [fantasySettings, setFantasySettings] = useState<LeagueSettings>({
    use_prestige_factor: true,
    rating_weight: 60,
    sharpe_weight: 30,
    color_weight: 6,
    psychological_weight: 4,
  });
  const [savingAdvanced, setSavingAdvanced] = useState(false);
  const [loadingAdvanced, setLoadingAdvanced] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [renderSliders, setRenderSliders] = useState(false);

  // Cache loaded state per league to prevent reloading
  const loadedRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const leagueKey = `${id}`;
    
    // Only load if not already loaded for this league
    if (!loadedRef.current.has(leagueKey)) {
      setLoading(true);
      fetchLeagueSettings();
      fetchUserTeam();
      loadedRef.current.add(leagueKey);
      isInitializedRef.current = true;
    }
    
    // Load advanced settings only when switching to advanced tab and not already loaded
    if (activeTab === 'advanced' && !settingsLoaded) {
      fetchFantasySettings();
    }
  }, [id, activeTab]);

  // Control slider rendering - unmount when leaving advanced tab, remount when entering
  useEffect(() => {
    if (activeTab === 'advanced' && settingsLoaded) {
      // Small delay to ensure state is updated before rendering sliders
      setRenderSliders(false);
      const timer = setTimeout(() => {
        setRenderSliders(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setRenderSliders(false);
    }
  }, [activeTab, settingsLoaded, fantasySettings]);

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
    setLoadingAdvanced(true);
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
        setSettingsLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching fantasy settings:', error);
    } finally {
      setLoadingAdvanced(false);
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

      // Notify all league members about settings change
      await notifyLeagueMembers('League fantasy scoring settings have been updated');

      Alert.alert('Success', 'Fantasy points settings updated');
      fetchFantasySettings();
    } catch (error) {
      console.error('Error updating advanced settings:', error);
      Alert.alert('Error', 'Failed to update fantasy points settings');
    } finally {
      setSavingAdvanced(false);
    }
  };

  const notifyLeagueMembers = async (message: string) => {
    try {
      console.log('Calling notification function with:', { league_id: id, message });
      
      const { data, error } = await supabase.functions.invoke('send-league-notifications', {
        body: {
          league_id: id,
          message: message,
          notification_type: 'league_settings_changed',
          exclude_user_id: user?.id
        }
      });

      if (error) {
        console.error('❌ Error calling notification function:', JSON.stringify(error, null, 2));
        Alert.alert('Warning', 'Settings saved but failed to notify members');
      } else {
        console.log('✅ Notifications sent successfully:', data);
      }
    } catch (error) {
      console.error('❌ Exception notifying league members:', error);
      Alert.alert('Warning', 'Settings saved but failed to notify members');
    }
  };

  const handleSaveSettings = async () => {
    if (!isOwner) return;

    try {
      // Check current member count
      const { count: memberCount } = await supabase
        .from('league_memberships')
        .select('*', { count: 'exact' })
        .eq('league_id', id);

      const newMaxMembers = parseInt(maxMembers);
      
      // Prevent reducing max_members below current member count
      if (memberCount && newMaxMembers < memberCount) {
        Alert.alert(
          'Error',
          `Cannot set max members to ${newMaxMembers}. There are currently ${memberCount} members in the league.`
        );
        return;
      }

      const { error } = await supabase
        .from('leagues')
        .update({
          max_members: newMaxMembers,
          picks_per_person: parseInt(picksPerPerson),
        })
        .eq('id', id);

      if (error) throw error;

      // Notify all league members about settings change
      await notifyLeagueMembers('League settings have been updated');

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
      // Check if league is at max capacity
      const { count: memberCount } = await supabase
        .from('league_memberships')
        .select('*', { count: 'exact' })
        .eq('league_id', id);

      if (memberCount && league && memberCount >= league.max_members) {
        Alert.alert('Error', 'League is at maximum capacity. Cannot send more invites.');
        return;
      }

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

  const handleInviteByEmail = async () => {
    if (!inviteEmail.trim() || !user) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    try {
      // Check if league is at max capacity
      const { count: memberCount } = await supabase
        .from('league_memberships')
        .select('*', { count: 'exact' })
        .eq('league_id', id);

      if (memberCount && league && memberCount >= league.max_members) {
        Alert.alert('Error', 'League is at maximum capacity. Cannot send more invites.');
        return;
      }

      // Check if already invited by email
      const { count } = await supabase
        .from('email_invites')
        .select('*', { count: 'exact' })
        .eq('league_id', id)
        .eq('invitee_email', inviteEmail)
        .eq('status', 'pending');

      if (count && count > 0) {
        Alert.alert('Error', 'This email has already been invited');
        return;
      }

      // Send email invite via Edge Function
      const { data, error } = await supabase.functions.invoke('send-email-invite', {
        body: {
          league_id: id,
          inviter_id: user.id,
          invitee_email: inviteEmail,
        },
      });

      if (error) throw error;

      if (data.user_exists) {
        // User already exists - they received an in-app notification instead
        Alert.alert(
          'Invite Sent',
          `${data.username || 'User'} already has an account. They've been sent an in-app notification to join the league.`
        );
        setInviteEmail('');
        return;
      }

      if (data.email_sent === false) {
        // Email invite created but email failed to send
        Alert.alert(
          'Invite Created',
          data.warning || 'Invite created but email failed to send. Email service may need configuration.'
        );
        setInviteEmail('');
        return;
      }

      // Email sent successfully
      Alert.alert('Success', `Invite email sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (error) {
      console.error('Error sending email invite:', error);
      Alert.alert('Error', 'Failed to send email invite');
    }
  };

  const handleDeleteLeague = () => {
    setShowDeleteModal(true);
    setDeleteConfirmText('');
  };

  const confirmDeleteLeague = () => {
    if (deleteConfirmText.toLowerCase() === 'delete') {
      setShowDeleteModal(false);
      deleteLeague();
    } else {
      Alert.alert('Error', 'Please type "delete" to confirm');
    }
  };

  const deleteLeague = async () => {
    try {
      const { error } = await supabase
        .from('leagues')
        .delete()
        .eq('id', id);

      if (error) throw error;

      Alert.alert('Success', 'League deleted successfully', [
        { text: 'OK', onPress: () => onClose ? onClose() : router.push('/(tabs)/leagues') }
      ]);
    } catch (error) {
      console.error('Error deleting league:', error);
      Alert.alert('Error', 'Failed to delete league');
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
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>League not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => onClose ? onClose() : router.push(`/league/${id}?tab=${tab || 'matchups'}`)} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>{onClose ? '✕' : '←'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      {isOwner && (
        <View style={[styles.tabBar, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'basic' && { ...styles.activeTab, backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('basic')}
          >
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'basic' && { ...styles.activeTabText, color: '#fff' }]}>
              Basic
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'advanced' && { ...styles.activeTab, backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('advanced')}
          >
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'advanced' && { ...styles.activeTabText, color: '#fff' }]}>
              Advanced
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Team Name - All members can edit */}
      {activeTab === 'basic' && teamId && (
        <View style={styles.section}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Team Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
              value={teamName}
              onChangeText={setTeamName}
              placeholder="Enter team name"
              placeholderTextColor={colors.textTertiary}
            />
            <TouchableOpacity
              style={[styles.saveTeamButton, { backgroundColor: colors.primary }]}
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
          <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>League Name:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{league.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{league.status}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Created:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{new Date(league.created_at).toLocaleDateString()}</Text>
            </View>
          </View>

          {/* Max Members Slider - Only show to owner */}
          {isOwner && (
            <View style={[styles.sliderContainer, { marginTop: 24 }]}>
              <Text style={[styles.sliderLabel, { marginBottom: 4 }]}>Max Members</Text>
              <Text style={[styles.sliderDescription, { marginBottom: 12 }]}>
                Maximum number of members allowed in this league
              </Text>
              <NumberStepper
                value={parseInt(maxMembers)}
                onValueChange={(value: number) => setMaxMembers(value.toString())}
                minimumValue={2}
                maximumValue={50}
                step={1}
                color={colors.primary}
              />
            </View>
          )}

          {/* Picks Per Person Slider - Only show to owner */}
          {isOwner && (
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderLabel, { marginBottom: 4 }]}>Picks Per Person</Text>
              <Text style={[styles.sliderDescription, { marginBottom: 12 }]}>
                Number of players each member can draft
              </Text>
              <NumberStepper
                value={parseInt(picksPerPerson)}
                onValueChange={(value: number) => setPicksPerPerson(value.toString())}
                minimumValue={1}
                maximumValue={20}
                step={1}
                color={colors.primary}
              />
            </View>
          )}

          {/* Save Button - Only show to owner */}
          {isOwner && (
          <TouchableOpacity
            onPress={handleSaveSettings}
            style={styles.saveAdvancedButton}
          >
            <Text style={styles.saveAdvancedButtonText}>
              Save League Settings
            </Text>
          </TouchableOpacity>
          )}
        </View>
      )}

      {/* Advanced Settings Tab */}
      {activeTab === 'advanced' && isOwner && (
        <View style={styles.section}>
          {/* Prestige Factor Toggle */}
          <View style={[styles.settingsCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabelContainer}>
                <Text style={styles.settingLabel}>Use Prestige Factor</Text>
                <Text style={styles.settingDescription}>
                  Multiply points by tournament prize fund / 100,000
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
          <View style={[styles.settingsCard, styles.weightSlidersCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.subsectionTitle, { color: colors.text }]}>Fantasy Score Weights</Text>
            
            {/* Rating Weight */}
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderLabel, { color: colors.text, marginBottom: 4 }]}>Rating Change</Text>
              <Text style={[styles.sliderDescription, { color: colors.textSecondary, marginBottom: 12 }]}>
                Points from rating gain/loss (upsets and performance)
              </Text>
              <NumberStepper
                value={Math.round(fantasySettings.rating_weight)}
                onValueChange={(value: number) =>
                  setFantasySettings({ ...fantasySettings, rating_weight: value })
                }
                minimumValue={0}
                maximumValue={100}
                step={1}
                color={colors.primary}
              />
            </View>

            {/* Sharpe Weight */}
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderLabel, { color: colors.text, marginBottom: 4 }]}>Game Quality</Text>
              <Text style={[styles.sliderDescription, { color: colors.textSecondary, marginBottom: 12 }]}>
                Consistency and quality of moves throughout the game
              </Text>
              <NumberStepper
                value={fantasySettings.sharpe_weight}
                onValueChange={(value: number) =>
                  setFantasySettings({ ...fantasySettings, sharpe_weight: value })
                }
                minimumValue={0}
                maximumValue={100}
                step={1}
                color={colors.primary}
              />
            </View>

            {/* Color Weight */}
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderLabel, { color: colors.text, marginBottom: 4 }]}>Color Factor</Text>
              <Text style={[styles.sliderDescription, { color: colors.textSecondary, marginBottom: 12 }]}>
                Bonus for winning with black, penalty for losing with white
              </Text>
              <NumberStepper
                value={fantasySettings.color_weight}
                onValueChange={(value: number) =>
                  setFantasySettings({ ...fantasySettings, color_weight: value })
                }
                minimumValue={0}
                maximumValue={100}
                step={1}
                color={colors.primary}
              />
            </View>

            {/* Psychological Weight */}
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderLabel, { color: colors.text, marginBottom: 4 }]}>Psychological Factor</Text>
              <Text style={[styles.sliderDescription, { color: colors.textSecondary, marginBottom: 12 }]}>
                Points based on performance vs recent form
              </Text>
              <NumberStepper
                value={fantasySettings.psychological_weight}
                onValueChange={(value: number) =>
                  setFantasySettings({ ...fantasySettings, psychological_weight: value })
                }
                minimumValue={0}
                maximumValue={100}
                step={1}
                color={colors.primary}
              />
            </View>

            {/* Total Weight Display */}
            <View style={styles.totalWeightContainer}>
              <Text style={[styles.totalWeightLabel, { color: colors.text }]}>Total Weight:</Text>
              <Text style={[
                styles.totalWeightValue,
                { color: colors.primary },
                !isWeightValid() && { ...styles.totalWeightInvalid, color: '#ef4444' }
              ]}>
                {getTotalWeight()} / 100
              </Text>
            </View>
            {!isWeightValid() && (
              <Text style={[styles.weightWarning, { color: '#ef4444' }]}>
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


      {/* Non-Owner View */}
      {!isOwner && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>League Settings</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Max Members:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{league.max_members}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Picks Per Person:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{league.picks_per_person}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, styles.subsectionTitle, { marginTop: 24, color: colors.text }]}>Fantasy Score Weights</Text>
          <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Prestige Factor:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {fantasySettings.use_prestige_factor ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Rating Change:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{Math.round(fantasySettings.rating_weight)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Game Quality:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{Math.round(fantasySettings.sharpe_weight)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Color Advantage:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{Math.round(fantasySettings.color_weight)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Psychological Impact:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{Math.round(fantasySettings.psychological_weight)}</Text>
            </View>
          </View>

          <Text style={[styles.notOwnerText, { color: colors.textSecondary }]}>
            Only the league owner can modify settings
          </Text>
        </View>
      )}
      </ScrollView>
    </KeyboardAvoidingView>

    {/* Delete Confirmation Modal */}
    <Modal
      visible={showDeleteModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowDeleteModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.deleteModalContent}>
          <Text style={styles.deleteModalTitle}>Delete League</Text>
          <Text style={styles.deleteModalText}>
            This action cannot be undone. All league data will be permanently deleted.
          </Text>
          <Text style={styles.deleteModalText}>
            Type <Text style={styles.deleteKeyword}>delete</Text> to confirm:
          </Text>
          <TextInput
            style={styles.deleteInput}
            value={deleteConfirmText}
            onChangeText={setDeleteConfirmText}
            placeholder="Type 'delete' here"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.deleteModalButtons}>
            <TouchableOpacity
              style={styles.deleteCancelButton}
              onPress={() => setShowDeleteModal(false)}
            >
              <Text style={styles.deleteCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.deleteConfirmButton,
                deleteConfirmText.toLowerCase() !== 'delete' && styles.deleteConfirmButtonDisabled
              ]}
              onPress={confirmDeleteLeague}
              disabled={deleteConfirmText.toLowerCase() !== 'delete'}
            >
              <Text style={styles.deleteConfirmButtonText}>Delete Forever</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 24,
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
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  inviteModeToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#2563eb',
  },
  modeButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat-SemiBold',
    color: '#64748b',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  inviteHelpText: {
    fontSize: 12,
    fontFamily: 'Montserrat-Regular',
    marginTop: 8,
    textAlign: 'center',
  },
  inviteInput: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  joinRequestsButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  joinRequestsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  dangerSection: {
    borderWidth: 2,
    borderColor: '#ef4444',
    borderRadius: 12,
    marginTop: 24,
    padding: 16,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerHelpText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  // Delete Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  deleteModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  deleteModalText: {
    fontSize: 15,
    color: '#cbd5e1',
    marginBottom: 12,
    lineHeight: 22,
  },
  deleteKeyword: {
    fontWeight: '700',
    color: '#ef4444',
    fontFamily: 'monospace',
  },
  deleteInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 2,
    borderColor: '#334155',
    marginTop: 8,
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteCancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteConfirmButtonDisabled: {
    backgroundColor: '#64748b',
    opacity: 0.5,
  },
  deleteConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
