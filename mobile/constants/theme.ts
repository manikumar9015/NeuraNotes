/**
 * NeuraNotes Theme — design tokens for consistent styling.
 * Pure black background with cyan/teal accent palette matching UIDesign screenshots.
 */

export const Colors = {
  // Primary accent — cyan/teal from design
  primary: '#00E5FF',        // Bright cyan
  primaryLight: '#4DFDFF',   // Lighter cyan
  primaryDark: '#00B2CC',    // Darker cyan
  
  // Accent (secondary actions, streaks)
  accent: '#FF6B35',         // Orange for streak
  accentLight: '#FFA07A',

  // Background — pure black as in design
  background: '#000000',
  backgroundSecondary: '#0A0A0A',
  backgroundTertiary: '#111111',
  surface: '#161616',
  surfaceElevated: '#1C1C1C',
  surfaceHover: '#222222',

  // Text
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textMuted: '#555555',
  textInverse: '#000000',

  // Status
  success: '#00C896',
  warning: '#F59E0B',
  error: '#FF4444',
  info: '#3B82F6',

  // Content type badge colors (from design screenshots)
  typeText: '#00E5FF',       // Cyan — TEXT badge
  typeUrl: '#00E5FF',        // Cyan — URL badge
  typePdf: '#FF6B35',        // Orange — PDF badge
  typeVoice: '#00E5FF',      // Cyan — VOICE badge
  typeImage: '#00C896',

  // Borders — subtle dark borders
  border: '#222222',
  borderAccent: '#00E5FF33', // Cyan with low opacity

  // Gradients
  gradientCyan: ['#00E5FF', '#0088CC'] as const,
  gradientDark: ['#000000', '#0A0A0A'] as const,
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
  xl: 20,
  xxl: 24,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  display: 32,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  cyan: {
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};
