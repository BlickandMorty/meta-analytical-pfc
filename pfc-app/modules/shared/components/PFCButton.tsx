import React, { useCallback } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { elevation1, elevation2 } from '../theme/elevation';
import { PFCText } from './PFCText';

interface PFCButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PADDING: Record<string, number> = { sm: 8, md: 12, lg: 16 };

export function PFCButton({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  style,
}: PFCButtonProps) {
  const { colors, isArcade } = useTheme();

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(
      size === 'sm'
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium
    );
    onPress();
  }, [disabled, onPress, size]);

  const accentColor =
    variant === 'danger'
      ? colors.semantic.error
      : colors.brand.primary;

  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';

  const backgroundColor = isPrimary || isDanger ? accentColor : 'transparent';
  const textColor = isPrimary || isDanger ? colors.textInverse : accentColor;
  const borderColor = isGhost ? 'transparent' : accentColor;

  const pad = PADDING[size] ?? 12;
  const btnElevation = isPrimary || isDanger ? elevation2 : isGhost ? {} : elevation1;

  // Use pixel font for primary/danger buttons
  const textVariant = (isPrimary || isDanger) ? 'pixel' : isArcade ? 'code' : 'ui';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        btnElevation,
        {
          backgroundColor: pressed
            ? isPrimary || isDanger
              ? accentColor + 'DD'
              : accentColor + '12'
            : backgroundColor,
          borderColor: disabled ? colors.border : borderColor,
          paddingVertical: pad,
          paddingHorizontal: pad * 2,
          opacity: disabled ? 0.4 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          ...(pressed ? {} : btnElevation),
        },
        style,
      ]}
    >
      <PFCText
        variant={textVariant}
        size={size === 'sm' ? 'xs' : size === 'lg' ? 'lg' : 'sm'}
        color={disabled ? colors.textTertiary : textColor}
        center
      >
        {label}
      </PFCText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
