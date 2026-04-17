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
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { useChatStore } from '@/stores/chatStore';
import ChatBubble from '@/components/ChatBubble';

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const {
    conversations,
    currentConversation,
    messages,
    isLoading,
    isStreaming,
    fetchConversations,
    createConversation,
    loadMessages,
    sendMessage,
    setCurrentConversation,
  } = useChatStore();

  const [showConversationList, setShowConversationList] = useState(true);

  useEffect(() => {
    fetchConversations();
  }, []);

  const handleSelectConversation = async (id: string) => {
    setCurrentConversation(id);
    await loadMessages(id);
    setShowConversationList(false);
  };

  const handleNewConversation = async () => {
    const id = await createConversation();
    setCurrentConversation(id);
    setShowConversationList(false);
  };

  const handleSend = async () => {
    if (!input.trim() || !currentConversation || isStreaming) return;
    const msg = input.trim();
    setInput('');
    await sendMessage(currentConversation, msg);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleBack = () => {
    setShowConversationList(true);
    setCurrentConversation(null);
  };

  // Conversation List View
  if (showConversationList) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.newChatButton} onPress={handleNewConversation}>
          <FontAwesome name="plus" size={16} color={Colors.text} />
          <Text style={styles.newChatText}>New Conversation</Text>
        </TouchableOpacity>

        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="comments" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start chatting with your second brain
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.conversationList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.conversationCard}
                onPress={() => handleSelectConversation(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.conversationIcon}>
                  <FontAwesome name="comment" size={18} color={Colors.primary} />
                </View>
                <View style={styles.conversationInfo}>
                  <Text style={styles.conversationTitle} numberOfLines={1}>
                    {item.title || 'New Conversation'}
                  </Text>
                  <Text style={styles.conversationMeta}>
                    {item.message_count} messages · {new Date(item.updated_at).toLocaleDateString()}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={12} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // Chat View
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Chat Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={16} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.chatTitle} numberOfLines={1}>
          {conversations.find((c) => c.id === currentConversation)?.title || 'Chat'}
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.chatEmptyState}>
            <View style={styles.brainIcon}>
              <Text style={{ fontSize: 40 }}>🧠</Text>
            </View>
            <Text style={styles.chatEmptyTitle}>Ask me anything</Text>
            <Text style={styles.chatEmptySubtitle}>
              I can search your notes, create summaries, generate flashcards, and more.
            </Text>
          </View>
        }
        renderItem={({ item }) => <ChatBubble message={item} />}
      />

      {/* Streaming indicator */}
      {isStreaming && (
        <View style={styles.streamingBar}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.streamingText}>Thinking...</Text>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask your second brain..."
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={10000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isStreaming) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isStreaming}
        >
          <FontAwesome name="send" size={16} color={Colors.text} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Conversation List
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadow.md,
  },
  newChatText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  conversationList: {
    padding: Spacing.md,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  conversationIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    marginBottom: 2,
  },
  conversationMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  // Chat View
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  chatTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    flex: 1,
  },
  messageList: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  chatEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  brainIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  chatEmptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  chatEmptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 22,
  },
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
  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
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
  },
});
