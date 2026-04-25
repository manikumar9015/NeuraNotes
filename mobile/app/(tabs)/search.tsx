import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useNotesStore } from '@/stores/notesStore';

const SUGGESTIONS = [
  'second brain systems',
  'weekly review wins',
  'reinforcement learning',
  'product strategy retrieval',
  'morning ideas flashcards',
];

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { searchResults, isSearching, searchNotes, clearSearch } = useNotesStore();
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (q?: string) => {
    const toSearch = q ?? query;
    if (!toSearch.trim()) return;
    setQuery(toSearch);
    setHasSearched(true);
    await searchNotes(toSearch.trim());
  }, [query]);

  const handleClear = () => {
    setQuery('');
    setHasSearched(false);
    clearSearch();
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.eyebrow}>SEMANTIC SEARCH</Text>
        <Text style={styles.heading}>Find any thought</Text>

        {/* Search input */}
        <View style={styles.searchWrapper}>
          <FontAwesome name="search" size={18} color={Colors.primary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Ask about anything you've captured..."
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => handleSearch()}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
              <FontAwesome name="times" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Suggestions — shown when no results yet */}
        {!hasSearched && (
          <>
            <Text style={styles.suggestLabel}>TRY SEARCHING</Text>
            <View style={styles.suggestGrid}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestChip}
                  onPress={() => handleSearch(s)}
                  activeOpacity={0.7}
                >
                  <FontAwesome name="bolt" size={11} color={Colors.primary} />
                  <Text style={styles.suggestText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Empty state visual */}
            <View style={styles.emptyVisual}>
              <View style={styles.emptyIconCircle}>
                <FontAwesome name="binoculars" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Your memory, at the speed of thought</Text>
              <Text style={styles.emptySubtitle}>
                Vector search ranks every note by meaning, not just keywords.
              </Text>
            </View>
          </>
        )}

        {/* Loading */}
        {isSearching && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Searching your knowledge base...</Text>
          </View>
        )}

        {/* Results */}
        {!isSearching && hasSearched && searchResults.length === 0 && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No results for "{query}"</Text>
            <Text style={styles.noResultsSub}>Try different keywords or capture more notes</Text>
          </View>
        )}

        {!isSearching && searchResults.length > 0 && (
          <>
            <Text style={styles.resultCount}>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
            </Text>
            {searchResults.map((result) => (
              <TouchableOpacity
                key={result.note_id}
                style={styles.resultCard}
                activeOpacity={0.75}
                onPress={() => router.push(`/note/${result.note_id}` as any)}
              >
                <View style={styles.resultHeader}>
                  <View style={styles.resultTitleRow}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {result.title || 'Untitled'}
                    </Text>
                    <View style={styles.similarityBadge}>
                      <Text style={styles.similarityText}>
                        {Math.round(result.similarity * 100)}%
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.resultMeta}>
                    {result.content_type} · {new Date(result.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.resultSnippet} numberOfLines={4}>
                  {result.content_snippet}
                </Text>
                {result.tags.length > 0 && (
                  <View style={styles.resultTags}>
                    {result.tags.map((tag) => (
                      <Text key={tag} style={styles.resultTag}>
                        #{tag}
                      </Text>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </>
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
  container: { flex: 1 },
  content: {
    padding: Spacing.md,
    paddingBottom: 100,
  },

  // Header
  eyebrow: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 1.4,
    marginBottom: 4,
    marginTop: Spacing.sm,
  },
  heading: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },

  // Search bar
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary + '50',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    height: 52,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: Spacing.xs,
  },

  // Suggestions
  suggestLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  suggestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },

  // Empty visual
  emptyVisual: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xl,
  },

  // Loading
  loadingState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },

  // No results
  noResults: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  noResultsText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  noResultsSub: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Results
  resultCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.md,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultHeader: { marginBottom: Spacing.sm },
  resultTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  similarityBadge: {
    backgroundColor: Colors.success + '25',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  similarityText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: FontWeight.bold,
  },
  resultMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  resultSnippet: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  resultTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  resultTag: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
});
