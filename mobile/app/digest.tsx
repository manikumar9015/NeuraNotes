import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Animated,
  Platform
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../constants/theme';
import { useNotesStore } from '../stores/notesStore';
import Markdown from 'react-native-markdown-display';
import { LinearGradient } from 'expo-linear-gradient';

const HEADER_MAX_HEIGHT = 280;
const HEADER_MIN_HEIGHT = 80;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

export default function DailyDigestScreen() {
  const router = useRouter();
  const { fetchDailyDigest } = useNotesStore();
  
  const [digest, setDigest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadDigest();
  }, []);

  const loadDigest = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDailyDigest();
      setDigest(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch digest');
    } finally {
      setLoading(false);
    }
  };

  // ----- ANIMATION INTERPOLATIONS -----

  // Moves the entire header up natively
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -HEADER_SCROLL_DISTANCE],
    extrapolate: 'clamp',
  });

  // Fades out the big title content as you scroll up
  const heroOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 1.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Moves the big title content up faster for a parallax effect
  const heroTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, HEADER_SCROLL_DISTANCE / 2],
    extrapolate: 'clamp',
  });

  // Fades in the small title on the top bar
  const compactTitleOpacity = scrollY.interpolate({
    inputRange: [HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Counter-translates the top bar so it remains fixed on the screen while the header slides underneath it
  const topBarTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, HEADER_SCROLL_DISTANCE],
    extrapolate: 'clamp',
  });

  // Animate border radius from rounded to square
  const headerBorderRadius = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [BorderRadius.xl * 1.5, 0],
    extrapolate: 'clamp',
  });

  // ----- STYLES -----

  const markdownStyles = StyleSheet.create({
    body: { color: Colors.text, fontSize: 16, lineHeight: 26 },
    heading1: { color: Colors.primaryLight, marginTop: Spacing.xl, marginBottom: Spacing.md, fontWeight: '800', fontSize: 26 },
    heading2: { color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm, fontWeight: '700', fontSize: 22 },
    heading3: { color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm, fontWeight: '600', fontSize: 18 },
    paragraph: { marginVertical: Spacing.sm, color: Colors.textSecondary },
    strong: { color: Colors.text, fontWeight: 'bold' },
    em: { fontStyle: 'italic', color: Colors.textMuted },
    list_item: { marginVertical: 4, flexDirection: 'row', color: Colors.textSecondary },
    bullet_list_icon: { color: Colors.primary, marginRight: Spacing.sm },
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {loading ? (
          <View style={styles.centerContainer}>
             <ActivityIndicator size="large" color={Colors.primary} />
             <Text style={styles.loadingText}>Synthesizing your knowledge...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadDigest}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : digest ? (
          <View style={styles.markdownContainer}>
            <Markdown style={markdownStyles}>
              {digest}
            </Markdown>
          </View>
        ) : (
          <View style={styles.centerContainer}>
             <Text style={styles.errorText}>No digest could be generated.</Text>
          </View>
        )}
      </Animated.ScrollView>

      {/* Absolute Collapsible Header */}
      <Animated.View style={[
        styles.headerWrapper, 
        { 
          transform: [{ translateY: headerTranslateY }],
          borderBottomLeftRadius: headerBorderRadius,
          borderBottomRightRadius: headerBorderRadius,
        }
      ]}>
        
        {/* The beautiful rounded background map */}
        <Animated.View style={styles.headerBackground}>
          <LinearGradient
            colors={Colors.gradientCyan}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Big Parallax Hero Content */}
        <Animated.View style={[styles.heroContent, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
          <Ionicons name="sparkles" size={48} color="#FFF" style={styles.heroIcon} />
          <Text style={styles.heroTitle}>Daily Digest</Text>
          <Text style={styles.heroSubtitle}>Your intelligent summary of the last 24 hours.</Text>
        </Animated.View>

        {/* Pinned Top Bar (Back button + Compact Title) */}
        <Animated.View style={[styles.topBar, { transform: [{ translateY: topBarTranslateY }] }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <Animated.Text style={[styles.compactTitle, { opacity: compactTitleOpacity }]} numberOfLines={1}>
            Daily Digest
          </Animated.Text>
          
          <View style={styles.spacer} /> {/* Spacer to perfectly center the title */}
        </Animated.View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: HEADER_MAX_HEIGHT + Spacing.xl, // Ensure content starts below the max header height
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_MAX_HEIGHT,
    overflow: 'hidden', // Crucial to clip the linear gradient to our beautiful border radii
    borderBottomLeftRadius: BorderRadius.xl * 1.5,
    borderBottomRightRadius: BorderRadius.xl * 1.5,
    ...Shadow.lg,
  },
  headerBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.xl,
    right: Spacing.xl,
  },
  heroIcon: {
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    fontSize: FontSize.display,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  topBar: {
    position: 'absolute',
    top: 25, // Adjusted to perfectly center inside the newly slimmed 80px min-height header
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
    textAlign: 'center',
  },
  spacer: {
    width: 40, // Matches backBtn width to exactly center the title
  },
  markdownContainer: {
    // Removed card styling so the content blends seamlessly into the screen
  },
  centerContainer: {
    paddingVertical: Spacing.xxl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: Spacing.lg,
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  errorText: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
  },
  retryText: {
    color: Colors.primaryLight,
    fontWeight: '600',
    fontSize: FontSize.md,
  },
});
