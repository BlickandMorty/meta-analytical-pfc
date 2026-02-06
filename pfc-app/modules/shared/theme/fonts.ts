import { Platform } from 'react-native';

export const fonts = {
  serif: 'SourceSerif4_400Regular',
  serifMedium: 'SourceSerif4_500Medium',
  serifBold: 'SourceSerif4_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansBold: 'Inter_700Bold',
  mono: Platform.select({
    ios: 'Courier New',
    android: 'monospace',
    default: 'monospace',
  }) as string,
  pixel: 'PressStart2P_400Regular',
} as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 32,
  display: 48,
} as const;

// Pixel fonts render larger — use smaller values
export const pixelSizes = {
  xs: 7,
  sm: 8,
  md: 10,
  lg: 13,
  xl: 16,
  xxl: 22,
  display: 32,
} as const;

export type FontSize = keyof typeof fontSizes;
