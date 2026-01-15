import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Get the access_token and refresh_token from URL params
      const accessToken = params.access_token as string;
      const refreshToken = params.refresh_token as string;

      console.log('Callback params:', { hasAccess: !!accessToken, hasRefresh: !!refreshToken });

      if (accessToken && refreshToken) {
        // Set the session in Supabase
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Error setting session:', error);
          router.replace('/login');
          return;
        }

        console.log('Session set successfully, redirecting to home');
        // Redirect to home page
        router.replace('/(tabs)/home');
      } else {
        console.error('No tokens found in callback');
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error in auth callback:', error);
      router.replace('/login');
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  text: {
    marginTop: 16,
    color: '#94a3b8',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
});
