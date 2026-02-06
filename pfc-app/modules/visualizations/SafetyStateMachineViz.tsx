import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../shared/theme';
import { PFCText } from '../shared/components/PFCText';
import { VisualizationCard } from './VisualizationCard';
import { usePFCStore } from '../store/usePFCStore';
import type { SafetyState } from '../store/usePFCStore';

const STATE_CONFIG: Record<SafetyState, { label: string; temp: string; desc: string }> = {
  green: { label: 'GREEN', temp: 'T = 1.0', desc: 'full reasoning bandwidth' },
  yellow: { label: 'YELLOW', temp: 'T = 0.7', desc: 'elevated caution — constrained' },
  red: { label: 'RED', temp: 'T = 0.5', desc: 'maximum safety — minimal exploration' },
};

export function SafetyStateMachineViz() {
  const { colors, stateColors } = useTheme();
  const safetyState = usePFCStore((s) => s.safetyState);
  const riskScore = usePFCStore((s) => s.riskScore);

  return (
    <VisualizationCard
      title="ALLOSTASIS ENGINE"
      subtitle="contextual safety state machine"
      color={stateColors[safetyState]}
    >
      {/* Three state boxes */}
      <View style={styles.statesRow}>
        {(['green', 'yellow', 'red'] as const).map((state) => {
          const isActive = safetyState === state;
          const config = STATE_CONFIG[state];
          const stateColor = stateColors[state];

          return (
            <View
              key={state}
              style={[
                styles.stateBox,
                {
                  borderColor: stateColor,
                  backgroundColor: isActive ? stateColor + '18' : colors.surface,
                  opacity: isActive ? 1 : 0.35,
                  transform: [{ scale: isActive ? 1.05 : 0.95 }],
                },
              ]}
            >
              <PFCText variant="ui" size="lg" color={stateColor} glow={isActive} center>
                {config.label}
              </PFCText>
              <PFCText variant="code" size="sm" color={stateColor} center style={{ marginTop: 4 }}>
                {config.temp}
              </PFCText>
              <PFCText variant="body" size="xs" color={colors.textTertiary} center style={{ marginTop: 6 }}>
                {config.desc}
              </PFCText>
            </View>
          );
        })}
      </View>

      {/* Transition arrows */}
      <View style={styles.transitionRow}>
        <View style={[styles.arrow, { backgroundColor: stateColors.green }]} />
        <PFCText variant="ui" size="xs" color={colors.textTertiary}>→ risk threshold →</PFCText>
        <View style={[styles.arrow, { backgroundColor: stateColors.red }]} />
      </View>

      {/* Risk meter */}
      <View style={styles.riskSection}>
        <View style={styles.riskHeader}>
          <PFCText variant="ui" size="xs" color={colors.textTertiary}>RISK SCORE</PFCText>
          <PFCText variant="code" size="sm" color={stateColors[safetyState]} glow>
            {(riskScore * 100).toFixed(1)}%
          </PFCText>
        </View>

        <View style={styles.riskTrack}>
          {/* Zone coloring */}
          <View style={[styles.riskZone, { width: '35%', backgroundColor: stateColors.green + '15' }]} />
          <View style={[styles.riskZone, { width: '20%', backgroundColor: stateColors.yellow + '15' }]} />
          <View style={[styles.riskZone, { width: '45%', backgroundColor: stateColors.red + '15' }]} />

          {/* Fill */}
          <View
            style={[
              styles.riskFill,
              {
                width: `${Math.min(1, riskScore) * 100}%`,
                backgroundColor: stateColors[safetyState],
              },
            ]}
          />

          {/* Threshold lines */}
          <View style={[styles.threshold, { left: '35%', backgroundColor: colors.textTertiary }]} />
          <View style={[styles.threshold, { left: '55%', backgroundColor: colors.textTertiary }]} />
        </View>

        <View style={styles.riskLabels}>
          <PFCText variant="code" size="xs" color={stateColors.green}>0</PFCText>
          <PFCText variant="code" size="xs" color={stateColors.yellow}>0.35</PFCText>
          <PFCText variant="code" size="xs" color={stateColors.red}>0.55</PFCText>
          <PFCText variant="code" size="xs" color={colors.textTertiary}>1.0</PFCText>
        </View>
      </View>

      <View style={[styles.interpretation, { borderLeftColor: colors.semantic.success }]}>
        <PFCText variant="body" size="xs" color={stateColors[safetyState]}>
          ▸ {STATE_CONFIG[safetyState].desc}
        </PFCText>
      </View>
    </VisualizationCard>
  );
}

const styles = StyleSheet.create({
  statesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  stateBox: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  transitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  arrow: {
    width: 20,
    height: 2,
    borderRadius: 1,
  },
  riskSection: {
    marginBottom: 16,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  riskTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
  },
  riskZone: {
    height: '100%',
  },
  riskFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: 6,
    opacity: 0.7,
  },
  threshold: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
  },
  riskLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  interpretation: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 4,
  },
});
