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
import * as DocumentPicker from 'expo-document-picker';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

type CaptureMode = 'text' | 'url' | 'pdf' | 'voice';

export default function CaptureScreen() {
  const [mode, setMode] = useState<CaptureMode>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<{ uri: string; name: string } | null>(null);
  const contentRef = useRef<TextInput>(null);

  const { createNote, importUrl, importPdf, importVoice } = useNotesStore();
  const { isRecording, duration, recordingUri, startRecording, stopRecording, resetRecorder } = useVoiceRecorder();

  const modes = [
    { key: 'text' as const, icon: 'file-text-o' as const, label: 'Text', color: Colors.typeText },
    { key: 'url' as const, icon: 'link' as const, label: 'URL', color: Colors.typeUrl },
    { key: 'pdf' as const, icon: 'file-pdf-o' as const, label: 'PDF', color: Colors.typePdf },
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
        await importUrl(url.trim(), tags, content.trim() || undefined);
        Alert.alert('Success', 'URL imported successfully!');
        resetForm();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to import URL');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (mode === 'pdf') {
      if (!selectedPdf) {
        Alert.alert('Error', 'Please select a PDF file first');
        return;
      }
      setSaving(true);
      try {
        await importPdf(selectedPdf.uri, selectedPdf.name, tags);
        Alert.alert('Success', 'PDF imported successfully! 📄');
        resetForm();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to import PDF');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (mode === 'voice') {
      if (!recordingUri) {
        Alert.alert('Error', 'Please record a voice note first');
        return;
      }
      setSaving(true);
      try {
        const filename = `recording_${new Date().getTime()}.m4a`;
        await importVoice(recordingUri, filename, tags);
        Alert.alert('Success', 'Voice note uploaded and transcribing! 🎙️');
        resetForm();
        resetRecorder();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to upload voice recording');
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
    setSelectedPdf(null);
  };

  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedPdf({ uri: asset.uri, name: asset.name });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick file');
    }
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
          <>
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
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                value={content}
                onChangeText={setContent}
                placeholder="Add context or notes about this link..."
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
              />
            </View>
          </>
        )}

        {/* Voice Mode */}
        {mode === 'voice' && (
          <View style={styles.voiceSection}>
            <TouchableOpacity 
              style={styles.voiceButton} 
              activeOpacity={0.7}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <View style={[
                styles.voiceCircle, 
                isRecording && { backgroundColor: Colors.error + '30', borderColor: Colors.error }
              ]}>
                <FontAwesome 
                  name={isRecording ? 'stop' : 'microphone'} 
                  size={32} 
                  color={isRecording ? Colors.error : Colors.text} 
                />
              </View>
            </TouchableOpacity>
            
            <Text style={styles.voiceHint}>
              {isRecording ? 'Tap to stop recording' : recordingUri ? 'Recording ready' : 'Tap to start recording'}
            </Text>
            
            {isRecording && (
              <Text style={styles.durationText}>
                {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
              </Text>
            )}

            {!isRecording && recordingUri && (
              <TouchableOpacity style={styles.retakeButton} onPress={resetRecorder}>
                <FontAwesome name="refresh" size={14} color={Colors.textMuted} />
                <Text style={styles.retakeText}>Retake Recording</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.voiceSubhint}>
              Voice notes will be transcribed automatically
            </Text>
          </View>
        )}

        {/* PDF Mode */}
        {mode === 'pdf' && (
          <View style={styles.pdfSection}>
            <TouchableOpacity
              style={[styles.pdfPickerButton, selectedPdf && styles.pdfPickerButtonSelected]}
              onPress={handlePickPdf}
              activeOpacity={0.7}
            >
              <View style={styles.pdfIconCircle}>
                <FontAwesome
                  name={selectedPdf ? 'check-circle' : 'file-pdf-o'}
                  size={32}
                  color={selectedPdf ? Colors.success : Colors.typePdf}
                />
              </View>
              {selectedPdf ? (
                <>
                  <Text style={styles.pdfFilename} numberOfLines={2}>{selectedPdf.name}</Text>
                  <Text style={styles.pdfChangeHint}>Tap to change file</Text>
                </>
              ) : (
                <>
                  <Text style={styles.pdfHint}>Tap to choose a PDF</Text>
                  <Text style={styles.pdfSubhint}>Max 10MB · Text will be extracted and indexed</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Text Mode */}
        {mode !== 'voice' && mode !== 'url' && mode !== 'pdf' && (
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
                {mode === 'url' ? 'Import URL' : mode === 'pdf' ? 'Import PDF' : 'Capture Note'}
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
  durationText: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.error,
    marginBottom: Spacing.md,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  retakeText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
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
  // PDF Mode
  pdfSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  pdfPickerButton: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 2,
    borderColor: Colors.typePdf + '40',
    borderStyle: 'dashed',
    gap: Spacing.sm,
  },
  pdfPickerButtonSelected: {
    borderColor: Colors.success + '80',
    backgroundColor: Colors.success + '10',
  },
  pdfIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.typePdf + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  pdfHint: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  pdfSubhint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  pdfFilename: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    textAlign: 'center',
  },
  pdfChangeHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
