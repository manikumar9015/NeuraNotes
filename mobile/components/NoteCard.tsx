import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { useNotesStore } from '@/stores/notesStore';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useRouter } from 'expo-router';

interface Note {
  id: string;
  title: string;
  content: string;
  content_type: string;
  source_url?: string;
  word_count: number;
  created_at: string;
  tags: Array<{ id: string; name: string; color: string }>;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  text: { icon: 'file-text-o', color: Colors.typeText },
  url: { icon: 'link', color: Colors.typeUrl },
  pdf: { icon: 'file-pdf-o', color: Colors.typePdf },
  voice: { icon: 'microphone', color: Colors.typeVoice },
  image: { icon: 'image', color: Colors.typeImage },
};

export default function NoteCard({ note }: { note: Note }) {
  const router = useRouter();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteNote } = useNotesStore();
  const config = TYPE_CONFIG[note.content_type] || TYPE_CONFIG.text;
  const date = new Date(note.created_at);
  const timeAgo = getTimeAgo(date);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteNote(note.id);
      setDialogVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to delete note');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } } as any)}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.typeBadge, { backgroundColor: config.color + '20' }]}>
            <FontAwesome name={config.icon} size={12} color={config.color} />
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                setDialogVisible(true);
              }}
              style={styles.deleteButton}
              activeOpacity={0.7}
            >
              <FontAwesome name="trash" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {note.title || 'Untitled'}
        </Text>

        {/* Display external URL if present */}
        {note.source_url && (
          <View style={styles.urlContainer}>
            <FontAwesome name="external-link" size={10} color={Colors.typeUrl} />
            <Text style={styles.urlText} numberOfLines={1}>{note.source_url}</Text>
          </View>
        )}

        {/* Content Preview */}
        <Text style={styles.contentPreview} numberOfLines={2}>
          {note.content}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          {note.tags && note.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {note.tags.slice(0, 3).map((tag) => (
                <Text key={tag.id || tag.name} style={styles.tag}>
                  #{tag.name}
                </Text>
              ))}
              {note.tags.length > 3 && (
                <Text style={styles.tagMore}>+{note.tags.length - 3}</Text>
              )}
            </View>
          )}
          <Text style={styles.wordCount}>{note.word_count} words</Text>
        </View>
      </TouchableOpacity>

      <ConfirmDialog
        visible={dialogVisible}
        title="Delete Note"
        message="Are you sure you want to delete this note? This action cannot be undone."
        confirmText={isDeleting ? "Deleting..." : "Delete"}
        onConfirm={handleDelete}
        onCancel={() => setDialogVisible(false)}
      />
    </>
  );
}


function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  deleteButton: {
    padding: Spacing.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  timeAgo: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  contentPreview: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flex: 1,
  },
  tag: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  tagMore: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  wordCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  urlText: {
    fontSize: FontSize.xs,
    color: Colors.typeUrl,
    flex: 1,
  },
});
