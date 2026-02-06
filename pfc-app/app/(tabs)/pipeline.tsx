import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../modules/shared/theme';
import { elevation1, elevation2 } from '../../modules/shared/theme/elevation';
import { PFCText } from '../../modules/shared/components/PFCText';
import { CRTPanel } from '../../modules/shared/components/CRTPanel';
import { usePFCStore, STAGE_LABELS } from '../../modules/store/usePFCStore';
import type { StageStatus } from '../../modules/store/usePFCStore';

const STATUS_SYMBOLS: Record<StageStatus, string> = {
  idle: '\u25CB',
  active: '\u25C9',
  complete: '\u25CF',
  error: '\u2715',
};

export default function PipelineScreen() {
  const { colors, stateColors } = useTheme();

  const stages = usePFCStore((s) => s.pipelineStages);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const confidence = usePFCStore((s) => s.confidence);
  const focusDepth = usePFCStore((s) => s.focusDepth);
  const temperatureScale = usePFCStore((s) => s.temperatureScale);
  const safetyState = usePFCStore((s) => s.safetyState);

  const completedCount = stages.filter((s) => s.status === 'complete').length;

  const statusColor = (status: StageStatus) => {
    switch (status) {
      case 'idle': return colors.textTertiary;
      case 'active': return colors.semantic.info;
      case 'complete': return colors.semantic.success;
      case 'error': return colors.semantic.error;
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* header */}
      <View style={styles.header}>
        <PFCText variant="pixel" size="xxl" color={colors.brand.primary} glow center>
          Executive Pipeline
        </PFCText>
        <PFCText variant="ui" size="xs" color={colors.textSecondary} center style={{ marginTop: 4 }}>
          10-stage prefrontal cortex reasoning system
        </PFCText>
      </View>

      {/* progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressRow}>
          <PFCText variant="ui" size="xs" color={colors.textSecondary}>Progress</PFCText>
          <PFCText variant="code" size="xs" color={colors.brand.primary}>{completedCount}/10</PFCText>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.backgroundTertiary }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(completedCount / 10) * 100}%`,
                backgroundColor: isProcessing ? colors.semantic.info : colors.brand.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* control state */}
      <View style={styles.controlRow}>
        <ControlBox label="Depth" value={focusDepth.toFixed(1)} color={colors.brand.accent} colors={colors} />
        <ControlBox label="Temp" value={temperatureScale.toFixed(2)} color={colors.semantic.warning} colors={colors} />
        <ControlBox label="Safety" value={safetyState.toUpperCase()} color={stateColors[safetyState]} colors={colors} />
        <ControlBox label="Conf" value={`${Math.round(confidence * 100)}%`} color={colors.brand.primary} colors={colors} />
      </View>

      {/* stages */}
      <View style={styles.stageList}>
        {stages.map((stage, index) => {
          const sColor = statusColor(stage.status);
          const isActive = stage.status === 'active';

          return (
            <View key={stage.stage}>
              <CRTPanel
                accentColor={isActive ? colors.semantic.info : stage.status === 'complete' ? sColor : undefined}
                style={[
                  styles.stageCard,
                  isActive ? elevation2 : elevation1,
                  {
                    backgroundColor: isActive ? colors.semantic.info + '08' : colors.surface,
                  },
                ]}
              >
                <View style={styles.stageHeader}>
                  <View style={[styles.stageNum, { backgroundColor: sColor + '18' }]}>
                    <PFCText variant="code" size="xs" color={sColor}>
                      {String(index + 1).padStart(2, '0')}
                    </PFCText>
                  </View>
                  <PFCText variant="code" size="xs" color={sColor}>
                    {STATUS_SYMBOLS[stage.status]}
                  </PFCText>
                  <PFCText
                    variant="ui"
                    size="md"
                    color={isActive ? colors.semantic.info : stage.status === 'complete' ? colors.textPrimary : colors.textSecondary}
                    glow={isActive}
                    style={{ flex: 1, marginLeft: 8 }}
                  >
                    {STAGE_LABELS[stage.stage]}
                  </PFCText>
                </View>

                {stage.detail && (
                  <PFCText variant="body" size="xs" color={colors.textTertiary} style={{ marginTop: 4, marginLeft: 44 }}>
                    {stage.detail}
                  </PFCText>
                )}

                {stage.value !== undefined && (
                  <View style={[styles.valueBar, { marginTop: 6, marginLeft: 44, backgroundColor: colors.backgroundTertiary }]}>
                    <View
                      style={[
                        styles.valueFill,
                        {
                          width: `${Math.min(stage.value * 100, 100)}%`,
                          backgroundColor: sColor,
                        },
                      ]}
                    />
                  </View>
                )}
              </CRTPanel>

              {index < stages.length - 1 && (
                <View style={styles.connector}>
                  <View
                    style={[
                      styles.connectorLine,
                      {
                        backgroundColor: stage.status === 'complete' ? colors.brand.primary + '30' : colors.border,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ControlBox({ label, value, color, colors }: { label: string; value: string; color: string; colors: any }) {
  return (
    <CRTPanel
      accentColor={color}
      noPadding
      style={[boxStyles.controlBox, elevation1]}
    >
      <View style={boxStyles.controlBoxInner}>
        <PFCText variant="pixel" size="xs" color={colors.textTertiary}>{label}</PFCText>
        <PFCText variant="code" size="lg" color={color} glow>{value}</PFCText>
      </View>
    </CRTPanel>
  );
}

const boxStyles = StyleSheet.create({
  controlBox: {
    flex: 1,
  },
  controlBoxInner: {
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { paddingVertical: 16 },
  progressSection: { marginBottom: 16 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  controlRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  stageList: { gap: 0 },
  stageCard: { padding: 12 },
  stageHeader: { flexDirection: 'row', alignItems: 'center' },
  stageNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  connector: { alignItems: 'center', height: 12 },
  connectorLine: { width: 1, height: '100%' },
  valueBar: { height: 3, borderRadius: 2, overflow: 'hidden' },
  valueFill: { height: '100%', borderRadius: 2 },
});
