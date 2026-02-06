// --- Brand & Semantic Interfaces ---

export interface BrandColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
}

export interface SemanticColors {
  success: string;
  warning: string;
  error: string;
  info: string;
}

const brand: BrandColors = {
  primary: '#C15F3C',
  primaryDark: '#A34E30',
  primaryLight: '#D4805F',
  accent: '#6B5CE7',
  accentLight: '#8B7EF0',
};

const semantic: SemanticColors = {
  success: '#2D8B4E',
  warning: '#D4A843',
  error: '#C45B4B',
  info: '#5B8EC4',
};

// --- Theme Colors Interface ---

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  surface: string;
  surfaceElevated: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  border: string;
  borderSubtle: string;

  brand: BrandColors;
  semantic: SemanticColors;

  arcadeGlow: string;
}

// --- Light Theme ---

export const lightTheme: ThemeColors = {
  background: '#F4F3EE',
  backgroundSecondary: '#FFFFFF',
  backgroundTertiary: '#EDE9E3',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#999999',
  textInverse: '#FFFFFF',

  border: '#D5D0C8',
  borderSubtle: '#E8E4DD',

  brand,
  semantic,

  arcadeGlow: '#39FF1420',
};

// --- Dark Theme ---

export const darkTheme: ThemeColors = {
  background: '#1C1917',
  backgroundSecondary: '#262220',
  backgroundTertiary: '#312C28',
  surface: '#262220',
  surfaceElevated: '#312C28',

  textPrimary: '#F4F3EE',
  textSecondary: '#A8A29E',
  textTertiary: '#78716C',
  textInverse: '#1C1917',

  border: '#44403C',
  borderSubtle: '#352F2B',

  brand,
  semantic,

  arcadeGlow: '#39FF1410',
};

// --- Arcade Theme (neon OLED easter egg) ---

export const arcadeTheme: ThemeColors = {
  background: '#000000',
  backgroundSecondary: '#1A1A1A',
  backgroundTertiary: '#333333',
  surface: '#1A1A1A',
  surfaceElevated: '#333333',

  textPrimary: '#39FF14',
  textSecondary: '#CCCCCC',
  textTertiary: '#888888',
  textInverse: '#000000',

  border: '#333333',
  borderSubtle: '#1A1A1A',

  brand: {
    primary: '#39FF14',
    primaryDark: '#2BCC10',
    primaryLight: '#5AFF3A',
    accent: '#BF40FF',
    accentLight: '#D070FF',
  },
  semantic: {
    success: '#39FF14',
    warning: '#FFE81F',
    error: '#FF2E97',
    info: '#00F0FF',
  },

  arcadeGlow: '#39FF1440',
};

// --- Safety State Type + Colors ---

export type SafetyState = 'green' | 'yellow' | 'red';

export const stateColors: Record<SafetyState | 'idle' | 'active' | 'complete' | 'error', string> = {
  green: semantic.success,
  yellow: semantic.warning,
  red: semantic.error,
  idle: '#78716C',
  active: semantic.info,
  complete: semantic.success,
  error: semantic.error,
};
