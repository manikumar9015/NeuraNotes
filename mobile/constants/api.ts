/**
 * API Configuration
 */

// Change this to your backend URL
// For local dev with Expo Go on phone, use your computer's local IP
export const API_BASE_URL = __DEV__
  ? 'http://192.168.1.100:8000'  // Change to your local IP
  : 'https://your-app.onrender.com';

export const WS_BASE_URL = API_BASE_URL.replace('http', 'ws');

export const API_ENDPOINTS = {
  // Auth
  AUTH_GOOGLE: '/auth/google',
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
