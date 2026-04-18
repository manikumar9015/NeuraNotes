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

export interface Flashcard {
  front: string;
  back: string;
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
  selectedNote: Note | null;
  searchResults: SearchResult[];
  isLoading: boolean;
  isSearching: boolean;
  total: number;
  page: number;
  error: string | null;

  // Actions
  fetchNotes: (page?: number) => Promise<void>;
  fetchNoteDetail: (id: string) => Promise<Note>;
  clearSelectedNote: () => void;
  createNote: (data: { content: string; title?: string; content_type?: string; tags?: string[] }) => Promise<Note>;
  updateNote: (id: string, data: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  searchNotes: (query: string) => Promise<void>;
  importUrl: (url: string, tags?: string[], description?: string) => Promise<Note>;
  importPdf: (fileUri: string, filename: string, tags?: string[]) => Promise<Note>;
  importVoice: (fileUri: string, filename: string, tags?: string[]) => Promise<Note>;
  generateFlashcards: (noteId: string) => Promise<Flashcard[]>;
  fetchDailyDigest: () => Promise<string>;
  clearSearch: () => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  selectedNote: null,
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
      set({ notes: response.data.notes, total: response.data.total, page, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchNoteDetail: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`${API_ENDPOINTS.NOTES}/${id}`);
      set({ selectedNote: response.data, isLoading: false });
      return response.data;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  clearSelectedNote: () => set({ selectedNote: null }),

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

  importUrl: async (url, tags = [], description?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(API_ENDPOINTS.NOTES_IMPORT_URL, { url, tags, description });
      const newNote = response.data;
      set({ notes: [newNote, ...get().notes], isLoading: false });
      return newNote;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  importPdf: async (fileUri, filename, tags = []) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: filename,
        type: 'application/pdf',
      } as any);
      if (tags.length > 0) {
        formData.append('tags', tags.join(','));
      }
      const response = await api.post(API_ENDPOINTS.NOTES_IMPORT_PDF, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newNote = response.data;
      set({ notes: [newNote, ...get().notes], isLoading: false });
      return newNote;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  importVoice: async (fileUri: string, filename: string, tags: string[] = []) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: filename,
        type: 'audio/m4a', // Default for expo-av on iOS
      } as any);
      
      if (tags.length > 0) {
        formData.append('tags', tags.join(','));
      }

      const response = await api.post(API_ENDPOINTS.NOTES_IMPORT_VOICE, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const newNote = response.data;
      set({ notes: [newNote, ...get().notes], isLoading: false });
      return newNote;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  generateFlashcards: async (noteId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`${API_ENDPOINTS.NOTES}/${noteId}/flashcards`);
      set({ isLoading: false });
      return response.data.flashcards || [];
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  fetchDailyDigest: async () => {
    set({ isLoading: true, error: null });
    try {
      // Direct path since it's a new router
      const response = await api.get('/digests/daily');
      set({ isLoading: false });
      return response.data.digest;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  clearSearch: () => set({ searchResults: [] }),
}));
