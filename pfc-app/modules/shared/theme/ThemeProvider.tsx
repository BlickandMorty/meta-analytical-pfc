import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, arcadeTheme, stateColors } from './colors';
import { fonts, fontSizes, pixelSizes } from './fonts';
import { usePFCStore } from '../../store/usePFCStore';
import type { ThemeColors } from './colors';

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
  isArcade: boolean;
  fonts: typeof fonts;
  fontSizes: typeof fontSizes;
  pixelSizes: typeof pixelSizes;
  stateColors: typeof stateColors;
}

const ThemeContext = createContext<Theme>({
  colors: darkTheme,
  isDark: true,
  isArcade: false,
  fonts,
  fontSizes,
  pixelSizes,
  stateColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const arcadeMode = usePFCStore((s) => s.arcadeMode);

  const theme = useMemo<Theme>(() => {
    if (arcadeMode) {
      return {
        colors: arcadeTheme,
        isDark: true,
        isArcade: true,
        fonts,
        fontSizes,
        pixelSizes,
        stateColors,
      };
    }

    const isDark = systemScheme === 'dark';
    return {
      colors: isDark ? darkTheme : lightTheme,
      isDark,
      isArcade: false,
      fonts,
      fontSizes,
      pixelSizes,
      stateColors,
    };
  }, [systemScheme, arcadeMode]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
