import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { useNotesStore } from '@/stores/notesStore';
import NoteCard from '@/components/NoteCard';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const { searchResults, isSearching, searchNotes, clearSearch } = useNotesStore();
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setHasSearched(true);
    await searchNotes(query.trim());
  }, [query]);

  const handleClear = () => {
    setQuery('');
    setHasSearched(false);
    clearSearch();
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrapper}>
          <FontAwesome name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder='Search your brain... "What did I learn about RAG?"'
            placeholderTextColor={Colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <FontAwesome name="times-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchButton, !query.trim() && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={!query.trim() || isSearching}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color={Colors.text} />
          ) : (
            <FontAwesome name="bolt" size={16} color={Colors.text} />
          )}
        </TouchableOpacity>
      </View>

      {/* Hint */}
      <Text style={styles.hint}>
        🔮 Semantic search — ask in natural language
      </Text>

      {/* Results */}
      <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
        {isSearching ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Searching your knowledge base...</Text>
          </View>
        ) : hasSearched && searchResults.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="search" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>
              Try different keywords or capture more notes
            </Text>
          </View>
        ) : searchResults.length > 0 ? (
          <>
            <Text style={styles.resultCount}>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
            </Text>
            {searchResults.map((result, index) => (
              <View key={result.note_id} style={styles.resultCard}>
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
                <Text style={styles.resultContent} numberOfLines={4}>
                  {result.content_snippet}
                </Text>
                {result.tags.length > 0 && (
                  <View style={styles.resultTags}>
                    {result.tags.map((tag) => (
                      <Text key={tag} style={styles.resultTag}>#{tag}</Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <FontAwesome name="search" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Search your second brain</Text>
            <Text style={styles.emptySubtitle}>
              Ask anything — NeuraNotes understands meaning, not just keywords
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.md,
    paddingVertical: Spacing.md,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  results: {
    flex: 1,
  },
  resultsContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  resultCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontWeight: FontWeight.medium,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  resultHeader: {
    marginBottom: Spacing.sm,
  },
  resultTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
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
  resultContent: {
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
    color: Colors.primaryLight,
    fontWeight: FontWeight.medium,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  loadingText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
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
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
