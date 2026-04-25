import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNotesStore, Flashcard } from '../../stores/notesStore';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function FlashcardsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { generateFlashcards, selectedNote, fetchNoteDetail } = useNotesStore();

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [review, setReview] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);

  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadFlashcards(); }, [id]);

  const loadFlashcards = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!selectedNote || selectedNote.id !== id) {
        await fetchNoteDetail(id as string);
      }
      const cards = await generateFlashcards(id as string);
      setFlashcards(cards);
    } catch (err: any) {
      setError(err.message || 'Failed to generate flashcards');
    } finally {
      setLoading(false);
    }
  };

  const flipCard = () => {
    const toValue = isFlipped ? 0 : 1;
    Animated.spring(flipAnim, {
      toValue,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start(() => setIsFlipped(!isFlipped));
  };

  const advanceCard = (wasKnown: boolean) => {
    if (wasKnown) setKnown((k) => k + 1);
    else setReview((r) => r + 1);

    const next = currentIndex + 1;
    if (next >= flashcards.length) {
      setSessionDone(true);
    } else {
      setIsFlipped(false);
      flipAnim.setValue(0);
      setCurrentIndex(next);
    }
  };

  // Flip interpolations
  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Generating flashcards...</Text>
          <Text style={styles.loadingSubtext}>AI is extracting key concepts</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || flashcards.length === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <FontAwesome name="exclamation-circle" size={48} color={Colors.error} />
          <Text style={styles.loadingText}>{error || 'No concepts could be extracted.'}</Text>
          <TouchableOpacity style={styles.cyanBtn} onPress={() => router.back()}>
            <Text style={styles.cyanBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Session Complete ─────────────────────────────────────────────────────
  if (sessionDone) {
    return (
      <SafeAreaView style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        {/* Progress bar — full */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <FontAwesome name="times" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
          <Text style={styles.progressLabel}>{flashcards.length}/{flashcards.length}</Text>
        </View>

        <View style={styles.centered}>
          <View style={styles.completeIcon}>
            <FontAwesome name="check" size={28} color={Colors.success} />
          </View>
          <Text style={styles.completeTitle}>Session complete</Text>
          <Text style={styles.completeSubtitle}>
            You reviewed {flashcards.length} card{flashcards.length !== 1 ? 's' : ''}.
          </Text>

          <View style={styles.scoreRow}>
            <View style={styles.scoreCard}>
              <Text style={[styles.scoreValue, { color: Colors.success }]}>{known}</Text>
              <Text style={styles.scoreLabel}>KNOWN</Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={[styles.scoreValue, { color: Colors.warning }]}>{review}</Text>
              <Text style={styles.scoreLabel}>REVIEW</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.cyanBtn} onPress={() => router.back()}>
            <Text style={styles.cyanBtnText}>Back to note</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Active flashcard ─────────────────────────────────────────────────────
  const progress = (currentIndex + 1) / flashcards.length;
  const card = flashcards[currentIndex];

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top bar: X + progress track + counter */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <FontAwesome name="times" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          {currentIndex + 1}/{flashcards.length}
        </Text>
      </View>

      {/* Card flip area */}
      <View style={styles.cardArea}>
        <TouchableOpacity activeOpacity={1} onPress={!isFlipped ? flipCard : undefined} style={styles.cardTouchable}>
          {/* Question face */}
          <Animated.View
            style={[
              styles.card,
              { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] },
            ]}
          >
            <Text style={styles.cardBadge}>QUESTION</Text>
            <Text style={styles.cardQuestion}>{card.front}</Text>
            <Text style={styles.tapHint}>Tap to reveal</Text>
          </Animated.View>

          {/* Answer face */}
          <Animated.View
            style={[
              styles.card,
              styles.cardBack,
              { transform: [{ perspective: 1200 }, { rotateY: backRotate }] },
              { borderColor: Colors.primary + '60' },
            ]}
          >
            <Text style={[styles.cardBadge, { color: Colors.primary }]}>ANSWER</Text>
            <Text style={styles.cardAnswer}>{card.back}</Text>
            <Text style={styles.tapHint}>Swipe to review</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Review — amber outline pill */}
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={() => advanceCard(false)}
          activeOpacity={0.8}
        >
          <FontAwesome name="refresh" size={16} color={Colors.warning} />
          <Text style={[styles.controlBtnText, { color: Colors.warning }]}>Review</Text>
        </TouchableOpacity>

        {/* Known — green outline pill */}
        <TouchableOpacity
          style={styles.knownBtn}
          onPress={() => advanceCard(true)}
          activeOpacity={0.8}
        >
          <FontAwesome name="check" size={16} color={Colors.success} />
          <Text style={[styles.controlBtnText, { color: Colors.success }]}>Known</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const CARD_HEIGHT = Dimensions.get('window').height * 0.52;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    flexShrink: 0,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    flexShrink: 0,
    minWidth: 32,
    textAlign: 'right',
  },

  // Card flip
  cardArea: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
  },
  cardTouchable: {
    height: CARD_HEIGHT,
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: CARD_HEIGHT,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    backfaceVisibility: 'hidden',
    justifyContent: 'flex-end',
  },
  cardBack: {
    backgroundColor: Colors.surfaceElevated,
  },
  cardBadge: {
    position: 'absolute',
    top: Spacing.xl,
    left: Spacing.xl,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  cardQuestion: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    lineHeight: 34,
    marginBottom: Spacing.sm,
  },
  cardAnswer: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.regular,
    color: Colors.text,
    lineHeight: 26,
    marginBottom: Spacing.sm,
  },
  tapHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl + 10,
    gap: Spacing.md,
  },
  reviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + '10',
  },
  knownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.success,
    backgroundColor: Colors.success + '10',
  },
  controlBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },

  // Session complete
  completeIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.success + '40',
    marginBottom: Spacing.lg,
  },
  completeTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  completeSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  scoreCard: {
    width: 120,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: FontWeight.bold,
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  cyanBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  cyanBtnText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },

  // Loading
  loadingText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});
