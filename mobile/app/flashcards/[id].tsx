import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Animated, 
  Dimensions 
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotesStore, Flashcard } from '../../stores/notesStore';
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

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

  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadFlashcards();
  }, [id]);

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
      setError(err.message || "Failed to generate flashcards");
    } finally {
      setLoading(false);
    }
  };

  const flipCard = () => {
    Animated.timing(flipAnim, {
      toValue: isFlipped ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setIsFlipped(!isFlipped));
  };

  const nextCard = () => {
    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      flipAnim.setValue(0);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      flipAnim.setValue(0);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Generating intelligent flashcards...</Text>
        <Text style={styles.loadingSubtext}>AI is extracting key concepts</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadFlashcards}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (flashcards.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.errorText}>No concepts could be extracted.</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = (currentIndex + 1) / flashcards.length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, title: 'Flashcards' }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {selectedNote?.title || "Flashcards"}
        </Text>
        <View style={styles.spacer} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>
        {currentIndex + 1} of {flashcards.length}
      </Text>

      {/* Card Container */}
      <View style={styles.cardContainer}>
        <TouchableOpacity activeOpacity={1} onPress={flipCard} style={styles.cardWrapper}>
          
          {/* Front of Card */}
          <Animated.View style={[styles.card, styles.cardFront, frontAnimatedStyle]}>
            <LinearGradient
              colors={Colors.gradientCard}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.cardInner}>
              <View style={styles.cardBadge}>
                <Text style={styles.badgeText}>CONCEPT</Text>
              </View>
              <Text style={styles.cardTextFront}>
                {flashcards[currentIndex]?.front}
              </Text>
              <Text style={styles.tapInstruction}>Tap to reveal</Text>
            </View>
          </Animated.View>

          {/* Back of Card */}
          <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle]}>
            <LinearGradient
              colors={Colors.gradientPrimary}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.cardInner}>
              <View style={[styles.cardBadge, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
                <Text style={[styles.badgeText, { color: '#FFF' }]}>DEFINITION</Text>
              </View>
              <Text style={styles.cardTextBack}>
                {flashcards[currentIndex]?.back}
              </Text>
            </View>
          </Animated.View>

        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.actionPill, currentIndex === 0 && styles.navBtnDisabled]} 
          onPress={prevCard}
          disabled={currentIndex === 0}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.05)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
            <Ionicons name="refresh-outline" size={20} color={Colors.primaryLight} />
          </View>
          <Text style={[styles.actionPillText, { color: Colors.primaryLight }]}>Review</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionPill, currentIndex === flashcards.length - 1 && styles.navBtnDisabled]} 
          onPress={nextCard}
          disabled={currentIndex === flashcards.length - 1}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.05)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
            <Ionicons name="checkmark-outline" size={20} color={Colors.primaryLight} />
          </View>
          <Text style={[styles.actionPillText, { color: Colors.primaryLight }]}>Got It</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.md,
  },
  spacer: {
    width: 40,
  },
  progressContainer: {
    height: 4,
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  progressText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    width: '100%',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 400,
    height: 400,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.xl,
    position: 'absolute',
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
    ...Shadow.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardFront: {
    zIndex: 2,
  },
  cardBack: {
    zIndex: 1,
  },
  cardInner: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadge: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  badgeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cardTextFront: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 32,
  },
  cardTextBack: {
    fontSize: FontSize.md,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 28,
  },
  tapInstruction: {
    position: 'absolute',
    bottom: Spacing.lg,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  loadingText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  loadingSubtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  retryText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: 'white',
  },
});
