import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useAuthStore } from '@/stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isProcessing, setIsProcessing] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'missing-client-id',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'missing-client-id',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'missing-client-id',
  });

  useEffect(() => {
    if (isAuthenticated) router.replace('/(tabs)');
  }, [isAuthenticated]);

  useEffect(() => {
    if (response?.type === 'success') handleGoogleResponse(response);
    else if (response?.type === 'error') {
      Alert.alert('Authentication Error', response.error?.message || 'Failed to login with Google.');
    }
  }, [response]);

  const handleGoogleResponse = async (res: any) => {
    setIsProcessing(true);
    try {
      const idToken = res.authentication?.idToken;
      if (!idToken) throw new Error('No ID Token returned from Google.');
      await googleLogin(idToken);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Could not connect to NeuraNotes server.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoSymbol}>✦</Text>
          </View>
          <Text style={styles.appName}>NeuraNotes</Text>
          <Text style={styles.tagline}>Your AI-Powered Second Brain</Text>
        </View>

        {/* Feature highlights */}
        <View style={styles.features}>
          {[
            { icon: 'bolt', text: 'Capture notes in seconds' },
            { icon: 'search', text: 'Semantic search across everything' },
            { icon: 'comments', text: 'Chat with your knowledge base' },
          ].map((item) => (
            <View key={item.text} style={styles.featureRow}>
              <View style={styles.featureIconBadge}>
                <FontAwesome name={item.icon as any} size={14} color={Colors.primary} />
              </View>
              <Text style={styles.featureText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          {/* Google Sign In */}
          <TouchableOpacity
            style={styles.googleBtn}
            activeOpacity={0.85}
            disabled={!request || isProcessing}
            onPress={() => promptAsync()}
          >
            {isProcessing ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <>
                <FontAwesome name="google" size={18} color={Colors.textInverse} />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID && (
            <Text style={styles.warningText}>
              ⚠ EXPO_PUBLIC_GOOGLE_CLIENT_ID missing from .env
            </Text>
          )}

          {/* Dev login */}
          <TouchableOpacity
            style={styles.devBtn}
            activeOpacity={0.8}
            onPress={() => useAuthStore.getState().devLogin()}
          >
            <FontAwesome name="code" size={16} color={Colors.primary} />
            <Text style={styles.devBtnText}>Dev Login (local testing)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          By continuing you agree to our Terms of Service & Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'space-between',
    paddingVertical: 60,
  },

  // Brand
  brand: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
  },
  logoSymbol: {
    fontSize: 40,
    color: Colors.primary,
  },
  appName: {
    fontSize: 40,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Features
  features: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  featureText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },

  // Buttons
  buttons: {
    gap: Spacing.md,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.text,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  googleBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
  },
  warningText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  devBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '12',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  devBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },

  footer: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
