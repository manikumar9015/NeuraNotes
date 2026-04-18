/**
 * NeuraNotes Theme — design tokens for consistent styling.
 * Premium dark theme with purple/indigo accent colors.
 */

export const Colors = {
  // Primary palette
  primary: '#6366F1',       // Indigo-500
  primaryLight: '#818CF8',  // Indigo-400
  primaryDark: '#4338CA',   // Indigo-700
  
  // Accent
  accent: '#8B5CF6',        // Violet-500
  accentLight: '#A78BFA',   // Violet-400

  // Background (dark mode)
  background: '#0F0F1A',
  backgroundSecondary: '#1A1A2E',
  backgroundTertiary: '#252540',
  surface: '#1E1E35',
  surfaceHover: '#2A2A45',

  // Text
  text: '#F1F1F6',
  textSecondary: '#A0A0BC',
  textMuted: '#6B6B8D',
  textInverse: '#0F0F1A',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Content type colors
  typeText: '#6366F1',
  typeUrl: '#3B82F6',
  typePdf: '#EF4444',
  typeVoice: '#8B5CF6',
  typeImage: '#10B981',

  // Borders & dividers
  border: '#2A2A45',
  divider: '#1F1F3A',

  // Gradients (as arrays)
  gradientPrimary: ['#6366F1', '#8B5CF6'] as const,
  gradientDark: ['#0F0F1A', '#1A1A2E'] as const,
  gradientCard: ['#1E1E35', '#252540'] as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  display: 36,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};
