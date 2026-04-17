/**
 * Chat Store — manages conversations and messages with Zustand.
 * Supports WebSocket streaming for real-time AI responses.
 */

import { create } from 'zustand';
import api from '@/services/api';
import { API_ENDPOINTS, WS_BASE_URL } from '@/constants/api';
import { useAuthStore } from './authStore';

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: Array<{ note_id: string; title: string; similarity: number }>;
  subtasks: any[];
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

interface ChatState {
  conversations: Conversation[];
  currentConversation: string | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;

  // Actions
  fetchConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<string>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  setCurrentConversation: (id: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
  error: null,

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get(API_ENDPOINTS.CONVERSATIONS);
      set({ conversations: response.data.conversations, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createConversation: async (title) => {
    try {
      const response = await api.post(API_ENDPOINTS.CONVERSATIONS, {
        title: title || 'New Conversation',
      });
      const conv = response.data;
      set({ conversations: [conv, ...get().conversations] });
      return conv.id;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  loadMessages: async (conversationId) => {
    set({ isLoading: true, currentConversation: conversationId });
    try {
      const response = await api.get(
        `${API_ENDPOINTS.CONVERSATIONS}/${conversationId}/messages`
      );
      set({ messages: response.data.messages, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  sendMessage: async (conversationId, content) => {
    // Add user message optimistically
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      role: 'user',
      content,
      sources: [],
      subtasks: [],
      created_at: new Date().toISOString(),
    };
    set({ messages: [...get().messages, userMsg], isStreaming: true, streamingContent: '' });

    try {
      const response = await api.post(
        `${API_ENDPOINTS.CONVERSATIONS}/${conversationId}/messages`,
        { content }
      );

      const { user_message, assistant_message } = response.data;

      // Replace temp message and add assistant response
      set({
        messages: [
          ...get().messages.filter((m) => m.id !== userMsg.id),
          user_message,
          assistant_message,
        ],
        isStreaming: false,
        streamingContent: '',
      });
    } catch (error: any) {
      set({
        error: error.message,
        isStreaming: false,
        messages: get().messages.filter((m) => m.id !== userMsg.id),
      });
    }
  },

  setCurrentConversation: (id) => set({ currentConversation: id }),
}));
