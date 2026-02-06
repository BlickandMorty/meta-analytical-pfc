import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../shared/theme';
import { PFCText } from '../shared/components/PFCText';
import { VisualizationCard } from './VisualizationCard';
import { usePFCStore, STAGE_LABELS } from '../store/usePFCStore';
import type { StageStatus } from '../store/usePFCStore';

function statusIcon(status: StageStatus): string {
  switch (status) {
    case 'complete': return '\u2713';
    case 'active': return '\u25B8';
    case 'error': return '\u2717';
    default: return '\u25CB';
  }
}

export function PipelineFlowViz() {
  const { colors, stateColors } = useTheme();
  const pipelineStages = usePFCStore((s) => s.pipelineStages);
  const isProcessing = usePFCStore((s) => s.isProcessing);

  function statusColor(status: StageStatus): string {
    return stateColors[status] ?? colors.textTertiary;
  }

  const completedCount = pipelineStages.filter((s) => s.status === 'complete').length;
  const progress = completedCount / pipelineStages.length;

  return (
    <VisualizationCard
      title="PIPELINE FLOW"
      subtitle="10-stage executive reasoning flow"
      color={colors.semantic.info}
    >
      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <PFCText variant="ui" size="xs" color={colors.textTertiary}>PIPELINE PROGRESS</PFCText>
          <PFCText variant="code" size="xs" color={colors.semantic.info}>
            {completedCount}/{pipelineStages.length}
          </PFCText>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: colors.semantic.info },
            ]}
          />
        </View>
      </View>

      {/* Pipeline flow - compact vertical */}
      <View style={styles.flowContainer}>
        {pipelineStages.map((stage, i) => {
          const sColor = statusColor(stage.status);
          const isActive = stage.status === 'active';

          return (
            <View key={stage.stage}>
              {/* Node */}
              <View style={styles.nodeRow}>
                {/* Status icon */}
                <View
                  style={[
                    styles.nodeIcon,
                    {
                      borderColor: sColor,
                      backgroundColor: isActive ? sColor + '20' : 'transparent',
                    },
                  ]}
                >
                  <PFCText
                    variant="code"
                    size="xs"
                    color={sColor}
                    glow={isActive}
                    center
                  >
                    {statusIcon(stage.status)}
                  </PFCText>
                </View>

                {/* Label */}
                <View style={styles.nodeLabel}>
                  <PFCText
                    variant="ui"
                    size="sm"
                    color={isActive ? sColor : stage.status === 'complete' ? sColor : colors.textTertiary}
                    glow={isActive}
                  >
                    {STAGE_LABELS[stage.stage]}
                  </PFCText>
                  {stage.detail && stage.status !== 'idle' && (
                    <PFCText variant="body" size="xs" color={colors.textTertiary} style={{ marginTop: 1 }}>
                      {stage.detail.length > 50 ? stage.detail.slice(0, 47) + '...' : stage.detail}
                    </PFCText>
                  )}
                </View>

                {/* Value indicator */}
                {stage.value !== undefined && stage.status !== 'idle' && (
                  <View style={styles.nodeValue}>
                    <View style={[styles.miniBar, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.miniBarFill,
                          {
                            width: `${(stage.value ?? 0) * 100}%`,
                            backgroundColor: sColor,
                          },
                        ]}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Connector */}
              {i < pipelineStages.length - 1 && (
                <View style={styles.connector}>
                  <View
                    style={[
                      styles.connectorLine,
                      {
                        backgroundColor:
                          stage.status === 'complete'
                            ? colors.semantic.success + '40'
                            : colors.border,
                      },
                    ]}
                  />
                  {/* Animated dot for active transitions */}
                  {isProcessing && stage.status === 'complete' && i < pipelineStages.length - 1 && pipelineStages[i + 1].status === 'active' && (
                    <View style={[styles.flowDot, { backgroundColor: colors.semantic.info }]} />
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={[styles.interpretation, { borderLeftColor: colors.semantic.info }]}>
        <PFCText variant="body" size="xs" color={isProcessing ? colors.semantic.info : colors.semantic.success}>
          ▸ {isProcessing ? 'pipeline active — processing query' : completedCount > 0 ? 'pipeline complete' : 'awaiting query input'}
        </PFCText>
      </View>
    </VisualizationCard>
  );
}

const styles = StyleSheet.create({
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  flowContainer: {
    marginBottom: 12,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  nodeIcon: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLabel: {
    flex: 1,
  },
  nodeValue: {
    width: 40,
  },
  miniBar: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  connector: {
    marginLeft: 11,
    height: 8,
    justifyContent: 'center',
  },
  connectorLine: {
    width: 2,
    height: '100%',
    borderRadius: 1,
  },
  flowDot: {
    position: 'absolute',
    left: -1,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  interpretation: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 4,
  },
});
