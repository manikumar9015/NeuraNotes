/**
 * API Configuration
 */

import { Platform } from 'react-native';

// Dynamically set API URL based on platform
const getApiUrl = () => {
  if (!__DEV__) return 'https://your-app.onrender.com';
  if (Platform.OS === 'web') return 'http://localhost:8000';
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000'; // Android Emulator
  return 'http://localhost:8000'; // iOS Simulator
};

export const API_BASE_URL = getApiUrl();
export const WS_BASE_URL = API_BASE_URL.replace('http', 'ws');

export const API_ENDPOINTS = {
  // Auth
  AUTH_GOOGLE: '/auth/google',
  AUTH_DEV_LOGIN: '/auth/dev-login',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',

  // Notes
  NOTES: '/notes',
  NOTES_SEARCH: '/notes/search',
  NOTES_IMPORT_URL: '/notes/import/url',
  NOTES_IMPORT_PDF: '/notes/import/pdf',
  NOTES_IMPORT_VOICE: '/notes/import/voice',

  // Chat
  CONVERSATIONS: '/chat/conversations',
  CHAT_WS: '/chat/ws',
} as const;
