/**
 * Auth Store — manages authentication state with Zustand.
 * Persists tokens in AsyncStorage for session continuity.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  loadStoredAuth: () => Promise<void>;
  devLogin: () => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  googleLogin: async (idToken: string) => {
    try {
      const api = (await import('@/services/api')).default;
      const { API_ENDPOINTS } = await import('@/constants/api');
      const response = await api.post(API_ENDPOINTS.AUTH_GOOGLE, { id_token: idToken });
      const { user, access_token, refresh_token } = response.data;
      get().login(user, access_token, refresh_token);
    } catch (error: any) {
      console.error('Google login failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.detail || 'Failed to authenticate with Google');
    }
  },

  devLogin: async () => {
    try {
      const api = (await import('@/services/api')).default;
      const { API_ENDPOINTS } = await import('@/constants/api');
      const response = await api.post(API_ENDPOINTS.AUTH_DEV_LOGIN);
      const { user, access_token, refresh_token } = response.data;
      get().login(user, access_token, refresh_token);
    } catch (error) {
      console.error('Dev login failed:', error);
    }
  },

  setTokens: (accessToken, refreshToken) => {
    set({ accessToken, refreshToken });
    AsyncStorage.setItem('accessToken', accessToken);
    AsyncStorage.setItem('refreshToken', refreshToken);
  },

  login: (user, accessToken, refreshToken) => {
    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      isLoading: false,
    });
    AsyncStorage.setItem('accessToken', accessToken);
    AsyncStorage.setItem('refreshToken', refreshToken);
    AsyncStorage.setItem('user', JSON.stringify(user));
  },

  logout: () => {
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
    AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
  },

  loadStoredAuth: async () => {
    try {
      const [accessToken, refreshToken, userJson] = await AsyncStorage.multiGet([
        'accessToken',
        'refreshToken',
        'user',
      ]);

      if (accessToken[1] && refreshToken[1] && userJson[1]) {
        const user = JSON.parse(userJson[1]);
        set({
          user,
          accessToken: accessToken[1],
          refreshToken: refreshToken[1],
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load stored auth:', error);
      set({ isLoading: false });
    }
  },
}));
