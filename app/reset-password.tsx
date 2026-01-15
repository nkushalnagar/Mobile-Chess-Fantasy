import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleSession();
  }, []);

  const handleSession = async () => {
    try {
      // Check for recovery token first (from email link)
      const token = params.token as string;
      const type = params.type as string;

      if (token && type === 'recovery') {
        // Exchange recovery token for session
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery',
        });

        if (error) {
          console.error('Error verifying recovery token:', error);
          Alert.alert('Error', 'Invalid or expired reset link. Please request a new password reset.');
          router.replace('/login');
          return;
        }

        if (data.session) {
          setSessionReady(true);
        } else {
          Alert.alert('Error', 'Failed to create session. Please request a new password reset.');
          router.replace('/login');
        }
        return;
      }

      // Fallback: Try to get tokens from query params (old flow)
      let accessToken = params.access_token as string;
      let refreshToken = params.refresh_token as string;

      // If not in query params, try to extract from hash fragment
      if (!accessToken || !refreshToken) {
        // Get the initial URL that opened the app
        const initialUrl = await Linking.getInitialURL();
        
        if (initialUrl) {
          const hashPart = initialUrl.split('#')[1];
          
          if (hashPart) {
            const hashParams = new URLSearchParams(hashPart);
            accessToken = hashParams.get('access_token') || '';
            refreshToken = hashParams.get('refresh_token') || '';
          }
        }
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Error setting session:', error);
          Alert.alert('Error', 'Invalid or expired reset link. Please request a new password reset.');
          router.replace('/login');
          return;
        }

        setSessionReady(true);
      } else {
        Alert.alert('Error', 'Invalid reset link. Please request a new password reset from the app.');
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error in reset password session:', error);
      Alert.alert('Error', 'Failed to verify reset link. Please try again.');
      router.replace('/login');
    } finally {
      setVerifying(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Your password has been updated successfully. You are now logged in!',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)')
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Verifying reset link...</Text>
        </View>
      </View>
    );
  }

  if (!sessionReady) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Create New Password</Text>
        <Text style={styles.subtitle}>
          Enter your new password below
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="New Password (min 6 characters)"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="off"
            textContentType="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm New Password"
            placeholderTextColor="#64748b"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="off"
            textContentType="none"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleUpdatePassword}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Updating...' : 'Update Password'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#94a3b8',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'Montserrat-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
    fontFamily: 'Montserrat-Bold',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
    fontFamily: 'Montserrat-Bold',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Montserrat-Bold',
  },
});
