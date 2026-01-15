import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

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
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
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
    
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);
    
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(timeout);
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

  const processPendingEmailInvites = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('process_pending_email_invites', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error processing email invites:', error);
        return;
      }

      if (data?.processed_count > 0) {
      }
    } catch (error) {
      console.error('Error processing email invites:', error);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      // Try to get cached profile first
      const cachedProfile = await AsyncStorage.getItem('userProfile');
      
      if (cachedProfile) {
        const parsed = JSON.parse(cachedProfile);
        // Only use cached profile if it matches the current user
        if (parsed.id === userId) {
          setProfile(parsed);
          setLoading(false);
          // Process pending email invites in background
          processPendingEmailInvites(userId);
          return;
        } else {
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
        // Process pending email invites in background
        processPendingEmailInvites(userId);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (emailOrUsername: string, password: string) => {
    let email = emailOrUsername;
    
    // Check if input is username (no @ symbol) and look up email
    if (!emailOrUsername.includes('@')) {
      // Use RPC function to get email from username
      const { data, error: rpcError } = await supabase
        .rpc('get_email_from_username', { p_username: emailOrUsername });
      
      if (rpcError || !data) {
        throw new Error('Username not found');
      }
      
      email = data;
    }
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    
    // Check if profile is verified (only for email/password signups)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_verified')
        .eq('id', user.id)
        .single();
      
      if (profile && profile.is_verified === false) {
        await supabase.auth.signOut();
        throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
      }
    }
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

    // Sign up user with username in metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        }
      }
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user data returned');
    
    console.log('✅ User created with username in metadata:', data.user.id);
    
    // Note: Profile will be created by trigger when email is confirmed
    // Trigger will read username from user metadata
  };

  const signOut = async () => {
    // Clear cached data
    await AsyncStorage.removeItem('pendingUsername');
    await AsyncStorage.removeItem('userProfile');
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    // Note: Google OAuth users are auto-verified by Supabase
    // Profile will be created by handle_new_user trigger with is_verified=true
    // Use the app's deep link for the callback
    const redirectUrl = makeRedirectUri({
      scheme: 'fantasychess',
      path: 'auth/callback'
    });
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
      },
    });

    if (error) throw error;
    
    if (data?.url) {
      // Open the OAuth URL in the browser
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      if (result.type === 'success' && result.url) {
        // Extract tokens from the callback URL
        const url = result.url;
        const hashParams = url.split('#')[1];
        
        if (hashParams) {
          const params = new URLSearchParams(hashParams);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (sessionError) {
              console.error('Error setting session:', sessionError);
              throw sessionError;
            }
          }
        }
      } else if (result.type === 'cancel') {
      }
    }
  };

  const signInWithApple = async () => {
    try {
      const nonce = Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      
      const { error, data } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
        nonce,
      });

      if (error) {
        console.error('🍎 Supabase error:', JSON.stringify(error, null, 2));
        throw error;
      }

      // If this is a new user and we have their name, create profile with their actual name
      // Otherwise trigger will create profile with email-based username
      if (data.user && credential.fullName) {
        const firstName = credential.fullName.givenName || '';
        const lastName = credential.fullName.familyName || '';
        const displayName = `${firstName} ${lastName}`.trim() || 'Apple User';
        
        // Check if profile exists (trigger might have created it already)
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single();

        if (!existingProfile) {
          // Create profile with Apple name and mark as verified
          await supabase
            .from('profiles')
            .insert([{ 
              id: data.user.id, 
              username: displayName,
              email: data.user.email,
              is_verified: true 
            }]);
        }
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in flow
        return;
      }
      throw error;
    }
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
        signInWithGoogle,
        signInWithApple,
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
