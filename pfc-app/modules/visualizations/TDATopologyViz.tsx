import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../shared/theme';
import { PFCText } from '../shared/components/PFCText';
import { VisualizationCard } from './VisualizationCard';
import { usePFCStore } from '../store/usePFCStore';

export function TDATopologyViz() {
  const { colors } = useTheme();
  const tda = usePFCStore((s) => s.tda);

  const bettiData = [
    {
      label: 'β₀',
      sublabel: 'connected components',
      value: tda.betti0,
      max: 8,
      color: colors.semantic.info,
    },
    {
      label: 'β₁',
      sublabel: '1-cycles (loops)',
      value: tda.betti1,
      max: 5,
      color: colors.brand.accent,
    },
  ];

  const interpretation =
    tda.betti0 > 5
      ? 'fragmented — many disconnected reasoning tracks'
      : tda.betti0 > 2
      ? 'multi-track — parallel reasoning active'
      : 'focused — reasoning well-connected';

  const loopNote =
    tda.betti1 > 3
      ? 'circular dependencies detected'
      : tda.betti1 > 0
      ? 'minor loops present'
      : 'no topological cycles';

  return (
    <VisualizationCard
      title="TOPOLOGICAL DATA ANALYSIS"
      subtitle="persistent homology on activation manifolds"
      color={colors.semantic.info}
    >
      {/* Betti barcode diagram */}
      <View style={styles.barcodeSection}>
        <PFCText variant="ui" size="xs" color={colors.textTertiary} style={{ marginBottom: 12 }}>
          BETTI BARCODE
        </PFCText>
        {bettiData.map((b) => (
          <View key={b.label} style={styles.barcodeRow}>
            <PFCText variant="code" size="sm" color={b.color} style={{ width: 30 }}>
              {b.label}
            </PFCText>
            <View style={styles.barcodeTrack}>
              {Array.from({ length: b.value }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.barcodeBar,
                    {
                      backgroundColor: b.color,
                      width: `${(60 + Math.random() * 35)}%`,
                      opacity: 0.5 + (i / b.max) * 0.5,
                    },
                  ]}
                />
              ))}
              {b.value === 0 && (
                <PFCText variant="body" size="xs" color={colors.textTertiary} style={{ paddingVertical: 4 }}>
                  none
                </PFCText>
              )}
            </View>
            <PFCText variant="code" size="sm" color={b.color} glow style={{ width: 24, textAlign: 'right' }}>
              {b.value}
            </PFCText>
          </View>
        ))}
      </View>

      {/* Numeric readouts */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <PFCText variant="ui" size="xs" color={colors.textTertiary}>H(persist)</PFCText>
          <PFCText variant="code" size="lg" color={colors.semantic.success} glow>
            {tda.persistenceEntropy.toFixed(3)}
          </PFCText>
          <PFCText variant="ui" size="xs" color={colors.textTertiary}>entropy</PFCText>
        </View>
        <View style={[styles.metricBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <PFCText variant="ui" size="xs" color={colors.textTertiary}>ℓ_max</PFCText>
          <PFCText variant="code" size="lg" color={colors.semantic.warning} glow>
            {tda.maxPersistence.toFixed(3)}
          </PFCText>
          <PFCText variant="ui" size="xs" color={colors.textTertiary}>max persistence</PFCText>
        </View>
      </View>

      {/* Interpretation */}
      <View style={[styles.interpretation, { borderLeftColor: colors.semantic.info }]}>
        <PFCText variant="body" size="xs" color={colors.semantic.info}>▸ {interpretation}</PFCText>
        <PFCText variant="body" size="xs" color={colors.brand.accent}>▸ {loopNote}</PFCText>
      </View>
    </VisualizationCard>
  );
}

const styles = StyleSheet.create({
  barcodeSection: {
    marginBottom: 20,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  barcodeTrack: {
    flex: 1,
    gap: 2,
  },
  barcodeBar: {
    height: 4,
    borderRadius: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  interpretation: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    gap: 4,
  },
});
