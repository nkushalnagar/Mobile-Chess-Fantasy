import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

interface ActiveDraft {
  league_id: string;
  league_name: string;
  current_pick_number: number;
  is_user_turn: boolean;
}

export default function DraftBanner() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [activeDraft, setActiveDraft] = useState<ActiveDraft | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-100));

  // Don't show banner on draft room page
  const isOnDraftRoomPage = pathname?.includes('/draft-room/');

  // Swipe up gesture to dismiss
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > 5;
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy < -50) {
        // Swiped up - dismiss banner
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setIsDismissed(true);
        });
      }
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    const checkActiveDrafts = async () => {
      try {
        // Get user's leagues that are currently drafting
        const { data: memberships, error: membershipsError } = await supabase
          .from('league_memberships')
          .select('league_id, team_id, leagues(id, name, status)')
          .eq('user_id', user.id);

        if (membershipsError) throw membershipsError;

        // Find leagues in drafting status
        const draftingLeagues = memberships?.filter(
          (m: any) => m.leagues?.status === 'drafting'
        ) || [];

        if (draftingLeagues.length === 0) {
          setActiveDraft(null);
          setIsDismissed(false);
          return;
        }

        // Show the first drafting league
        const firstDraftingLeague = draftingLeagues[0];
        setActiveDraft({
          league_id: firstDraftingLeague.league_id,
          league_name: (firstDraftingLeague.leagues as any).name,
          current_pick_number: 0,
          is_user_turn: false,
        });

        // Slide in animation
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error('Error checking active drafts:', error);
      }
    };

    checkActiveDrafts();

    // Subscribe to league status changes
    const channel = supabase
      .channel('draft_banner_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leagues',
        },
        () => {
          checkActiveDrafts();
        }
      )
      .subscribe();

    // Poll every 10 seconds as backup (in case real-time subscription misses an update)
    const pollInterval = setInterval(() => {
      checkActiveDrafts();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [user?.id]);

  if (!activeDraft || isDismissed || isOnDraftRoomPage) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.banner,
        {
          backgroundColor: colors.primary,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.bannerContent}
        onPress={() => router.push(`/draft-room/${activeDraft.league_id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.bannerTextContainer}>
          <Text style={styles.bannerTitle}>
            {activeDraft.league_name} is drafting
          </Text>
          <Text style={styles.bannerSubtitle}>Swipe up to dismiss</Text>
        </View>
        <Text style={styles.bannerArrow}>→</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingTop: 50, // Account for status bar
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerSubtitle: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  bannerArrow: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    padding: 4,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
