import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function NotFoundScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    // If user is authenticated, redirect to home
    if (!loading && user && profile) {
      router.replace('/(tabs)/home');
    } else if (!loading) {
      // If not authenticated, redirect to index
      router.replace('/');
    }
  }, [loading, user, profile]);

  // Show loading while determining where to redirect
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 20,
  },
});
