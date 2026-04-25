import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import ChatBubble from '@/components/ChatBubble';
import ChatHistoryDrawer from '@/components/ChatHistoryDrawer';

const SUGGESTIONS = [
  { emoji: '🟣', text: 'Summarize my recent notes' },
  { emoji: '🔵', text: "What's a topic I haven't explored yet?" },
];

const ACTION_CHIPS = [
  { emoji: '✦', label: 'For you' },
  { emoji: '📧', label: 'Draft email' },
  { emoji: '📅', label: 'Schedule event' },
  { emoji: '🧠', label: 'Help me learn' },
];

export default function ActiveChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const userName = useAuthStore((s) => s.user?.name?.split(' ')[0] || 'there');

  const {
    currentConversation,
    conversations,
    messages,
    isStreaming,
    streamingContent,
    streamingStatus,
    fetchConversations,
    createConversation,
    deleteConversation,
    sendMessage,
    setCurrentConversation,
    loadMessages,
    clearMessages,
  } = useChatStore();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (id === 'new') {
      clearMessages();
    } else if (id && id !== currentConversation) {
      setCurrentConversation(id);
      loadMessages(id);
    }
  }, [id]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming) return;
    setInput('');
    
    let targetId = id;
    if (id === 'new') {
      targetId = await createConversation();
      setCurrentConversation(targetId);
      router.replace(`/chat/${targetId}` as any);
    }
    
    if (targetId && targetId !== 'new') {
      await sendMessage(targetId, msg);
    }
  };

  const handleBack = () => {
    router.push('/(tabs)');
  };

  const handleSelectConversation = async (convId: string) => {
    setCurrentConversation(convId);
    await loadMessages(convId);
    setIsDrawerOpen(false);
    // Replace URL without pushing new screen to stack
    router.replace(`/chat/${convId}` as any);
  };

  const handleDeleteConversation = async (convId: string) => {
    await deleteConversation(convId);
    if (convId === id) {
      setIsDrawerOpen(false);
      router.replace(`/chat/new` as any);
    }
  };

  const handleNewChat = async () => {
    setIsDrawerOpen(false);
    router.replace(`/chat/new` as any);
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <FontAwesome name="arrow-left" size={16} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsDrawerOpen(true)} style={styles.menuBtn}>
            <FontAwesome name="bars" size={16} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.chatHeaderCenter}>
            <View style={styles.onlineDot} />
            <Text style={styles.chatTitle} numberOfLines={1}>
              NeuraNotes Agent
            </Text>
          </View>
          {/* Model Badge */}
          <View style={styles.modelBadge}>
            <FontAwesome name="bolt" size={10} color={Colors.warning} />
            <Text style={styles.modelText}>Llama 3.3</Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={[
            ...messages,
            ...(isStreaming && streamingContent 
              ? [{ 
                  id: 'streaming', 
                  role: 'assistant', 
                  content: streamingContent, 
                  created_at: new Date().toISOString() 
                }] 
              : [])
          ]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.chatEmptyContainer}>
              {/* Greeting */}
              <Text style={styles.greetingHi}>Hi {userName}</Text>
              <Text style={styles.greetingHeadline}>
                What should we try today?
              </Text>

              {/* Suggestion rows */}
              <View style={styles.suggestionsContainer}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s.text}
                    style={styles.suggestionRow}
                    onPress={() => handleSend(s.text)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionDot}>{s.emoji}</Text>
                    <Text style={styles.suggestionText}>{s.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action chips */}
              <View style={styles.chipsContainer}>
                {ACTION_CHIPS.map((c) => (
                  <TouchableOpacity
                    key={c.label}
                    style={styles.chip}
                    onPress={() => handleSend(c.label)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.chipEmoji}>{c.emoji}</Text>
                    <Text style={styles.chipLabel}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => <ChatBubble message={item as any} isStreaming={item.id === 'streaming'} onSend={handleSend} />}
        />

        {/* Streaming bar */}
        {isStreaming && (
          <View style={styles.streamingBar}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.streamingText}>{streamingStatus || 'Thinking...'}</Text>
          </View>
        )}

        {/* Spacer for floating input */}
        <View style={{ height: 80 }} />

        {/* Input Bar - Floating */}
        <View style={styles.inputBarWrapper}>
          <View style={styles.inputBar}>
            <TextInput
              style={[styles.chatInput, Platform.OS === 'web' ? { outlineStyle: 'none' } as any : null]}
              value={input}
              onChangeText={setInput}
              placeholder="Ask anything..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={10000}
              underlineColorAndroid="transparent"
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!input.trim() || isStreaming) && styles.sendBtnDisabled,
              ]}
              onPress={() => handleSend()}
              disabled={!input.trim() || isStreaming}
            >
              <FontAwesome name="arrow-up" size={16} color={Colors.textInverse} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Chat History Drawer */}
      <ChatHistoryDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        conversations={conversations}
        currentId={id as string}
        onSelect={handleSelectConversation}
        onDelete={handleDeleteConversation}
        onNewChat={handleNewChat}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  // Chat header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  chatTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  modelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warning + '20',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
  },
  modelText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: FontWeight.bold,
  },

  // Messages
  messageList: { padding: Spacing.md, paddingBottom: Spacing.lg },

  // Empty chat state
  chatEmptyContainer: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: Spacing.sm,
  },
  greetingHi: {
    fontSize: 22,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  greetingHeadline: {
    fontSize: 30,
    fontWeight: FontWeight.bold,
    lineHeight: 38,
    marginBottom: Spacing.xl,
    color: Colors.primary,
  },
  suggestionsContainer: {
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  suggestionDot: {
    fontSize: 14,
  },
  suggestionText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },

  // Streaming
  streamingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  streamingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  // Input bar
  inputBarWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 10 : 14,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 10,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.xs,
    backgroundColor: 'rgba(30, 30, 30, 0.85)',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  chatInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 10 : 6,
    paddingBottom: Platform.OS === 'ios' ? 10 : 6,
    color: Colors.text,
    fontSize: FontSize.md,
    maxHeight: 80,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 3,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
