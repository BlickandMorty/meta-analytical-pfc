import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../shared/theme';
import { PFCText } from '../shared/components/PFCText';
import { VisualizationCard } from './VisualizationCard';
import { usePFCStore } from '../store/usePFCStore';

function SemiGauge({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const { colors } = useTheme();
  const normalized = Math.min(1, value / max);

  return (
    <View style={styles.gaugeWrap}>
      <PFCText variant="ui" size="xs" color={colors.textTertiary} center>{label}</PFCText>

      <View style={styles.semiContainer}>
        {/* Background arc */}
        <View style={[styles.semiArc, { borderColor: colors.border }]} />

        {/* Filled portion — represented as bar for cross-platform */}
        <View style={[styles.fillContainer, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.semiFill,
              {
                width: `${normalized * 100}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>

        <View style={styles.semiValue}>
          <PFCText variant="code" size="xl" color={color} glow center>
            {(value * 100).toFixed(0)}%
          </PFCText>
        </View>
      </View>

      <View style={styles.tickRow}>
        <PFCText variant="code" size="xs" color={colors.textTertiary}>0</PFCText>
        <PFCText variant="code" size="xs" color={colors.textTertiary}>{max}</PFCText>
      </View>
    </View>
  );
}

export function EntropyDissonanceViz() {
  const { colors } = useTheme();
  const entropy = usePFCStore((s) => s.entropy);
  const dissonance = usePFCStore((s) => s.dissonance);
  const healthScore = usePFCStore((s) => s.healthScore);

  function colorForValue(value: number): string {
    if (value > 0.7) return colors.semantic.error;
    if (value > 0.5) return colors.semantic.warning;
    return colors.semantic.success;
  }

  const entropyColor = colorForValue(entropy);
  const dissonanceColor = colorForValue(dissonance);
  const healthColor = healthScore > 0.6 ? colors.semantic.success : healthScore > 0.3 ? colors.semantic.warning : colors.semantic.error;

  const entropyNote =
    entropy > 0.7
      ? 'high uncertainty — reasoning divergent'
      : entropy > 0.4
      ? 'moderate — some information loss'
      : 'low entropy — reasoning coherent';

  const dissonanceNote =
    dissonance > 0.7
      ? 'severe dissonance — contradictions present'
      : dissonance > 0.4
      ? 'moderate — partial disagreement'
      : 'harmonious — evidence aligned';

  return (
    <VisualizationCard
      title="ENTROPY × DISSONANCE"
      subtitle="information loss and evidential conflict"
      color={colors.semantic.warning}
    >
      <View style={styles.gaugesRow}>
        <SemiGauge
          label="ENTROPY"
          value={entropy}
          max={1}
          color={entropyColor}
        />
        <SemiGauge
          label="DISSONANCE"
          value={dissonance}
          max={1}
          color={dissonanceColor}
        />
      </View>

      {/* Health score full-width bar */}
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <PFCText variant="ui" size="xs" color={colors.textTertiary}>SYSTEM HEALTH</PFCText>
          <PFCText variant="code" size="sm" color={healthColor} glow>
            {Math.round(healthScore * 100)}%
          </PFCText>
        </View>
        <View style={[styles.healthTrack, { backgroundColor: colors.surface }]}>
          <View
            style={[
              styles.healthFill,
              {
                width: `${healthScore * 100}%`,
                backgroundColor: healthColor,
              },
            ]}
          />
        </View>
        <View style={styles.healthThresholds}>
          <View style={[styles.thresholdZone, { flex: 3 }]}>
            <PFCText variant="ui" size="xs" color={colors.semantic.error} center>critical</PFCText>
          </View>
          <View style={[styles.thresholdZone, { flex: 3 }]}>
            <PFCText variant="ui" size="xs" color={colors.semantic.warning} center>degraded</PFCText>
          </View>
          <View style={[styles.thresholdZone, { flex: 4 }]}>
            <PFCText variant="ui" size="xs" color={colors.semantic.success} center>optimal</PFCText>
          </View>
        </View>
      </View>

      <View style={[styles.interpretation, { borderLeftColor: colors.semantic.warning }]}>
        <PFCText variant="body" size="xs" color={entropyColor}>▸ {entropyNote}</PFCText>
        <PFCText variant="body" size="xs" color={dissonanceColor}>▸ {dissonanceNote}</PFCText>
      </View>
    </VisualizationCard>
  );
}

const styles = StyleSheet.create({
  gaugesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  gaugeWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  semiContainer: {
    width: '100%',
    height: 60,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  semiArc: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: 60,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    borderWidth: 4,
    borderBottomWidth: 0,
  },
  fillContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  semiFill: {
    height: '100%',
    borderRadius: 3,
  },
  semiValue: {
    marginBottom: 10,
  },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  healthSection: {
    marginBottom: 16,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  healthTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    borderRadius: 5,
  },
  healthThresholds: {
    flexDirection: 'row',
    marginTop: 4,
  },
  thresholdZone: {},
  interpretation: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 4,
  },
});
