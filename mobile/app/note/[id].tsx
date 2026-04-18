import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Markdown from 'react-native-markdown-display';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { useNotesStore } from '@/stores/notesStore';

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  text: { icon: 'file-text-o', color: Colors.typeText, label: 'Text Note' },
  url: { icon: 'link', color: Colors.typeUrl, label: 'Web Article' },
  pdf: { icon: 'file-pdf-o', color: Colors.typePdf, label: 'PDF Document' },
  voice: { icon: 'microphone', color: Colors.typeVoice, label: 'Voice Memo' },
  image: { icon: 'image', color: Colors.typeImage, label: 'Image' },
};

export default function NoteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { selectedNote, isLoading, fetchNoteDetail, clearSelectedNote } = useNotesStore();

  useEffect(() => {
    if (id) {
      fetchNoteDetail(id);
    }
    return () => clearSelectedNote();
  }, [id]);

  if (isLoading || !selectedNote) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const config = TYPE_CONFIG[selectedNote.content_type] || TYPE_CONFIG.text;
  const date = new Date(selectedNote.created_at).toLocaleDateString([], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Sleek Header Section without bulky borders */}
        <View style={styles.headerSection}>
          <View style={styles.topBadgesRow}>
            <View style={[styles.typeBadge, { backgroundColor: config.color + '15', borderColor: config.color + '30', borderWidth: 1 }]}>
              <FontAwesome name={config.icon} size={14} color={config.color} />
              <Text style={[styles.typeLabel, { color: config.color }]}>{config.label}</Text>
            </View>
            <Text style={styles.dateText}>{date}</Text>
          </View>

          <Text style={styles.title}>{selectedNote.title || 'Untitled Session'}</Text>

          {selectedNote.source_url && (
            <TouchableOpacity style={styles.urlPill} activeOpacity={0.8}>
              <View style={styles.urlIconCircle}>
                 <FontAwesome name="link" size={12} color={Colors.typeUrl} />
              </View>
              <Text style={styles.urlText} numberOfLines={1}>{selectedNote.source_url}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.tagsRow}>
            {selectedNote.tags?.map((tag: any) => (
              <View key={tag.id || tag.name} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag.name}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.wordCount}>{selectedNote.word_count} words</Text>
        </View>

        <View style={styles.separator} />

        {/* Beautiful Note Content */}
        <View style={styles.contentSection}>
          {selectedNote.content_type === 'pdf' && (
            <View style={styles.aiSummaryBox}>
              <View style={styles.aiSummaryIcon}>
                <FontAwesome name="magic" size={16} color={Colors.background} />
              </View>
              <Text style={styles.aiSummaryText}>AI is weaving a summary for this document...</Text>
            </View>
          )}
          <View style={styles.markdownWrapper}>
            <Markdown style={markdownStyles}>
              {selectedNote.content}
            </Markdown>
          </View>
        </View>

      </ScrollView>

      {/* Floating Glassmorphism-style Action Bar */}
      <View style={styles.floatingActionBar}>
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
          <View style={styles.actionIconPill}>
             <FontAwesome name="bolt" size={14} color={Colors.text} />
          </View>
          <Text style={styles.actionText}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton} 
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: '/flashcards/[id]', params: { id } })}
        >
          <View style={[styles.actionIconPill, { backgroundColor: Colors.accent + '30' }]}>
             <FontAwesome name="clone" size={14} color={Colors.accentLight} />
          </View>
          <Text style={styles.actionText}>Flashcards</Text>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120, // Space for floating bar
  },
  headerSection: {
    marginBottom: Spacing.lg,
  },
  topBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  typeLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: 'monospace',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  urlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    padding: Spacing.xs,
    paddingRight: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  urlIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlText: {
    fontSize: FontSize.sm,
    color: Colors.typeUrl,
    flexShrink: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tagChip: {
    backgroundColor: Colors.primaryDark + '30',
    borderWidth: 1,
    borderColor: Colors.primary + '50',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  wordCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  contentSection: {
    paddingBottom: Spacing.xl,
  },
  markdownWrapper: {
    backgroundColor: 'transparent',
  },
  aiSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent + '50',
    ...Shadow.md,
  },
  aiSummaryIcon: {
    backgroundColor: Colors.accent,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiSummaryText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '500',
    flex: 1,
  },
  floatingActionBar: {
    position: 'absolute',
    bottom: Spacing.xl,
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 30, 53, 0.85)', // Glassy dark
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Shadow.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  actionIconPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    color: '#D1D5DB', // Slightly brighter than muted
    fontSize: 16,
    lineHeight: 26,
  },
  heading1: { color: Colors.text, marginTop: Spacing.xl, marginBottom: Spacing.md, fontWeight: '800', fontSize: 26 },
  heading2: { color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.sm, fontWeight: '700', fontSize: 22 },
  heading3: { color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm, fontWeight: '600', fontSize: 18 },
  paragraph: { marginVertical: Spacing.sm },
  link: { color: Colors.typeUrl, textDecorationLine: 'underline', fontWeight: '500' },
  strong: { color: Colors.text, fontWeight: 'bold' },
  em: { fontStyle: 'italic', color: Colors.textSecondary },
  blockquote: {
    backgroundColor: Colors.surface,
    borderLeftColor: Colors.primary,
    borderLeftWidth: 4,
    padding: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  code_inline: {
    backgroundColor: Colors.surface,
    color: Colors.accentLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
  },
  code_block: {
    backgroundColor: '#000',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fence: {
    backgroundColor: '#000',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: Colors.textSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  list_item: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  bullet_list: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
});
