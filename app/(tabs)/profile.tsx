import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function ProfileTab() {
  const { user, profile, signOut } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to sign out');
            }
          },
        },
      ]
    );
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileSection, { backgroundColor: 'transparent' }]}>
          <View style={[styles.avatar, { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 2 }]}>
            <Image
              source={require('@/assets/images/fantasy pawns/13.png')}
              style={styles.pawnAvatar}
              tintColor={(profile as any)?.pawn_color || '#2563eb'}
            />
          </View>
          <Text style={[styles.username, { color: colors.text }]}>{profile?.username}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => router.push('/edit-profile?from=profile')}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>Edit Profile</Text>
            <Text style={[styles.menuItemArrow, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => router.push('/notifications?from=profile')}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>Notifications</Text>
            <Text style={[styles.menuItemArrow, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => router.push('/support-tickets')}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>Help & Support</Text>
            <Text style={[styles.menuItemArrow, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => router.push('/terms-of-service')}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>Terms of Service</Text>
            <Text style={[styles.menuItemArrow, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => router.push('/privacy-policy')}
          >
            <Text style={[styles.menuItemText, { color: colors.text }]}>Privacy Policy</Text>
            <Text style={[styles.menuItemArrow, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.signOutButton, { backgroundColor: colors.error }]} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textTertiary }]}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pawnAvatar: {
    width: 60,
    height: 60,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#94a3b8',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  menuItemText: {
    fontSize: 16,
    color: '#fff',
  },
  menuItemArrow: {
    fontSize: 24,
    color: '#64748b',
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#dc2626',
    marginTop: 16,
  },
  signOutButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: 'bold',
  },
  version: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 40,
  },
});
