import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useAuthStore } from '@/stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

// Ensure the auth session closes correctly when redirecting back
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isProcessing, setIsProcessing] = useState(false);

  // Setup Google Auth Request
  // Requires EXPO_PUBLIC_GOOGLE_CLIENT_ID in .env
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'missing-client-id',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'missing-client-id',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'missing-client-id',
  });

  useEffect(() => {
    // If somehow landed here while authenticated, go to tabs
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleResponse(response);
    } else if (response?.type === 'error') {
      Alert.alert('Authentication Error', response.error?.message || 'Failed to login with Google.');
    }
  }, [response]);

  const handleGoogleResponse = async (res: any) => {
    setIsProcessing(true);
    try {
      const idToken = res.authentication?.idToken;
      if (!idToken) {
        throw new Error('No ID Token returned from Google. Ensure you passed a webClientId.');
      }
      // Send token to our FastAPI backend
      await googleLogin(idToken);
      // After login, zustand store state changes, and _layout.tsx will auto-redirect!
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Could not connect to NeuraNotes server.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandContainer}>
        <View style={styles.logoCircle}>
          <FontAwesome name="lightbulb-o" size={48} color={Colors.primary} />
        </View>
        <Text style={styles.title}>NeuraNotes</Text>
        <Text style={styles.subtitle}>Your AI-Powered Second Brain</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.googleButton}
          activeOpacity={0.8}
          disabled={!request || isProcessing}
          onPress={() => promptAsync()}
        >
          {isProcessing ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <>
              <FontAwesome name="google" size={20} color={Colors.background} style={styles.googleIcon} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
        
        {!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID && (
          <Text style={styles.warningText}>
            Warning: EXPO_PUBLIC_GOOGLE_CLIENT_ID is missing from your .env
          </Text>
        )}

        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: Colors.primary + '15', marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '30' }]}
          activeOpacity={0.8}
          onPress={() => useAuthStore.getState().devLogin()}
        >
          <FontAwesome name="check-circle" size={20} color={Colors.primary} style={styles.googleIcon} />
          <Text style={[styles.googleButtonText, { color: Colors.primary }]}>Local Dev Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl * 2,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 36,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: Colors.text,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    marginRight: Spacing.sm,
  },
  googleButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.background,
  },
  warningText: {
    marginTop: Spacing.md,
    color: Colors.error,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
