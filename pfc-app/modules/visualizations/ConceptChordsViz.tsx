import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../shared/theme';
import { PFCText } from '../shared/components/PFCText';
import { VisualizationCard } from './VisualizationCard';
import { usePFCStore } from '../store/usePFCStore';

export function ConceptChordsViz() {
  const { colors } = useTheme();
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const activeChordProduct = usePFCStore((s) => s.activeChordProduct);
  const harmonyKeyDistance = usePFCStore((s) => s.harmonyKeyDistance);

  const harmonyColor = harmonyKeyDistance > 0.6
    ? colors.semantic.error
    : harmonyKeyDistance > 0.3
    ? colors.semantic.warning
    : colors.semantic.success;

  const harmonyLabel = harmonyKeyDistance > 0.6
    ? 'dissonant — conceptual tension high'
    : harmonyKeyDistance > 0.3
    ? 'moderate — partial alignment'
    : 'consonant — concepts harmonized';

  return (
    <VisualizationCard
      title="CONCEPT HARMONICS"
      subtitle="leibnizian prime-encoded tracking"
      color={colors.semantic.success}
    >
      {/* Circular concept display */}
      <View style={styles.circleContainer}>
        {/* Outer ring of concepts */}
        {activeConcepts.length > 0 ? (
          <View style={styles.conceptRing}>
            {activeConcepts.map((concept, i) => {
              const angle = (i / activeConcepts.length) * 2 * Math.PI - Math.PI / 2;
              const radius = 80;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              return (
                <View
                  key={concept}
                  style={[
                    styles.conceptNode,
                    {
                      transform: [{ translateX: x }, { translateY: y }],
                      borderColor: colors.semantic.success + '80',
                      backgroundColor: colors.semantic.success + '10',
                    },
                  ]}
                >
                  <PFCText variant="code" size="xs" color={colors.semantic.success}>
                    {concept}
                  </PFCText>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyRing, { borderColor: colors.border }]}>
            <PFCText variant="body" size="xs" color={colors.textTertiary} center>
              no active concepts
            </PFCText>
          </View>
        )}

        {/* Center: chord product */}
        <View style={styles.chordCenter}>
          <PFCText variant="ui" size="xs" color={colors.textTertiary}>Π</PFCText>
          <PFCText variant="code" size="xl" color={colors.semantic.success} glow>
            {activeChordProduct}
          </PFCText>
        </View>
      </View>

      {/* Harmony meter */}
      <View style={styles.harmonySection}>
        <View style={styles.harmonyHeader}>
          <PFCText variant="ui" size="xs" color={colors.textTertiary}>KEY DISTANCE δ</PFCText>
          <PFCText variant="code" size="sm" color={harmonyColor} glow>
            {harmonyKeyDistance.toFixed(2)}
          </PFCText>
        </View>
        <View style={[styles.harmonyTrack, { backgroundColor: colors.surface }]}>
          <View
            style={[
              styles.harmonyFill,
              {
                width: `${Math.min(1, harmonyKeyDistance) * 100}%`,
                backgroundColor: harmonyColor,
              },
            ]}
          />
          {/* Threshold markers */}
          <View style={[styles.marker, { left: '30%', backgroundColor: colors.textTertiary }]} />
          <View style={[styles.marker, { left: '60%', backgroundColor: colors.textTertiary }]} />
        </View>
        <View style={styles.harmonyLabels}>
          <PFCText variant="ui" size="xs" color={colors.semantic.success}>consonant</PFCText>
          <PFCText variant="ui" size="xs" color={colors.semantic.error}>dissonant</PFCText>
        </View>
      </View>

      <View style={[styles.interpretation, { borderLeftColor: colors.semantic.success }]}>
        <PFCText variant="body" size="xs" color={harmonyColor}>▸ {harmonyLabel}</PFCText>
        <PFCText variant="body" size="xs" color={colors.textTertiary}>
          ▸ {activeConcepts.length} active concepts encoded
        </PFCText>
      </View>
    </VisualizationCard>
  );
}

const styles = StyleSheet.create({
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    marginBottom: 16,
  },
  conceptRing: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyRing: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 100,
    borderStyle: 'dashed',
  },
  conceptNode: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 3,
  },
  chordCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  harmonySection: {
    marginBottom: 16,
  },
  harmonyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  harmonyTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  harmonyFill: {
    height: '100%',
    borderRadius: 4,
  },
  marker: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: '100%',
  },
  harmonyLabels: {
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
