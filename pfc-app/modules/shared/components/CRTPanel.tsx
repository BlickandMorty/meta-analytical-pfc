import React from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { PFCText } from './PFCText';

interface CRTPanelProps {
  children: React.ReactNode;
  title?: string;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
}

export function CRTPanel({
  children,
  title,
  accentColor,
  style,
  noPadding = false,
}: CRTPanelProps) {
  const { colors } = useTheme();
  const borderColor = accentColor ?? colors.brand.primary + '60';
  const innerGlow = (accentColor ?? colors.brand.primary) + '08';

  return (
    <View
      style={[
        styles.outer,
        {
          borderColor,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      {/* Inner glow border */}
      <View
        style={[
          styles.inner,
          {
            borderColor: borderColor + '30',
            backgroundColor: innerGlow,
          },
          noPadding ? styles.innerNoPad : styles.innerPad,
        ]}
      >
        {title && (
          <View style={[styles.titleBar, { borderBottomColor: borderColor }]}>
            <PFCText variant="pixel" size="xs" color={accentColor ?? colors.brand.primary} glow>
              {title}
            </PFCText>
          </View>
        )}
        {children}
      </View>

      {/* Scanline overlay (web only, subtle) */}
      {Platform.OS === 'web' && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.scanlines,
          ]}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 2,
    borderRadius: 2,
    overflow: 'hidden',
  },
  inner: {
    borderWidth: 1,
    borderRadius: 1,
    margin: 1,
  },
  innerPad: {
    padding: 12,
  },
  innerNoPad: {
    padding: 0,
  },
  titleBar: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 10,
  },
  scanlines: {
    // CSS background for web scanline effect
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
        }
      : {}),
  } as any,
});
