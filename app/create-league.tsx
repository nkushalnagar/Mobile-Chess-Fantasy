import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type LeagueType = 'tournament' | 'season';

type RatingTier = {
  label: string;
  minRating: number;
  maxRating: number | null;
  playerCount: number;
};

const RATING_TIERS: RatingTier[] = [
  { label: '2600+ FIDE (Super Elite)', minRating: 2600, maxRating: null, playerCount: 167 },
  { label: '2700+ FIDE (World Class)', minRating: 2700, maxRating: null, playerCount: 33 },
];

export default function CreateLeagueScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [leagueName, setLeagueName] = useState('');
  const [leagueType, setLeagueType] = useState<LeagueType>('tournament');
  const [picksPerPerson, setPicksPerPerson] = useState(5);
  const [maxMembers, setMaxMembers] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTier, setSelectedTier] = useState<RatingTier>(RATING_TIERS[0]);
  const [showPicksInfo, setShowPicksInfo] = useState(false);
  const [showMembersInfo, setShowMembersInfo] = useState(false);


  const handleCreate = async () => {
    if (!leagueName.trim()) {
      Alert.alert('Error', 'Please enter a league name');
      return;
    }

    // Validation: picks per person
    if (picksPerPerson < 1 || picksPerPerson > 20) {
      Alert.alert('Error', 'Picks per person must be between 1 and 20');
      return;
    }

    // Warning for tournament leagues: high picks ratio
    if (leagueType === 'tournament') {
      const totalPicks = picksPerPerson * maxMembers;
      // Assume ~8 players per tournament on average
      const estimatedPlayers = 8;
      
      if (totalPicks > estimatedPlayers) {
        Alert.alert(
          'Warning: Too Many Picks',
          `With ${maxMembers} members and ${picksPerPerson} picks each, you'll need ${totalPicks} total picks. You'll run into issues with tournaments with less players.\n\n(You can edit this later in settings)`,
          [
            { text: 'Go Back', style: 'cancel' },
            { text: 'Create Anyway', onPress: () => createLeague() },
          ]
        );
        return;
      }
    }

    createLeague();
  };

  const createLeague = async () => {
    setIsCreating(true);

    try {
      // Create league
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert({
          name: leagueName,
          max_members: maxMembers,
          picks_per_person: picksPerPerson,
          owner_id: user?.id,
          status: 'open',
          league_type: leagueType,
          // Add rating constraints for season leagues
          min_player_rating: leagueType === 'season' ? selectedTier.minRating : null,
          max_player_rating: leagueType === 'season' ? selectedTier.maxRating : null,
        })
        .select()
        .single();

      if (leagueError) throw leagueError;

      // Create owner's membership
      const { error: membershipError } = await supabase
        .from('league_memberships')
        .insert({
          league_id: league.id,
          user_id: user?.id,
          role: 'owner',
        });

      if (membershipError) throw membershipError;

      Alert.alert('Success', 'League created! You can now invite members from the league page.', [
        { text: 'OK', onPress: () => router.replace(`/league/${league.id}`) },
      ]);
    } catch (error) {
      console.error('League creation error:', error);
      Alert.alert('Error', 'Failed to create league. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Your League</Text>
          <Text style={styles.subtitle}>Set up your league and invite members</Text>
        </View>

        <View style={styles.form}>
          {/* League Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>League Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter league name"
              placeholderTextColor="#64748b"
              value={leagueName}
              onChangeText={setLeagueName}
            />
          </View>

          {/* League Type */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>League Type</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  leagueType === 'tournament' && styles.typeOptionSelected,
                ]}
                onPress={() => setLeagueType('tournament')}
              >
                <Text
                  style={[
                    styles.typeOptionText,
                    leagueType === 'tournament' && styles.typeOptionTextSelected,
                  ]}
                >
                  🏆 Tournament
                </Text>
                <Text style={styles.typeOptionDescription}>
                  Redraft for each tournament
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeOption,
                  leagueType === 'season' && styles.typeOptionSelected,
                ]}
                onPress={() => setLeagueType('season')}
              >
                <Text
                  style={[
                    styles.typeOptionText,
                    leagueType === 'season' && styles.typeOptionTextSelected,
                  ]}
                >
                  📅 Season
                </Text>
                <Text style={styles.typeOptionDescription}>
                  Draft once, accumulate points all season
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helpText}>
              {leagueType === 'tournament'
                ? 'Players redraft before each major FIDE tournament. Scores reset each time.'
                : 'Players draft once and accumulate fantasy points throughout the entire season.'}
            </Text>
          </View>

          {/* Rating Tier (Season Leagues Only) */}
          {leagueType === 'season' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Player Rating Tier</Text>
              <View style={styles.tierSelector}>
                {RATING_TIERS.map((tier) => (
                  <TouchableOpacity
                    key={tier.label}
                    style={[
                      styles.tierOption,
                      selectedTier.label === tier.label && styles.tierOptionSelected,
                    ]}
                    onPress={() => setSelectedTier(tier)}
                  >
                    <Text
                      style={[
                        styles.tierOptionText,
                        selectedTier.label === tier.label && styles.tierOptionTextSelected,
                      ]}
                    >
                      {tier.label}
                    </Text>
                    <Text style={styles.tierPlayerCount}>
                      {tier.playerCount} players
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.helpText}>
                Only players with rating {selectedTier.minRating}+ can be drafted in this league.
              </Text>
            </View>
          )}

          {/* Max Members */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Max Members</Text>
              <Text style={styles.sliderValue}>{maxMembers}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={2}
              maximumValue={20}
              step={1}
              value={maxMembers}
              onValueChange={setMaxMembers}
              minimumTrackTintColor="#3b82f6"
              maximumTrackTintColor="#334155"
              thumbTintColor="#3b82f6"
            />
            <View style={styles.helpTextRow}>
              <Text style={styles.helpText}>Maximum number of members in this league</Text>
              <TouchableOpacity onPress={() => setShowMembersInfo(true)} style={styles.infoButtonInline}>
                <Text style={styles.infoIcon}>ⓘ</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Picks Per Person */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Picks Per Person</Text>
              <Text style={styles.sliderValue}>{picksPerPerson}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={20}
              step={1}
              value={picksPerPerson}
              onValueChange={setPicksPerPerson}
              minimumTrackTintColor="#3b82f6"
              maximumTrackTintColor="#334155"
              thumbTintColor="#3b82f6"
            />
            <View style={styles.helpTextRow}>
              <Text style={styles.helpText}>How many players each member drafts</Text>
              <TouchableOpacity onPress={() => setShowPicksInfo(true)} style={styles.infoButtonInline}>
                <Text style={styles.infoIcon}>ⓘ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.createButton, isCreating && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={isCreating}
        >
          <Text style={styles.createButtonText}>
            {isCreating ? 'Creating League...' : 'Create League'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Picks Info Modal */}
      <Modal
        visible={showPicksInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicksInfo(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicksInfo(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>
              💡 You can change the number of picks later in league settings.
            </Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => setShowPicksInfo(false)}
            >
              <Text style={styles.modalButtonText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Max Members Info Modal */}
      <Modal
        visible={showMembersInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMembersInfo(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMembersInfo(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>
              💡 You can change max members later in league settings.
            </Text>
            <Text style={styles.modalText}>
              ⚠️ Drafting will only begin once member capacity is full.
            </Text>
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={() => setShowMembersInfo(false)}
            >
              <Text style={styles.modalButtonText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120, // Space for fixed bottom bar
  },
  header: {
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  form: {
    padding: 20,
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  helpText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
  },
  typeOptionSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#1e3a8a',
  },
  typeOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  typeOptionTextSelected: {
    color: '#fff',
  },
  typeOptionDescription: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  tierSelector: {
    gap: 8,
  },
  tierOption: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierOptionSelected: {
    borderColor: '#10b981',
    backgroundColor: '#064e3b',
  },
  tierOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tierOptionTextSelected: {
    color: '#fff',
  },
  tierPlayerCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    padding: 16,
    paddingBottom: 32,
  },
  createButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelText: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  helpTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoButtonInline: {
    padding: 2,
  },
  infoIcon: {
    fontSize: 16,
    color: '#64748b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 350,
    gap: 12,
  },
  modalText: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
