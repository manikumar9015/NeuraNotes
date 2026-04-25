/**
 * Chat Store — manages conversations and messages with Zustand.
 * Uses WebSocket for real-time streaming AI responses.
 *
 * WS Protocol (backend /chat/ws/{conversation_id}):
 *   Client → { content: string; token: string }
 *   Server → { type: "status",  content: string }
 *   Server → { type: "chunk",   content: string }   ← streaming text
 *   Server → { type: "done",    message: Message, sources: Source[] }
 *   Server → { type: "error",   detail: string }
 */

import { create } from 'zustand';
import api from '@/services/api';
import { API_ENDPOINTS, WS_BASE_URL } from '@/constants/api';
import { useAuthStore } from './authStore';

interface Source {
  note_id: string;
  title: string;
  similarity: number;
}

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: Source[];
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
  /** Accumulator for the in-flight streamed text. Rendered live in the UI. */
  streamingContent: string;
  /** Status message shown during planning phase ("Processing your request...") */
  streamingStatus: string;
  error: string | null;

  fetchConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<string>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  setCurrentConversation: (id: string | null) => void;
  deleteConversation: (id: string) => Promise<void>;
  clearMessages: () => void;
  
  submittedForms: Record<string, boolean>;
  markFormSubmitted: (formId: string) => void;
}

// Active WebSocket — kept module-level so we can close it on new sends
let activeWs: WebSocket | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
  streamingStatus: '',
  error: null,
  submittedForms: {},

  markFormSubmitted: (formId: string) => set((state) => ({ 
    submittedForms: { ...state.submittedForms, [formId]: true } 
  })),

  // ── Fetch conversations list ────────────────────────────────────────────
  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get(API_ENDPOINTS.CONVERSATIONS);
      set({ conversations: response.data.conversations, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // ── Create a new conversation ───────────────────────────────────────────
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

  // ── Load history for a conversation ────────────────────────────────────
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

  // ── Send a message via WebSocket (streaming) ────────────────────────────
  sendMessage: async (conversationId, content) => {
    // Close any already-open socket
    if (activeWs) {
      activeWs.close();
      activeWs = null;
    }

    // 1. Optimistically add the user message
    const tempUserId = `temp-user-${Date.now()}`;
    const userMsg: Message = {
      id: tempUserId,
      conversation_id: conversationId,
      role: 'user',
      content,
      sources: [],
      subtasks: [],
      created_at: new Date().toISOString(),
    };
    set({
      messages: [...get().messages, userMsg],
      isStreaming: true,
      streamingContent: '',
      streamingStatus: '',
      error: null,
    });

    // 2. Get JWT for WS authentication
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      set({
        isStreaming: false,
        messages: get().messages.filter((m) => m.id !== tempUserId),
        error: 'Not authenticated',
      });
      return;
    }

    return new Promise<void>((resolve) => {
      const wsUrl = `${WS_BASE_URL}${API_ENDPOINTS.CHAT_WS}/${conversationId}`;
      const ws = new WebSocket(wsUrl);
      activeWs = ws;

      ws.onopen = () => {
        // Send the message + auth token as the first (and only) WS payload
        ws.send(JSON.stringify({ content, token }));
      };

      ws.onmessage = (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (data.type) {
          case 'status':
            // "Thinking…" / "Searching notes…" — show as status hint, not as content
            set({ streamingStatus: data.content });
            break;

          case 'chunk':
            // Append each chunk to the visible streamed text
            set({ streamingContent: get().streamingContent + data.content });
            break;

          case 'done': {
            // Replace the temp user msg with the confirmed server messages
            const prevMessages = get().messages.filter((m) => m.id !== tempUserId);
            const userMsg: Message = data.user_message;
            const serverMsg: Message = {
              ...data.assistant_message,
              sources: data.sources || [],
              subtasks: data.assistant_message?.subtasks || [],
            };
            set({
              messages: [...prevMessages, userMsg, serverMsg],
              isStreaming: false,
              streamingContent: '',
              streamingStatus: '',
            });
            ws.close();
            activeWs = null;
            resolve();
            break;
          }

          case 'error':
            set({
              isStreaming: false,
              streamingContent: '',
              streamingStatus: '',
              error: data.detail || 'Stream error',
              // Remove temp user msg on error
              messages: get().messages.filter((m) => m.id !== tempUserId),
            });
            ws.close();
            activeWs = null;
            resolve();
            break;
        }
      };

      ws.onerror = () => {
        // WebSocket failed — fall back to plain HTTP
        set({ streamingStatus: 'Connecting…' });
        ws.close();
        activeWs = null;

        api
          .post(`${API_ENDPOINTS.CONVERSATIONS}/${conversationId}/messages`, { content })
          .then((response) => {
            const { user_message, assistant_message } = response.data;
            set({
              messages: [
                ...get().messages.filter((m) => m.id !== tempUserId),
                user_message,
                assistant_message,
              ],
              isStreaming: false,
              streamingContent: '',
              streamingStatus: '',
            });
            resolve();
          })
          .catch((err) => {
            set({
              isStreaming: false,
              streamingContent: '',
              streamingStatus: '',
              error: err.message,
              messages: get().messages.filter((m) => m.id !== tempUserId),
            });
            resolve();
          });
      };

      ws.onclose = () => {
        // If streaming was never completed (e.g. disconnect during stream)
        if (get().isStreaming) {
          const partialContent = get().streamingContent;
          if (partialContent) {
            // Commit the partial content as a real message
            const partialMsg: Message = {
              id: `partial-${Date.now()}`,
              conversation_id: conversationId,
              role: 'assistant',
              content: partialContent + ' _(response interrupted)_',
              sources: [],
              subtasks: [],
              created_at: new Date().toISOString(),
            };
            set({
              messages: [...get().messages.filter((m) => m.id !== tempUserId), partialMsg],
            });
          } else {
            set({
              messages: get().messages.filter((m) => m.id !== tempUserId),
            });
          }
          set({ isStreaming: false, streamingContent: '', streamingStatus: '' });
          resolve();
        }
      };
    });
  },

  setCurrentConversation: (id) => set({ currentConversation: id }),

  clearMessages: () => set({ messages: [], currentConversation: null }),

  deleteConversation: async (id) => {
    try {
      await api.delete(`${API_ENDPOINTS.CONVERSATIONS}/${id}`);
      set({
        conversations: get().conversations.filter((c) => c.id !== id),
        currentConversation:
          get().currentConversation === id ? null : get().currentConversation,
      });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
}));
