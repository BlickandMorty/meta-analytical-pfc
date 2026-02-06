import { Platform, ViewStyle } from 'react-native';

export interface ElevationStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

// Hard pixel-style shadows — sharp offset, minimal blur
function createElevation(
  level: number,
  shadowColor = '#000000',
): ViewStyle {
  const offset = level + 1; // 2, 3, 4, 5, 6
  const blur = level <= 2 ? 0 : 1; // hard shadow for levels 1-2
  const opacity = 0.12 + level * 0.04;

  if (Platform.OS === 'web') {
    return {
      // @ts-ignore - web-only property
      boxShadow: `${offset}px ${offset}px ${blur}px rgba(0, 0, 0, ${opacity})`,
    };
  }

  return {
    shadowColor,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: opacity,
    shadowRadius: blur,
    elevation: level * 2,
  };
}

export const elevation1 = createElevation(1);
export const elevation2 = createElevation(2);
export const elevation3 = createElevation(3);
export const elevation4 = createElevation(4);
export const elevation5 = createElevation(5);

export const elevations = {
  1: elevation1,
  2: elevation2,
  3: elevation3,
  4: elevation4,
  5: elevation5,
} as const;
