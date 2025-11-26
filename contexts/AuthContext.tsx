import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  username: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Initializing...');
    
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('AuthProvider: Timeout - forcing loading to false');
      setLoading(false);
    }, 5000);
    
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeout);
        console.log('AuthProvider: Got session', { session, error });
        if (error) {
          console.error('AuthProvider: Session error', error);
          setLoading(false);
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error('AuthProvider: Failed to get session', err);
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Try to get cached profile first
      const cachedProfile = await AsyncStorage.getItem('userProfile');
      
      if (cachedProfile) {
        const parsed = JSON.parse(cachedProfile);
        // Only use cached profile if it matches the current user
        if (parsed.id === userId) {
          console.log('Using cached profile');
          setProfile(parsed);
          setLoading(false);
          return;
        } else {
          console.log('Cached profile is for different user, fetching new profile');
          await AsyncStorage.removeItem('userProfile');
        }
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Cache the profile
        await AsyncStorage.setItem('userProfile', JSON.stringify(data));
        setProfile(data);
      } else {
        // No profile exists, check for pending username
        const pendingUsername = await AsyncStorage.getItem('pendingUsername');
        if (pendingUsername) {
          console.log('Creating profile with pending username:', pendingUsername);
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([{ id: userId, username: pendingUsername }])
            .select()
            .single();

          if (createError) throw createError;

          await AsyncStorage.removeItem('pendingUsername');
          await AsyncStorage.setItem('userProfile', JSON.stringify(newProfile));
          setProfile(newProfile);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, username: string) => {
    // First check if username is available
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingProfile) {
      throw new Error('Username already taken');
    }

    // Store username in AsyncStorage temporarily
    await AsyncStorage.setItem('pendingUsername', username);

    // Sign up user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      await AsyncStorage.removeItem('pendingUsername');
      throw error;
    }

    if (!data.user) {
      await AsyncStorage.removeItem('pendingUsername');
      throw new Error('No user data returned');
    }

    // Note: Profile will be created when user verifies email
    // This happens in fetchProfile when SIGNED_IN event fires
  };

  const signOut = async () => {
    // Clear cached data
    await AsyncStorage.removeItem('pendingUsername');
    await AsyncStorage.removeItem('userProfile');
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const refreshProfile = async () => {
    if (!user?.id) return;
    
    // Clear cache and refetch
    await AsyncStorage.removeItem('userProfile');
    await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
