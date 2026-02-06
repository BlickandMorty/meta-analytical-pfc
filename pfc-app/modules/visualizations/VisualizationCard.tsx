import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../shared/theme';
import { elevation3 } from '../shared/theme/elevation';
import { PFCText } from '../shared/components/PFCText';

interface VisualizationCardProps {
  title: string;
  subtitle: string;
  color?: string;
  children: React.ReactNode;
}

export function VisualizationCard({
  title,
  subtitle,
  color,
  children,
}: VisualizationCardProps) {
  const { colors } = useTheme();
  const resolvedColor = color ?? colors.brand.primary;

  return (
    <View style={[styles.card, elevation3, { backgroundColor: colors.surface }]}>
      <View style={[styles.titleBar, { borderBottomColor: resolvedColor + '40' }]}>
        <PFCText variant="ui" size="md" color={resolvedColor} glow>
          {title}
        </PFCText>
        <PFCText variant="body" size="xs" color={colors.textTertiary} style={{ marginTop: 2 }}>
          {subtitle}
        </PFCText>
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  titleBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
});
