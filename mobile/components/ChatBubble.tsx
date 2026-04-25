import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, LayoutAnimation, UIManager, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import Markdown from 'react-native-markdown-display';
import { useChatStore } from '@/stores/chatStore';
import * as Clipboard from 'expo-clipboard';
import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ------------------------------------------------------------------ */
/*  DynamicForm — renders an interactive form inside a chat bubble     */
/* ------------------------------------------------------------------ */
interface FormField {
  name: string;
  placeholder: string;
  default?: string;
  type?: 'text' | 'select' | 'date';
  options?: string[]; // For 'select' type
  required?: boolean;
}
interface FormConfig {
  title?: string;
  submit_label?: string;
  fields: FormField[];
}

function DynamicForm({ config, messageId, onSubmit }: { config: FormConfig; messageId: string; onSubmit?: (text: string) => void }) {
  const { submittedForms, markFormSubmitted } = useChatStore();
  const formKey = `${messageId}-${config.title || 'form'}`;
  const isSubmitted = submittedForms[formKey] || false;

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(config.fields.map((f) => [f.name, f.default ?? (f.type === 'select' && f.options ? f.options[0] : '')])),
  );
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const handleSubmit = () => {
    if (isSubmitted || !onSubmit) return;
    
    // Validation
    const newErrors: Record<string, boolean> = {};
    let hasError = false;
    config.fields.forEach(f => {
      if (f.required !== false && !values[f.name]?.trim()) {
        newErrors[f.name] = true;
        hasError = true;
      }
    });

    if (hasError) {
      setErrors(newErrors);
      // Optional: Trigger haptic feedback or shake animation here
      return;
    }

    const parts = config.fields.map((f) => `${f.name}: ${values[f.name] || '(not provided)'}`);
    onSubmit(parts.join('\n'));
    markFormSubmitted(formKey);
  };

  return (
    <View style={formStyles.container}>
      {config.title && <Text style={formStyles.title}>{config.title}</Text>}
      {config.fields.map((field) => (
        <View key={field.name} style={formStyles.fieldRow}>
          <Text style={formStyles.fieldLabel}>{field.name} {field.required !== false ? '*' : ''}</Text>
          {field.type === 'select' && field.options ? (
            <View style={[formStyles.selectContainer, isSubmitted && formStyles.inputDisabled, errors[field.name] && formStyles.inputError]}>
              {/* Note: A real app would use a native Picker here. We simulate with wrap buttons for simplicity in ChatBubble */}
              <View style={formStyles.selectOptionsRow}>
                {field.options.map(opt => (
                  <TouchableOpacity 
                    key={opt}
                    style={[formStyles.selectOptBtn, values[field.name] === opt && formStyles.selectOptBtnActive]}
                    onPress={() => {
                      if (!isSubmitted) {
                        setValues(prev => ({ ...prev, [field.name]: opt }));
                        setErrors(prev => ({ ...prev, [field.name]: false }));
                      }
                    }}
                    activeOpacity={0.7}
                    disabled={isSubmitted}
                  >
                    <Text style={[formStyles.selectOptText, values[field.name] === opt && formStyles.selectOptTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <TextInput
              style={[formStyles.input, isSubmitted && formStyles.inputDisabled, errors[field.name] && formStyles.inputError]}
              placeholder={field.placeholder}
              placeholderTextColor={Colors.textMuted}
              value={values[field.name]}
              onChangeText={(t) => {
                setValues((prev) => ({ ...prev, [field.name]: t }));
                if (errors[field.name]) setErrors(prev => ({ ...prev, [field.name]: false }));
              }}
              editable={!isSubmitted}
            />
          )}
          {errors[field.name] && <Text style={formStyles.errorText}>Required field</Text>}
        </View>
      ))}
      <TouchableOpacity
        style={[formStyles.submitBtn, isSubmitted && formStyles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitted}
        activeOpacity={0.8}
      >
        <Text style={formStyles.submitText}>
          {isSubmitted ? '✓ Submitted' : config.submit_label || 'Submit'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const formStyles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  fieldRow: {
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputError: {
    borderColor: Colors.error || '#EF4444',
  },
  errorText: {
    color: Colors.error || '#EF4444',
    fontSize: 10,
    marginTop: 4,
  },
  selectContainer: {
    marginTop: 2,
  },
  selectOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  selectOptBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  selectOptBtnActive: {
    backgroundColor: Colors.primary + '30',
    borderColor: Colors.primary,
  },
  selectOptText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  selectOptTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.success,
    opacity: 0.7,
  },
  submitText: {
    color: Colors.textInverse,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
});

/* ------------------------------------------------------------------ */
/*  CollapsibleTrace — Agent Execution Trace Accordion                 */
/* ------------------------------------------------------------------ */
function CollapsibleTrace({ tasks }: { tasks: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const isAllCompleted = completedCount === tasks.length;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.subtasksSection}>
      <View style={styles.sourcesDivider} />
      <TouchableOpacity onPress={toggleExpand} style={styles.traceHeader} activeOpacity={0.7}>
        <Text style={styles.sourcesLabel}>
          <FontAwesome name="cogs" size={10} color={Colors.textMuted} /> Agent thinking ({completedCount}/{tasks.length} steps)
        </Text>
        <FontAwesome name={expanded ? "chevron-up" : "chevron-down"} size={10} color={Colors.textMuted} />
      </TouchableOpacity>
      
      {expanded && (
        <View style={styles.traceContent}>
          {tasks.map((task: any, i: number) => (
            <View key={i} style={styles.taskItem}>
              <Text style={styles.taskName}>
                <FontAwesome 
                  name={task.status === 'completed' ? 'check-circle' : 'circle-o'} 
                  size={10} 
                  color={task.status === 'completed' ? Colors.success : Colors.textMuted} 
                /> {task.name || task.description || 'Task'}
              </Text>
              {task.result && (
                <Text style={styles.taskResult} numberOfLines={2}>
                  └ {typeof task.result === 'string' ? task.result.substring(0, 100) : 'Task output processed'}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ note_id: string; title: string; similarity: number }>;
  subtasks?: Array<any>;
  created_at: string;
}

export default function ChatBubble({ message, isStreaming = false, onSend }: { message: Message; isStreaming?: boolean; onSend?: (text: string) => void }) {
  const isUser = message.role === 'user';

  /* Custom markdown rules — intercept ```form blocks */
  const customRules = {
    fence: (node: any, children: any, parent: any, mdStyles: any) => {
      const info = (node.sourceInfo || '').trim();
      const content = node.content || '';
      if (info === 'form') {
        try {
          const config: FormConfig = JSON.parse(content);
          return <DynamicForm key={node.key} config={config} messageId={message.id} onSubmit={onSend} />;
        } catch {
          // If parse fails, fall through to normal code block
        }
      }
      // Default code block rendering with Copy button
      const copyCode = () => {
        Clipboard.setStringAsync(content);
      };

      return (
        <View key={node.key} style={styles.codeBlockContainer}>
          <View style={styles.codeBlockHeader}>
            <Text style={styles.codeBlockLang}>{info || 'code'}</Text>
            <TouchableOpacity onPress={copyCode} style={styles.copyBtn} activeOpacity={0.7}>
              <FontAwesome name="copy" size={12} color={Colors.textMuted} />
              <Text style={styles.copyBtnText}>Copy</Text>
            </TouchableOpacity>
          </View>
          <SyntaxHighlighter 
            language={info || 'text'} 
            style={atomOneDark} 
            customStyle={{ padding: Spacing.md, margin: 0, backgroundColor: 'transparent' }}
            fontSize={FontSize.sm}
          >
            {content}
          </SyntaxHighlighter>
        </View>
      );
    },
  };

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      {/* Avatar */}
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>✦</Text>
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        
        {/* Message Content */}
        {isUser ? (
          <Text style={[styles.content, styles.userContent]}>
            {message.content}
          </Text>
        ) : (
          <Markdown style={markdownStyles} rules={customRules}>
            {message.content + (isStreaming ? ' █' : '')}
          </Markdown>
        )}

        {/* Agent Thought Process (Execution Trace) */}
        {!isUser && message.subtasks && message.subtasks.length > 0 && (
          <CollapsibleTrace tasks={message.subtasks} />
        )}

        {/* Source Citations */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <View style={styles.sourcesSection}>
            <View style={styles.sourcesDivider} />
            <Text style={styles.sourcesLabel}>
              <FontAwesome name="bookmark" size={10} color={Colors.textMuted} /> Sources
            </Text>
            <View style={styles.sourcesPillsContainer}>
              {message.sources.map((source, i) => (
                <TouchableOpacity key={i} style={styles.sourcePill} activeOpacity={0.7}>
                  <Text style={styles.sourcePillText}>
                    🔖 {source.title || 'Untitled note'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}


      </View>

      {isUser && <View style={styles.spacer} />}
    </View>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    color: Colors.text,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  strong: {
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  em: {
    fontStyle: 'italic',
  },
  code_inline: {
    borderWidth: 0,
    backgroundColor: 'rgba(0,229,255,0.08)',
    color: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 0,
    marginHorizontal: 2,
    fontFamily: 'SpaceMono',
    fontSize: FontSize.sm,
    overflow: 'hidden',
  },
  code_block: {
    backgroundColor: Colors.background,
    color: Colors.textSecondary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontFamily: 'SpaceMono',
    marginVertical: Spacing.sm,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderColor: Colors.primary,
    paddingLeft: Spacing.md,
    marginLeft: 0,
    marginVertical: Spacing.sm,
    opacity: 0.8,
    backgroundColor: 'transparent',
  },
  bullet_list: {
    marginBottom: Spacing.sm,
  },
});

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
    fontSize: 18,
    color: Colors.primary,
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
    borderTopRightRadius: 4,
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
    color: Colors.textInverse,
    fontWeight: FontWeight.medium,
  },
  subtasksSection: {
    marginTop: Spacing.md,
    backgroundColor: Colors.background + '80',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  taskItem: {
    marginBottom: Spacing.xs,
  },
  taskName: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  taskResult: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginLeft: 14,
    marginTop: 2,
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
  },
  traceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  traceContent: {
    marginTop: Spacing.xs,
  },
  sourcesPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  sourcePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  sourcePillText: {
    fontSize: FontSize.xs,
    color: Colors.text,
  },

  codeBlockContainer: {
    marginVertical: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  codeBlockLang: {
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: FontWeight.bold,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  copyBtnText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});
