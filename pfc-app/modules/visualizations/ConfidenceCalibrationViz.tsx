import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../shared/theme';
import { PFCText } from '../shared/components/PFCText';
import { VisualizationCard } from './VisualizationCard';
import { usePFCStore } from '../store/usePFCStore';

export function ConfidenceCalibrationViz() {
  const { colors } = useTheme();
  const confidence = usePFCStore((s) => s.confidence);
  const messages = usePFCStore((s) => s.messages);
  const entropy = usePFCStore((s) => s.entropy);
  const dissonance = usePFCStore((s) => s.dissonance);

  const GRADE_COLORS: Record<string, string> = {
    A: colors.semantic.success,
    B: colors.semantic.info,
    C: colors.semantic.warning,
    D: colors.semantic.error,
    F: colors.semantic.error,
  };

  // Get last system message for grade info
  const lastSystem = [...messages].reverse().find((m) => m.role === 'system');
  const grade = lastSystem?.evidenceGrade ?? '—';
  const mode = lastSystem?.mode ?? '—';
  const gradeColor = GRADE_COLORS[grade] ?? colors.textTertiary;

  // Uncertainty bounds (simulated +/- range based on entropy)
  const uncertainty = Math.min(0.35, entropy * 0.5 + 0.05);
  const lower = Math.max(0, confidence - uncertainty);
  const upper = Math.min(1, confidence + uncertainty);

  return (
    <VisualizationCard
      title="CONFIDENCE CALIBRATION"
      subtitle="calibrated uncertainty estimation"
      color={colors.semantic.success}
    >
      {/* Large confidence display */}
      <View style={styles.confidenceCenter}>
        <PFCText variant="ui" size="xs" color={colors.textTertiary}>CALIBRATED CONFIDENCE</PFCText>
        <PFCText
          variant="code"
          size="xxl"
          color={confidence > 0.6 ? colors.semantic.success : confidence > 0.4 ? colors.semantic.warning : colors.semantic.error}
          glow
          center
          style={{ fontSize: 48 }}
        >
          {Math.round(confidence * 100)}%
        </PFCText>
        <PFCText variant="code" size="sm" color={colors.textTertiary} center>
          ± {Math.round(uncertainty * 100)}%
        </PFCText>
      </View>

      {/* Uncertainty range bar */}
      <View style={styles.rangeSection}>
        <PFCText variant="ui" size="xs" color={colors.textTertiary} style={{ marginBottom: 6 }}>
          CONFIDENCE INTERVAL
        </PFCText>
        <View style={[styles.rangeTrack, { backgroundColor: colors.surface }]}>
          {/* Range band */}
          <View
            style={[
              styles.rangeBand,
              {
                left: `${lower * 100}%`,
                width: `${(upper - lower) * 100}%`,
                backgroundColor: colors.semantic.success + '25',
                borderColor: colors.semantic.success + '60',
              },
            ]}
          />
          {/* Point estimate */}
          <View
            style={[
              styles.rangePoint,
              {
                left: `${confidence * 100}%`,
                backgroundColor: colors.semantic.success,
              },
            ]}
          />
        </View>
        <View style={styles.rangeLabels}>
          <PFCText variant="code" size="xs" color={colors.textTertiary}>0%</PFCText>
          <PFCText variant="code" size="xs" color={colors.semantic.success}>
            [{Math.round(lower * 100)}%, {Math.round(upper * 100)}%]
          </PFCText>
          <PFCText variant="code" size="xs" color={colors.textTertiary}>100%</PFCText>
        </View>
      </View>

      {/* Evidence grade badge */}
      <View style={styles.gradeRow}>
        <View style={[styles.gradeBadge, { borderColor: gradeColor, backgroundColor: colors.surface }]}>
          <PFCText variant="code" size="xl" color={gradeColor} glow center>
            {grade}
          </PFCText>
          <PFCText variant="ui" size="xs" color={colors.textTertiary} center>GRADE</PFCText>
        </View>

        <View style={styles.breakdownCol}>
          <PFCText variant="ui" size="xs" color={colors.textTertiary} style={{ marginBottom: 8 }}>
            SIGNAL BREAKDOWN
          </PFCText>

          <BreakdownBar
            label="STATISTICAL"
            value={confidence}
            color={colors.semantic.info}
          />
          <BreakdownBar
            label="CAUSAL"
            value={Math.max(0, confidence - dissonance * 0.3)}
            color={colors.brand.accent}
          />
          <BreakdownBar
            label="CRITIQUE"
            value={Math.max(0, 1 - entropy - dissonance)}
            color={colors.semantic.warning}
          />
        </View>
      </View>

      <View style={[styles.interpretation, { borderLeftColor: colors.semantic.success }]}>
        <PFCText variant="body" size="xs" color={gradeColor}>
          ▸ evidence grade {grade} via {mode} mode
        </PFCText>
      </View>
    </VisualizationCard>
  );
}

function BreakdownBar({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.breakdownRow}>
      <PFCText variant="ui" size="xs" color={colors.textTertiary} style={{ width: 70 }}>{label}</PFCText>
      <View style={[styles.breakdownTrack, { backgroundColor: colors.surface }]}>
        <View
          style={[styles.breakdownFill, { width: `${Math.max(0, value) * 100}%`, backgroundColor: color }]}
        />
      </View>
      <PFCText variant="code" size="xs" color={color} style={{ width: 36, textAlign: 'right' }}>
        {Math.round(Math.max(0, value) * 100)}%
      </PFCText>
    </View>
  );
}

const styles = StyleSheet.create({
  confidenceCenter: {
    alignItems: 'center',
    marginBottom: 20,
  },
  rangeSection: {
    marginBottom: 20,
  },
  rangeTrack: {
    height: 16,
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  rangeBand: {
    position: 'absolute',
    top: 0,
    height: '100%',
    borderWidth: 1,
    borderRadius: 8,
  },
  rangePoint: {
    position: 'absolute',
    top: 2,
    width: 4,
    height: 12,
    borderRadius: 2,
    marginLeft: -2,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  gradeRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  gradeBadge: {
    width: 72,
    height: 72,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownCol: {
    flex: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  breakdownTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 3,
  },
  interpretation: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 4,
  },
});
