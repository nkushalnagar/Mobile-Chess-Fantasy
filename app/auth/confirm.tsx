import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function ConfirmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // The token is in the URL params
        const { token_hash, type } = params;

        if (type === 'signup' && token_hash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token_hash as string,
            type: 'signup',
          });

          if (error) throw error;

          setStatus('success');
          setMessage('Email verified successfully! Redirecting to login...');
          
          // Redirect to login after 2 seconds
          setTimeout(() => {
            router.replace('/login');
          }, 2000);
        } else {
          setStatus('success');
          setMessage('Email verified! You can now log in.');
          setTimeout(() => {
            router.replace('/login');
          }, 2000);
        }
      } catch (error: any) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to verify email. Please try again or contact support.');
      }
    };

    verifyEmail();
  }, [params]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {status === 'loading' && <ActivityIndicator size="large" color="#2563eb" />}
          {status === 'success' && <Text style={styles.successIcon}>✓</Text>}
          {status === 'error' && <Text style={styles.errorIcon}>✗</Text>}
        </View>
        
        <Text style={styles.title}>
          {status === 'loading' && 'Verifying Email'}
          {status === 'success' && 'Email Verified!'}
          {status === 'error' && 'Verification Failed'}
        </Text>
        
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  iconContainer: {
    marginBottom: 32,
  },
  successIcon: {
    fontSize: 80,
    color: '#22c55e',
  },
  errorIcon: {
    fontSize: 80,
    color: '#ef4444',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
});
