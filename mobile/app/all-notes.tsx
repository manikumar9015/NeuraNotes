import React, { useEffect } from 'react';
import { View, StyleSheet, FlatList, Text, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors, Spacing, FontSize, FontWeight } from '@/constants/theme';
import { useNotesStore } from '@/stores/notesStore';
import NoteCard from '@/components/NoteCard';

export default function AllNotesScreen() {
  const { notes, isLoading, fetchNotes } = useNotesStore();
  const router = useRouter();

  // Optionally fetch notes on mount just to be sure we have latest,
  // but it's likely already loaded by the home screen
  useEffect(() => {
    fetchNotes();
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerTitle: 'All Notes',
          headerBackTitleVisible: false,
        }} 
      />

      {notes.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <FontAwesome name="folder-open-o" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No notes found</Text>
          <Text style={styles.emptySubtitle}>
            Capture concepts to start building your second brain.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/capture')}
          >
            <Text style={styles.emptyButtonText}>+ Create Note</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NoteCard note={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    flex: 1,
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
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 9999, // full
  },
  emptyButtonText: {
    color: Colors.text,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.md,
  },
});
