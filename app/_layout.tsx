import { Slot } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DataCacheProvider } from '@/contexts/DataCacheContext';
import { View, Animated } from 'react-native';
import { Text } from '@/components/ThemedText';
import { useEffect, useState, useRef } from 'react';
import { useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import * as SplashScreen from 'expo-splash-screen';
import { useNotifications } from '@/hooks/useNotifications';
import DraftBanner from '@/components/DraftBanner';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [fontsLoaded] = useFonts({
    'Montserrat-Regular': Montserrat_400Regular,
    'Montserrat-Medium': Montserrat_500Medium,
    'Montserrat-SemiBold': Montserrat_600SemiBold,
    'Montserrat-Bold': Montserrat_700Bold,
  });

  // Initialize notifications
  useNotifications();

  useEffect(() => {
    // Check if environment variables are set
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
      setError('Missing EXPO_PUBLIC_SUPABASE_URL');
    }
    if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
      setError('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800, // 800ms fade-in
        useNativeDriver: true,
      }).start(() => {
        // Hide splash screen after fade-in completes
        SplashScreen.hideAsync();
      });
    }
  }, [fontsLoaded, fadeAnim]);

  if (!fontsLoaded) {
    return null;
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#ef4444', fontSize: 18, marginBottom: 10 }}>⚠️ Configuration Error</Text>
        <Text style={{ color: '#fff', textAlign: 'center' }}>{error}</Text>
        <Text style={{ color: '#94a3b8', marginTop: 20, textAlign: 'center' }}>
          Please check your .env.local file
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      <ThemeProvider>
        <AuthProvider>
          <DataCacheProvider>
            <DraftBanner />
            <Slot />
          </DataCacheProvider>
        </AuthProvider>
      </ThemeProvider>
    </Animated.View>
  );
}
