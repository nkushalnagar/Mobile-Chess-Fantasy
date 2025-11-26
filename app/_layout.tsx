import { Stack } from 'expo-router';
import { AuthProvider } from '@/contexts/AuthContext';
import { View, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [error, setError] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    'Montserrat-Regular': Montserrat_400Regular,
    'Montserrat-Medium': Montserrat_500Medium,
    'Montserrat-SemiBold': Montserrat_600SemiBold,
    'Montserrat-Bold': Montserrat_700Bold,
  });

  // Set default font for Text components
  useEffect(() => {
    if (fontsLoaded) {
      const defaultFontFamily = 'Montserrat-Regular';
      // @ts-ignore - Setting default props
      Text.defaultProps = Text.defaultProps || {};
      Text.defaultProps.style = { fontFamily: defaultFontFamily };
    }
  }, [fontsLoaded]);

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
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

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
    <AuthProvider>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#0f172a',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'Sign In' }} />
        <Stack.Screen name="signup" options={{ title: 'Sign Up' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="league/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="create-league" options={{ headerShown: false }} />
        <Stack.Screen name="draft-room/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="league-settings/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
