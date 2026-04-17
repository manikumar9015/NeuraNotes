import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ note_id: string; title: string; similarity: number }>;
  created_at: string;
}

export default function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {/* Avatar */}
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🧠</Text>
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.content, isUser ? styles.userContent : styles.assistantContent]}>
          {message.content}
        </Text>

        {/* Source Citations */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <View style={styles.sourcesSection}>
            <View style={styles.sourcesDivider} />
            <Text style={styles.sourcesLabel}>
              <FontAwesome name="bookmark" size={10} color={Colors.textMuted} /> Sources
            </Text>
            {message.sources.map((source, i) => (
              <Text key={i} style={styles.sourceItem}>
                [{i + 1}] {source.title || 'Untitled note'}
              </Text>
            ))}
          </View>
        )}

        {/* Timestamp */}
        <Text style={[styles.time, isUser && styles.userTime]}>
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {isUser && <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  avatarText: {
    fontSize: 16,
  },
  spacer: {
    width: 40,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  content: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  userContent: {
    color: '#FFFFFF',
  },
  assistantContent: {
    color: Colors.text,
  },
  sourcesSection: {
    marginTop: Spacing.sm,
  },
  sourcesDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  sourcesLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  sourceItem: {
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    marginBottom: 2,
  },
  time: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  userTime: {
    color: 'rgba(255,255,255,0.6)',
  },
});
