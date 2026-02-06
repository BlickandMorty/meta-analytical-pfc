import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { PFCText } from './PFCText';
import { CRTPanel } from './CRTPanel';
import { usePFCStore } from '../../store/usePFCStore';

interface LiveBriefProps {
  compact?: boolean;
  onExpand?: () => void;
}

export function LiveBrief({ compact = false, onExpand }: LiveBriefProps) {
  const { colors, stateColors } = useTheme();

  const isProcessing = usePFCStore((s) => s.isProcessing);
  const activeStage = usePFCStore((s) => s.activeStage);
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const dissonance = usePFCStore((s) => s.dissonance);
  const healthScore = usePFCStore((s) => s.healthScore);
  const safetyState = usePFCStore((s) => s.safetyState);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);
  const messages = usePFCStore((s) => s.messages);

  // Get last system message summary
  const lastSystemMsg = [...messages].reverse().find((m) => m.role === 'system');
  const lastSummary = lastSystemMsg?.dualMessage?.laymanSummary?.whatIsLikelyTrue
    ?? lastSystemMsg?.text?.slice(0, 120);

  const statusText = isProcessing
    ? (activeStage?.toUpperCase() ?? 'PROCESSING')
    : queriesProcessed > 0
    ? 'READY'
    : 'IDLE';

  const statusColor = isProcessing
    ? colors.semantic.info
    : queriesProcessed > 0
    ? colors.semantic.success
    : colors.textTertiary;

  // Compact mode: single-row summary for mobile
  if (compact) {
    return (
      <Pressable onPress={onExpand} style={[styles.compactRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <PFCText variant="pixel" size="xs" color={statusColor}>
          {statusText}
        </PFCText>
        <View style={styles.compactSignals}>
          <SignalMini label="C" value={confidence} colors={colors} />
          <SignalMini label="E" value={entropy} colors={colors} inverse />
          <SignalMini label="D" value={dissonance} colors={colors} inverse />
        </View>
        <View style={[styles.safetyDot, { backgroundColor: stateColors[safetyState] }]}>
          <PFCText variant="pixel" size="xs" color={colors.textInverse}>
            {safetyState[0].toUpperCase()}
          </PFCText>
        </View>
      </Pressable>
    );
  }

  // Full panel mode (desktop sidebar)
  return (
    <CRTPanel title="LIVE BRIEF" accentColor={colors.semantic.info}>
      {/* Status */}
      <View style={styles.row}>
        <PFCText variant="pixel" size="xs" color={colors.textTertiary}>
          STATUS
        </PFCText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <PFCText variant="pixel" size="xs" color={statusColor}>
            {statusText}
          </PFCText>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Signal gauges */}
      <View style={styles.gaugeGrid}>
        <SignalGauge label="CONF" value={confidence} color={gaugeColor(confidence, false, colors)} colors={colors} />
        <SignalGauge label="ENTR" value={entropy} color={gaugeColor(entropy, true, colors)} colors={colors} />
        <SignalGauge label="DISS" value={dissonance} color={gaugeColor(dissonance, true, colors)} colors={colors} />
        <SignalGauge label="HLTH" value={healthScore} color={gaugeColor(healthScore, false, colors)} colors={colors} />
      </View>

      {/* Safety state */}
      <View style={styles.row}>
        <PFCText variant="pixel" size="xs" color={colors.textTertiary}>
          SAFETY
        </PFCText>
        <View style={[styles.safetyPill, { borderColor: stateColors[safetyState], backgroundColor: stateColors[safetyState] + '18' }]}>
          <PFCText variant="pixel" size="xs" color={stateColors[safetyState]}>
            {safetyState.toUpperCase()}
          </PFCText>
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Last result summary */}
      {lastSummary ? (
        <View style={styles.summarySection}>
          <PFCText variant="pixel" size="xs" color={colors.textTertiary}>
            LATEST
          </PFCText>
          <PFCText variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 4, lineHeight: 16 }}>
            {lastSummary.length > 160 ? lastSummary.slice(0, 157) + '...' : lastSummary}
          </PFCText>
        </View>
      ) : (
        <PFCText variant="body" size="xs" color={colors.textTertiary} center>
          No analysis yet
        </PFCText>
      )}

      {/* Query count */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.row}>
        <PFCText variant="pixel" size="xs" color={colors.textTertiary}>
          QUERIES
        </PFCText>
        <PFCText variant="pixel" size="sm" color={colors.brand.primary} glow>
          {queriesProcessed}
        </PFCText>
      </View>
    </CRTPanel>
  );
}

// --- Helpers ---

function gaugeColor(value: number, inverse: boolean, colors: any): string {
  const v = inverse ? 1 - value : value;
  return v > 0.66 ? colors.semantic.success : v > 0.33 ? colors.semantic.warning : colors.semantic.error;
}

function SignalGauge({ label, value, color, colors }: { label: string; value: number; color: string; colors: any }) {
  const pct = Math.round(value * 100);
  return (
    <View style={gaugeStyles.gauge}>
      <PFCText variant="pixel" size="xs" color={colors.textTertiary}>{label}</PFCText>
      <View style={[gaugeStyles.bar, { backgroundColor: colors.backgroundTertiary }]}>
        <View style={[gaugeStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <PFCText variant="code" size="xs" color={color}>{pct}%</PFCText>
    </View>
  );
}

function SignalMini({ label, value, colors, inverse = false }: { label: string; value: number; colors: any; inverse?: boolean }) {
  const color = gaugeColor(value, inverse, colors);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <PFCText variant="code" size="xs" color={colors.textTertiary}>{label}</PFCText>
      <PFCText variant="code" size="xs" color={color}>{Math.round(value * 100)}</PFCText>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  gauge: {
    flex: 1,
    minWidth: '45%',
    gap: 2,
  },
  bar: {
    height: 4,
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 1,
  },
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  gaugeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 4,
  },
  safetyPill: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  summarySection: {
    marginVertical: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  compactSignals: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  safetyDot: {
    width: 18,
    height: 18,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
