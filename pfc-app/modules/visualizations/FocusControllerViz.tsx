import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../shared/theme';
import { PFCText } from '../shared/components/PFCText';
import { VisualizationCard } from './VisualizationCard';
import { usePFCStore } from '../store/usePFCStore';

function ArcGauge({
  value,
  min,
  max,
  label,
  unit,
  color,
  trackColor,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  trackColor: string;
}) {
  const { colors } = useTheme();
  const normalized = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const fillPercent = normalized * 100;

  return (
    <View style={styles.gaugeContainer}>
      <PFCText variant="ui" size="xs" color={colors.textTertiary} center>{label}</PFCText>

      {/* Arc represented as semi-circle with fill */}
      <View style={styles.arcContainer}>
        {/* Track */}
        <View style={[styles.arcTrack, { borderColor: trackColor }]} />
        {/* Fill — clip from left */}
        <View
          style={[
            styles.arcFill,
            {
              borderColor: color,
              borderTopColor: color,
              borderRightColor: fillPercent > 50 ? color : 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: fillPercent > 75 ? color : 'transparent',
              transform: [{ rotate: `${-90 + normalized * 180}deg` }],
            },
          ]}
        />
        {/* Center value */}
        <View style={styles.arcCenter}>
          <PFCText variant="code" size="xl" color={color} glow center>
            {value.toFixed(max > 5 ? 1 : 2)}
          </PFCText>
        </View>
      </View>

      {/* Range labels */}
      <View style={styles.rangeRow}>
        <PFCText variant="code" size="xs" color={colors.textTertiary}>{min}</PFCText>
        <PFCText variant="ui" size="xs" color={color}>{unit}</PFCText>
        <PFCText variant="code" size="xs" color={colors.textTertiary}>{max}</PFCText>
      </View>

      {/* Bar beneath */}
      <View style={[styles.barTrack, { backgroundColor: trackColor }]}>
        <View style={[styles.barFill, { width: `${fillPercent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function FocusControllerViz() {
  const { colors } = useTheme();
  const focusDepth = usePFCStore((s) => s.focusDepth);
  const temperatureScale = usePFCStore((s) => s.temperatureScale);

  const depthInterpretation =
    focusDepth > 7
      ? 'deep recursive analysis'
      : focusDepth > 4
      ? 'moderate exploration depth'
      : 'shallow single-pass';

  const tempInterpretation =
    temperatureScale > 0.8
      ? 'high creativity — broad sampling'
      : temperatureScale > 0.5
      ? 'balanced exploration'
      : 'constrained — focused reasoning';

  return (
    <VisualizationCard
      title="FOCUS CONTROLLER"
      subtitle="continued-fraction entropy valve"
      color={colors.brand.accent}
    >
      <View style={styles.gaugesRow}>
        <ArcGauge
          value={focusDepth}
          min={2}
          max={10}
          label="DEPTH"
          unit="levels"
          color={colors.brand.accent}
          trackColor={colors.border}
        />
        <ArcGauge
          value={temperatureScale}
          min={0}
          max={1}
          label="TEMPERATURE"
          unit="scale"
          color={colors.semantic.warning}
          trackColor={colors.border}
        />
      </View>

      <View style={[styles.interpretation, { borderLeftColor: colors.brand.accent }]}>
        <PFCText variant="body" size="xs" color={colors.brand.accent}>▸ {depthInterpretation}</PFCText>
        <PFCText variant="body" size="xs" color={colors.semantic.warning}>▸ {tempInterpretation}</PFCText>
      </View>
    </VisualizationCard>
  );
}

const styles = StyleSheet.create({
  gaugesRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  gaugeContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  arcContainer: {
    width: 120,
    height: 70,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  arcTrack: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    top: 0,
  },
  arcFill: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    top: 0,
  },
  arcCenter: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  barTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  interpretation: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 4,
  },
});
