/**
 * Notes Store — manages notes state with Zustand.
 */

import { create } from 'zustand';
import api from '@/services/api';
import { API_ENDPOINTS } from '@/constants/api';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  content_type: 'text' | 'url' | 'pdf' | 'voice' | 'image';
  source_url?: string;
  word_count: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  tags: Tag[];
  metadata: Record<string, any>;
}

interface SearchResult {
  note_id: string;
  title: string;
  content_snippet: string;
  content_type: string;
  similarity: number;
  source_url?: string;
  created_at: string;
  tags: string[];
}

interface NotesState {
  notes: Note[];
  searchResults: SearchResult[];
  isLoading: boolean;
  isSearching: boolean;
  total: number;
  page: number;
  error: string | null;

  // Actions
  fetchNotes: (page?: number) => Promise<void>;
  createNote: (data: { content: string; title?: string; content_type?: string; tags?: string[] }) => Promise<Note>;
  updateNote: (id: string, data: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  searchNotes: (query: string) => Promise<void>;
  importUrl: (url: string, tags?: string[]) => Promise<Note>;
  clearSearch: () => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  searchResults: [],
  isLoading: false,
  isSearching: false,
  total: 0,
  page: 1,
  error: null,

  fetchNotes: async (page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(API_ENDPOINTS.NOTES, {
        params: { page, limit: 20 },
      });
      set({
        notes: page === 1 ? response.data.notes : [...get().notes, ...response.data.notes],
        total: response.data.total,
        page,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createNote: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(API_ENDPOINTS.NOTES, data);
      const newNote = response.data;
      set({ notes: [newNote, ...get().notes], isLoading: false });
      return newNote;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  updateNote: async (id, data) => {
    try {
      const response = await api.patch(`${API_ENDPOINTS.NOTES}/${id}`, data);
      set({
        notes: get().notes.map((n) => (n.id === id ? response.data : n)),
      });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteNote: async (id) => {
    try {
      await api.delete(`${API_ENDPOINTS.NOTES}/${id}`);
      set({ notes: get().notes.filter((n) => n.id !== id) });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  searchNotes: async (query) => {
    set({ isSearching: true, error: null });
    try {
      const response = await api.post(API_ENDPOINTS.NOTES_SEARCH, {
        query,
        limit: 10,
      });
      set({ searchResults: response.data.results, isSearching: false });
    } catch (error: any) {
      set({ error: error.message, isSearching: false });
    }
  },

  importUrl: async (url, tags = []) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(API_ENDPOINTS.NOTES_IMPORT_URL, { url, tags });
      const newNote = response.data;
      set({ notes: [newNote, ...get().notes], isLoading: false });
      return newNote;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  clearSearch: () => set({ searchResults: [] }),
}));
