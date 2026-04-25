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
  SafeAreaView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useNotesStore } from '@/stores/notesStore';
import * as DocumentPicker from 'expo-document-picker';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

type CaptureMode = 'text' | 'url' | 'pdf' | 'voice';

const MODES: { key: CaptureMode; icon: string; label: string }[] = [
  { key: 'text', icon: 'file-text-o', label: 'Text' },
  { key: 'url', icon: 'link', label: 'URL' },
  { key: 'pdf', icon: 'hand-grab-o', label: 'PDF' },
  { key: 'voice', icon: 'microphone', label: 'Voice' },
];

export default function CaptureScreen() {
  const [mode, setMode] = useState<CaptureMode>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<{ uri: string; name: string } | null>(null);

  const { createNote, importUrl, importPdf, importVoice } = useNotesStore();
  const { isRecording, duration, recordingUri, startRecording, stopRecording, resetRecorder } =
    useVoiceRecorder();

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const resetForm = () => {
    setTitle('');
    setContent('');
    setUrl('');
    setTags([]);
    setTagInput('');
    setSelectedPdf(null);
  };

  const handleSave = async () => {
    if (mode === 'url') {
      if (!url.trim()) { Alert.alert('Error', 'Please enter a URL'); return; }
      setSaving(true);
      try {
        await importUrl(url.trim(), tags);
        Alert.alert('Captured!', 'URL imported successfully ✓');
        resetForm();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to import URL');
      } finally { setSaving(false); }
      return;
    }
    if (mode === 'pdf') {
      if (!selectedPdf) { Alert.alert('Error', 'Please select a PDF file first'); return; }
      setSaving(true);
      try {
        await importPdf(selectedPdf.uri, selectedPdf.name, tags);
        Alert.alert('Captured!', 'PDF imported successfully ✓');
        resetForm();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to import PDF');
      } finally { setSaving(false); }
      return;
    }
    if (mode === 'voice') {
      if (!recordingUri) { Alert.alert('Error', 'Please record a voice note first'); return; }
      setSaving(true);
      try {
        await importVoice(recordingUri, `recording_${Date.now()}.m4a`, tags);
        Alert.alert('Captured!', 'Voice note uploading and transcribing 🎙️');
        resetForm();
        resetRecorder();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to upload voice note');
      } finally { setSaving(false); }
      return;
    }
    // Text mode
    if (!content.trim()) { Alert.alert('Error', 'Please enter some content'); return; }
    setSaving(true);
    try {
      await createNote({ content: content.trim(), title: title.trim() || undefined, content_type: mode, tags });
      Alert.alert('Captured!', 'Note saved to your second brain 🧠');
      resetForm();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save note');
    } finally { setSaving(false); }
  };

  const handlePickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.length > 0) {
        const asset = res.assets[0];
        setSelectedPdf({ uri: asset.uri, name: asset.name });
      }
    } catch {
      Alert.alert('Error', 'Could not pick file');
    }
  };

  const durationStr = `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Text style={styles.eyebrow}>CAPTURE HUB</Text>
          <Text style={styles.heading}>Drop knowledge{'\n'}into your brain</Text>

          {/* Mode Selector — pill tabs */}
          <View style={styles.modeBar}>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeTab, mode === m.key && styles.modeTabActive]}
                onPress={() => setMode(m.key)}
                activeOpacity={0.7}
              >
                <FontAwesome
                  name={m.icon as any}
                  size={14}
                  color={mode === m.key ? Colors.textInverse : Colors.textMuted}
                />
                <Text style={[styles.modeTabText, mode === m.key && styles.modeTabTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── TEXT mode ── */}
          {mode === 'text' && (
            <View style={styles.panel}>
              <Text style={styles.panelLabel}>MARKDOWN NOTE</Text>
              <TextInput
                style={styles.textArea}
                value={content}
                onChangeText={setContent}
                placeholder={'# Start typing...\n\nSupports **bold**, *italic*, `code`, lists'}
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
                maxLength={50000}
              />
              {/* Mini markdown toolbar */}
              <View style={styles.mdToolbar}>
                {['#', '**', '-', '`'].map((sym) => (
                  <TouchableOpacity
                    key={sym}
                    style={styles.mdBtn}
                    onPress={() => setContent((c) => c + sym)}
                  >
                    <Text style={styles.mdBtnText}>{sym}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── URL mode ── */}
          {mode === 'url' && (
            <View style={styles.panel}>
              <Text style={styles.panelLabel}>IMPORT ARTICLE FROM URL</Text>
              <View style={styles.urlInputRow}>
                <FontAwesome name="globe" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.urlInput}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://example.com/great-article"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
              <Text style={styles.panelHint}>
                We'll scrape, clean and chunk the content for semantic search.
              </Text>
            </View>
          )}

          {/* ── PDF mode ── */}
          {mode === 'pdf' && (
            <TouchableOpacity
              style={[styles.panel, styles.pdfDropzone]}
              onPress={handlePickPdf}
              activeOpacity={0.7}
            >
              <View style={styles.pdfIconCircle}>
                <FontAwesome
                  name={selectedPdf ? 'check' : 'cloud-upload'}
                  size={28}
                  color={Colors.primary}
                />
              </View>
              <Text style={styles.pdfTitle}>{selectedPdf ? selectedPdf.name : 'Upload a PDF'}</Text>
              <Text style={styles.pdfSub}>{selectedPdf ? 'Tap to change file' : 'Tap to browse — max 25MB'}</Text>
              {!selectedPdf && (
                <View style={styles.pdfBadgeRow}>
                  <View style={styles.pdfBadge}><Text style={styles.pdfBadgeText}>.pdf</Text></View>
                  <View style={styles.pdfBadge}><Text style={styles.pdfBadgeText}>OCR enabled</Text></View>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* ── VOICE mode ── */}
          {mode === 'voice' && (
            <View style={[styles.panel, styles.voicePanel]}>
              <Text style={styles.panelLabel}>VOICE MEMO</Text>
              {/* Waveform visualizer (static bars) */}
              <View style={styles.waveform}>
                {Array.from({ length: 22 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: isRecording
                          ? Math.random() * 24 + 4
                          : 8,
                        backgroundColor: isRecording ? Colors.primary : Colors.textMuted,
                        opacity: isRecording ? 1 : 0.3,
                      },
                    ]}
                  />
                ))}
              </View>

              {isRecording && (
                <Text style={styles.durationText}>{durationStr}</Text>
              )}

              <Text style={styles.voiceHint}>
                {isRecording
                  ? 'Tap to stop recording'
                  : recordingUri
                  ? 'Recording ready ✓'
                  : 'Tap to start recording'}
              </Text>

              <TouchableOpacity
                style={[styles.voiceMicBtn, isRecording && styles.voiceMicBtnActive]}
                onPress={isRecording ? stopRecording : startRecording}
                activeOpacity={0.8}
              >
                <FontAwesome
                  name={isRecording ? 'stop' : 'microphone'}
                  size={26}
                  color={isRecording ? Colors.error : Colors.textInverse}
                />
              </TouchableOpacity>

              {!isRecording && recordingUri && (
                <TouchableOpacity style={styles.retakeBtn} onPress={resetRecorder}>
                  <FontAwesome name="refresh" size={12} color={Colors.textMuted} />
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Capture Button */}
          <TouchableOpacity
            style={[styles.captureBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <>
                <Text style={styles.captureIcon}>✦</Text>
                <Text style={styles.captureBtnText}>Capture</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

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
    fontSize: 30,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.lg,
    lineHeight: 36,
  },

  // Mode selector — pill bar
  modeBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    padding: 4,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  modeTabActive: {
    backgroundColor: Colors.primary,
  },
  modeTabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
  },
  modeTabTextActive: {
    color: Colors.textInverse,
  },

  // Common panel
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  panelLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  panelHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },

  // Text mode
  textArea: {
    color: Colors.text,
    fontSize: FontSize.md,
    minHeight: 220,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  mdToolbar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mdBtn: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mdBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // URL mode
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  urlInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 8,
  },

  // PDF mode
  pdfDropzone: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    borderStyle: 'dashed',
    borderColor: Colors.textMuted + '40',
  },
  pdfIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    marginBottom: Spacing.md,
  },
  pdfTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  pdfSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  pdfBadgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pdfBadge: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pdfBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },

  // Voice mode
  voicePanel: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 40,
    marginBottom: Spacing.md,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  durationText: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.error,
    marginBottom: Spacing.sm,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  voiceHint: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  voiceMicBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  voiceMicBtnActive: {
    backgroundColor: Colors.error + '30',
    borderWidth: 2,
    borderColor: Colors.error,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retakeText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },

  // Capture Button — full-width cyan pill
  captureBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  captureIcon: {
    fontSize: 18,
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
  },
  captureBtnText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textInverse,
    letterSpacing: 0.3,
  },
});
