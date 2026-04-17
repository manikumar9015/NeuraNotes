import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { useNotesStore } from '@/stores/notesStore';

type CaptureMode = 'text' | 'url' | 'voice';

export default function CaptureScreen() {
  const [mode, setMode] = useState<CaptureMode>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const contentRef = useRef<TextInput>(null);

  const { createNote, importUrl } = useNotesStore();

  const modes = [
    { key: 'text' as const, icon: 'file-text-o' as const, label: 'Text', color: Colors.typeText },
    { key: 'url' as const, icon: 'link' as const, label: 'URL', color: Colors.typeUrl },
    { key: 'voice' as const, icon: 'microphone' as const, label: 'Voice', color: Colors.typeVoice },
  ];

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (mode === 'url') {
      if (!url.trim()) {
        Alert.alert('Error', 'Please enter a URL');
        return;
      }
      setSaving(true);
      try {
        await importUrl(url.trim(), tags);
        Alert.alert('Success', 'URL imported successfully!');
        resetForm();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to import URL');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content');
      return;
    }

    setSaving(true);
    try {
      await createNote({
        content: content.trim(),
        title: title.trim() || undefined,
        content_type: mode,
        tags,
      });
      Alert.alert('Success', 'Note captured! 🧠');
      resetForm();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setUrl('');
    setTags([]);
    setTagInput('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Mode Selector */}
        <View style={styles.modeRow}>
          {modes.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[
                styles.modeButton,
                mode === m.key && { backgroundColor: m.color + '25', borderColor: m.color },
              ]}
              onPress={() => setMode(m.key)}
              activeOpacity={0.7}
            >
              <FontAwesome
                name={m.icon}
                size={18}
                color={mode === m.key ? m.color : Colors.textMuted}
              />
              <Text
                style={[
                  styles.modeLabel,
                  mode === m.key && { color: m.color },
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* URL Input */}
        {mode === 'url' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>URL</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://example.com/article"
              placeholderTextColor={Colors.textMuted}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Voice Mode */}
        {mode === 'voice' && (
          <View style={styles.voiceSection}>
            <TouchableOpacity style={styles.voiceButton} activeOpacity={0.7}>
              <View style={styles.voiceCircle}>
                <FontAwesome name="microphone" size={32} color={Colors.text} />
              </View>
            </TouchableOpacity>
            <Text style={styles.voiceHint}>Tap to start recording</Text>
            <Text style={styles.voiceSubhint}>
              Voice notes will be transcribed automatically
            </Text>
          </View>
        )}

        {/* Text Mode */}
        {mode !== 'voice' && mode !== 'url' && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Title (optional)</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Give your note a title..."
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Content</Text>
              <TextInput
                ref={contentRef}
                style={[styles.input, styles.contentInput]}
                value={content}
                onChangeText={setContent}
                placeholder="Write your thoughts, paste content, or capture an idea..."
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>
                {content.length.toLocaleString()} characters
              </Text>
            </View>
          </>
        )}

        {/* Tags */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tags</Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.input, styles.tagInputField]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add a tag..."
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={addTag}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
              <FontAwesome name="plus" size={14} color={Colors.text} />
            </TouchableOpacity>
          </View>
          {tags.length > 0 && (
            <View style={styles.tagList}>
              {tags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.tagChip}
                  onPress={() => removeTag(tag)}
                >
                  <Text style={styles.tagText}>{tag}</Text>
                  <FontAwesome name="times" size={10} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <>
              <FontAwesome name="bolt" size={16} color={Colors.text} />
              <Text style={styles.saveButtonText}>
                {mode === 'url' ? 'Import URL' : 'Capture Note'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modeLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contentInput: {
    minHeight: 200,
    maxHeight: 400,
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tagInputField: {
    flex: 1,
  },
  addTagButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary + '25',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    fontWeight: FontWeight.medium,
  },
  voiceSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  voiceButton: {
    marginBottom: Spacing.lg,
  },
  voiceCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.typeVoice + '30',
    borderWidth: 3,
    borderColor: Colors.typeVoice,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHint: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  voiceSubhint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    ...Shadow.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
});
