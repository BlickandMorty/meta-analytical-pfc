import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { PFCText } from './PFCText';
import { usePFCStore } from '../../store/usePFCStore';

function vitalColor(value: number, colors: any, inverted = false): string {
  const v = inverted ? 100 - value : value;
  if (v > 66) return colors.semantic.success;
  if (v > 33) return colors.semantic.warning;
  return colors.semantic.error;
}

export function PFCStatusBar() {
  const { colors, stateColors } = useTheme();

  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const health = usePFCStore((s) => s.healthScore);
  const safetyState = usePFCStore((s) => s.safetyState);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);
  const activeMessageLayer = usePFCStore((s) => s.activeMessageLayer);
  const toggleMessageLayer = usePFCStore((s) => s.toggleMessageLayer);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border }]}>
      {/* Safety badge */}
      <View style={[styles.safetyBadge, { borderColor: stateColors[safetyState], backgroundColor: stateColors[safetyState] + '12' }]}>
        <PFCText variant="ui" size="xs" color={stateColors[safetyState]}>
          {safetyState.toUpperCase()}
        </PFCText>
      </View>

      {/* Vitals */}
      <View style={styles.vitals}>
        <Vital label="C" value={confidence * 100} color={vitalColor(confidence * 100, colors)} colors={colors} />
        <Vital label="E" value={entropy * 100} color={vitalColor(entropy * 100, colors, true)} colors={colors} />
        <Vital label="H" value={health * 100} color={vitalColor(health * 100, colors)} colors={colors} />
        <Vital label="Q" value={queriesProcessed} max={999} color={colors.semantic.info} colors={colors} />
      </View>

      {/* Layer toggle */}
      <Pressable
        onPress={toggleMessageLayer}
        style={[styles.layerToggle, { borderColor: colors.brand.primary + '40', backgroundColor: colors.brand.primary + '08' }]}
      >
        <PFCText variant="ui" size="xs" color={colors.brand.primary}>
          {activeMessageLayer === 'layman' ? 'Plain' : 'Research'}
        </PFCText>
      </Pressable>
    </View>
  );
}

function Vital({
  label,
  value,
  max = 100,
  color,
  colors,
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
  colors: any;
}) {
  const pct = Math.min((value / max) * 100, 100);

  return (
    <View style={styles.vital}>
      <PFCText variant="code" size="xs" color={colors.textTertiary}>{label}</PFCText>
      <View style={[styles.barOuter, { backgroundColor: colors.backgroundTertiary }]}>
        <View style={[styles.barInner, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <PFCText variant="code" size="xs" color={color}>{Math.round(value)}</PFCText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  safetyBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  vitals: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  vital: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  barOuter: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barInner: {
    height: '100%',
    borderRadius: 2,
  },
  layerToggle: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
});
