import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { useNotesStore } from '@/stores/notesStore';
import { useAuthStore } from '@/stores/authStore';
import NoteCard from '@/components/NoteCard';

export default function HomeScreen() {
  const router = useRouter();
  const { notes, isLoading, total, fetchNotes } = useNotesStore();
  const user = useAuthStore((s) => s.user);
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotes(1);
    setRefreshing(false);
  }, []);

  const contentTypes = [
    { type: 'text', icon: 'file-text-o' as const, label: 'Text', color: Colors.typeText },
    { type: 'url', icon: 'link' as const, label: 'URL', color: Colors.typeUrl },
    { type: 'pdf', icon: 'file-pdf-o' as const, label: 'PDF', color: Colors.typePdf },
    { type: 'voice', icon: 'microphone' as const, label: 'Voice', color: Colors.typeVoice },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
    >
      {/* Welcome Section */}
      <View style={styles.welcomeCard}>
        <Text style={styles.greeting}>
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
        </Text>
        <Text style={styles.subtitle}>
          Your second brain has{' '}
          <Text style={styles.highlight}>{total}</Text> notes
        </Text>
      </View>

      {/* Daily Digest Teaser */}
      <TouchableOpacity 
        style={styles.digestCard} 
        activeOpacity={0.8}
        onPress={() => router.push('/digest')}
      >
        <View style={styles.digestIconBadge}>
           <FontAwesome name="sparkles" size={18} color={Colors.accentLight} />
        </View>
        <View style={styles.digestTextWrap}>
          <Text style={styles.digestTitle}>Daily Digest</Text>
          <Text style={styles.digestSub}>Review your intelligent 24h recap</Text>
        </View>
        <FontAwesome name="chevron-right" size={14} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* Quick Capture Buttons */}
      <Text style={styles.sectionTitle}>Quick Capture</Text>
      <View style={styles.quickCaptureRow}>
        {contentTypes.map((ct) => (
          <TouchableOpacity
            key={ct.type}
            style={[styles.captureButton, { borderColor: ct.color + '40' }]}
            onPress={() => router.push('/capture')}
            activeOpacity={0.7}
          >
            <View style={[styles.captureIconBg, { backgroundColor: ct.color + '20' }]}>
              <FontAwesome name={ct.icon} size={18} color={ct.color} />
            </View>
            <Text style={styles.captureLabel}>{ct.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Notes */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Notes</Text>
        <TouchableOpacity onPress={() => router.push('/all-notes')}>
          <Text style={styles.seeAll}>See all →</Text>
        </TouchableOpacity>
      </View>

      {isLoading && notes.length === 0 ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : notes.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="lightbulb-o" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Your brain is empty</Text>
          <Text style={styles.emptySubtitle}>
            Capture your first note to get started
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/capture')}
          >
            <Text style={styles.emptyButtonText}>+ Create Note</Text>
          </TouchableOpacity>
        </View>
      ) : (
        notes.slice(0, 10).map((note) => (
          <NoteCard key={note.id} note={note} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  welcomeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    ...Shadow.md,
  },
  greeting: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  highlight: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  digestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  digestIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  digestTextWrap: {
    flex: 1,
  },
  digestTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: 2,
  },
  digestSub: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  seeAll: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.md,
  },
  quickCaptureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  captureButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
  },
  captureIconBg: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  captureLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyButtonText: {
    color: Colors.text,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
  },
});
