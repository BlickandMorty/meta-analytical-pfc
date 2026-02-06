import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import type { FontSize } from '../theme';

interface PFCTextProps {
  children: React.ReactNode;
  variant?: 'body' | 'ui' | 'code' | 'display' | 'pixel';
  size?: FontSize;
  color?: string;
  glow?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}

export function PFCText({
  children,
  variant = 'body',
  size = 'md',
  color,
  glow = false,
  center = false,
  style,
}: PFCTextProps) {
  const { colors, fonts, fontSizes, pixelSizes, isArcade } = useTheme();

  const resolvedColor = color ?? colors.textPrimary;

  const isPixel = variant === 'pixel';

  const fontFamily = isPixel
    ? fonts.pixel
    : isArcade
    ? fonts.mono
    : variant === 'body'
    ? fonts.serif
    : variant === 'ui'
    ? fonts.sansMedium
    : variant === 'code'
    ? fonts.mono
    : fonts.serifBold;

  const fontSize = isPixel ? pixelSizes[size] : fontSizes[size];

  const letterSpacing = isPixel ? 1 : variant === 'code' || isArcade ? 0.5 : 0;

  const glowStyle: TextStyle =
    glow && isArcade
      ? {
          textShadowColor: resolvedColor,
          textShadowRadius: 8,
          textShadowOffset: { width: 0, height: 0 },
        }
      : glow
      ? {
          textShadowColor: resolvedColor + '40',
          textShadowRadius: 4,
          textShadowOffset: { width: 0, height: 0 },
        }
      : {};

  return (
    <Text
      style={[
        {
          fontFamily,
          fontSize,
          color: resolvedColor,
          letterSpacing,
          textAlign: center ? 'center' : undefined,
          textTransform: isPixel ? 'uppercase' : undefined,
        },
        glowStyle,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
