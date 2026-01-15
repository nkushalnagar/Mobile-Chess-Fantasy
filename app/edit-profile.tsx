import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

const PAWN_COLORS = [
  { name: 'Blue', color: '#2563eb' },
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Green', color: '#10b981' },
  { name: 'Red', color: '#ef4444' },
  { name: 'Orange', color: '#f97316' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Cyan', color: '#06b6d4' },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams();
  const { profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const [username, setUsername] = useState(profile?.username || '');
  const [pawnColor, setPawnColor] = useState((profile as any)?.pawn_color || '#2563eb');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }

    if (username === profile?.username && pawnColor === (profile as any)?.pawn_color) {
      router.push('/(tabs)/profile');
      return;
    }

    setLoading(true);
    try {
      const newUsername = username.trim();

      // Check if username is already taken
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', newUsername)
        .neq('id', profile?.id)
        .single();

      if (existingProfile) {
        Alert.alert('Error', 'Username already taken');
        setLoading(false);
        return;
      }

      // Update the profile - the database should handle cascade updates
      const { error } = await supabase
        .from('profiles')
        .update({ 
          username: newUsername,
          pawn_color: pawnColor 
        })
        .eq('id', profile?.id);

      if (error) throw error;

      await refreshProfile();
      Alert.alert('Success', 'Profile updated successfully');
      router.push('/(tabs)/profile');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[styles.saveButtonText, { color: colors.primary }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.avatar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Image
            source={require('@/assets/images/fantasy pawns/13.png')}
            style={styles.pawnAvatar}
            tintColor={pawnColor}
          />
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.label, { color: colors.text }]}>Username</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.text }]}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            This is how other players will see you in leagues
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={[styles.label, { color: colors.text }]}>Pawn Color</Text>
          <View style={styles.colorGrid}>
            {PAWN_COLORS.map((item) => (
              <TouchableOpacity
                key={item.color}
                style={[
                  styles.colorOption,
                  { backgroundColor: item.color },
                  pawnColor === item.color && styles.colorOptionSelected,
                ]}
                onPress={() => setPawnColor(item.color)}
              >
                {pawnColor === item.color && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            Choose your pawn color for your profile avatar
          </Text>
        </View>
      </View>
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
    minWidth: 60,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  saveButton: {
    padding: 8,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  saveButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  pawnAvatar: {
    width: 70,
    height: 70,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
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
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  colorOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  checkmark: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
});
