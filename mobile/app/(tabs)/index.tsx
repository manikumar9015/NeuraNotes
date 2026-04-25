import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useNotesStore } from '@/stores/notesStore';
import { useAuthStore } from '@/stores/authStore';

// Content type badge config
const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  text: { label: 'TEXT', icon: 'file-text-o', color: Colors.primary },
  url: { label: 'URL', icon: 'link', color: Colors.primary },
  pdf: { label: 'PDF', icon: 'file-pdf-o', color: Colors.accent },
  voice: { label: 'VOICE', icon: 'microphone', color: Colors.primary },
};

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.text;
  return (
    <View style={[styles.typeBadge, { borderColor: cfg.color + '60' }]}>
      <FontAwesome name={cfg.icon as any} size={10} color={cfg.color} />
      <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function NoteCard({ note }: { note: any }) {
  const router = useRouter();
  const dateStr = note.created_at
    ? new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';
  const tags: any[] = note.tags || [];

  return (
    <TouchableOpacity
      style={styles.noteCard}
      activeOpacity={0.75}
      onPress={() => router.push(`/note/${note.id}` as any)}
    >
      <View style={styles.noteCardHeader}>
        <TypeBadge type={note.content_type} />
        <Text style={styles.noteDate}>{dateStr}</Text>
      </View>
      <Text style={styles.noteTitle} numberOfLines={2}>
        {note.title || 'Untitled'}
      </Text>
      <Text style={styles.noteSnippet} numberOfLines={3}>
        {note.content}
      </Text>
      {tags.length > 0 && (
        <View style={styles.tagsRow}>
          {tags.slice(0, 2).map((t: any) => (
            <View key={t.id || t.name} style={[styles.tag, { backgroundColor: (t.color || Colors.primary) + '20' }]}>
              <View style={[styles.tagDot, { backgroundColor: t.color || Colors.primary }]} />
              <Text style={[styles.tagText, { color: t.color || Colors.primary }]}>
                {t.name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

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

  const firstName = user?.name?.split(' ')[0] || 'there';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Static stats from data
  const stats = [
    { label: 'NOTES', value: total, icon: 'file-text-o', color: Colors.primary },
    { label: 'CARDS', value: 318, icon: 'clone', color: Colors.warning },
    { label: 'STREAK', value: '17', suffix: 'd', icon: 'fire', color: Colors.accent },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header — greeting + avatar */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.userName}>{firstName}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={() => router.push('/(tabs)/profile')}
          >
            {user?.avatar_url ? (
              // If we eventually have an Image component imported:
              // <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
              <Text style={styles.avatarInitial}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <Text style={styles.avatarInitial}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* "Ask your Second Brain" promo card */}
        <TouchableOpacity
          style={styles.promoCard}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/chat')}
        >
          <View style={styles.promoIconRow}>
            <View style={styles.promoIconBadge}>
              <FontAwesome name="bolt" size={14} color={Colors.primary} />
            </View>
            <Text style={styles.promoLabel}>ASK YOUR SECOND BRAIN</Text>
          </View>
          <Text style={styles.promoText}>
            What did I learn about{' '}
            <Text style={styles.promoCyan}>spaced repetition</Text>
            {'\n'}last week?
          </Text>
          <View style={styles.promoButton}>
            <Text style={styles.promoButtonText}>Open chat →</Text>
          </View>
        </TouchableOpacity>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <FontAwesome name={s.icon as any} size={20} color={s.color} />
              <Text style={styles.statValue}>
                {s.value}
                {s.suffix && <Text style={[styles.statSuffix, { color: s.color }]}>{s.suffix}</Text>}
              </Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Recent Notes */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent notes</Text>
          <TouchableOpacity onPress={() => router.push('/all-notes' as any)}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {isLoading && notes.length === 0 ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : notes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🧠</Text>
            <Text style={styles.emptyTitle}>Your brain is empty</Text>
            <Text style={styles.emptySubtitle}>Capture your first note to get started</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/capture')}
            >
              <Text style={styles.emptyButtonText}>+ Capture Note</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.notesGrid}>
            {notes.slice(0, 10).map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </View>
        )}
      </ScrollView>
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
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  greeting: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.regular,
  },
  userName: {
    fontSize: 34,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    lineHeight: 40,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '60',
    overflow: 'hidden',
  },
  avatarInitial: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  avatarImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },

  // Promo card
  promoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  promoIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  promoIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  promoLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  promoText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    lineHeight: 28,
    marginBottom: Spacing.md,
  },
  promoCyan: {
    color: Colors.primary,
  },
  promoButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    alignSelf: 'flex-start',
  },
  promoButtonText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.sm,
    lineHeight: 30,
  },
  statSuffix: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.5,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  seeAll: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // 2-column notes grid
  notesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },

  // Note card — half-width
  noteCard: {
    width: '48.5%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 160,
  },
  noteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.primary + '10',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  noteDate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  noteTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
    lineHeight: 20,
  },
  noteSnippet: {
    fontSize: FontSize.xs + 1,
    color: Colors.textSecondary,
    lineHeight: 17,
    flex: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: Spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  tagDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tagText: {
    fontSize: 10,
    fontWeight: FontWeight.medium,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyButtonText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
});
