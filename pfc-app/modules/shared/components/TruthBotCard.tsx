import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { elevation2 } from '../theme/elevation';
import { PFCText } from './PFCText';
import type { TruthAssessment } from '../../engine/types';

interface TruthBotCardProps {
  assessment: TruthAssessment;
}

export function TruthBotCard({ assessment }: TruthBotCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const likelihoodPct = Math.round(assessment.overallTruthLikelihood * 100);
  const likelihoodColor =
    likelihoodPct > 70 ? colors.semantic.success :
    likelihoodPct > 45 ? colors.semantic.warning :
    colors.semantic.error;

  return (
    <View style={[styles.card, elevation2, {
      backgroundColor: colors.surface,
      borderColor: colors.brand.accent + '30',
    }]}>
      {/* Header */}
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.header}>
        <View style={styles.headerLeft}>
          <PFCText variant="code" size="sm" color={colors.brand.accent}>
            {'\u{1F52C}'}
          </PFCText>
          <PFCText variant="ui" size="sm" color={colors.brand.accent} glow>
            Truth Bot
          </PFCText>
        </View>

        {/* Truth likelihood gauge */}
        <View style={styles.gaugeArea}>
          <View style={[styles.gaugeTrack, { backgroundColor: colors.backgroundTertiary }]}>
            <View style={[styles.gaugeFill, {
              width: `${likelihoodPct}%`,
              backgroundColor: likelihoodColor,
            }]} />
          </View>
          <PFCText variant="code" size="xs" color={likelihoodColor}>
            {likelihoodPct}%
          </PFCText>
        </View>

        <PFCText variant="ui" size="xs" color={colors.textTertiary}>
          {expanded ? '\u25BE' : '\u25B8'}
        </PFCText>
      </Pressable>

      {/* Signal interpretation (always visible) */}
      <PFCText variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 8 }}>
        {assessment.signalInterpretation}
      </PFCText>

      {/* Expandable details */}
      {expanded && (
        <View style={styles.details}>
          {/* Confidence calibration */}
          <View style={[styles.section, { borderLeftColor: colors.semantic.info }]}>
            <PFCText variant="ui" size="xs" color={colors.semantic.info}>Confidence Calibration</PFCText>
            <PFCText variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 2 }}>
              {assessment.confidenceCalibration}
            </PFCText>
          </View>

          {/* Data vs Model */}
          <View style={[styles.section, { borderLeftColor: colors.semantic.warning }]}>
            <PFCText variant="ui" size="xs" color={colors.semantic.warning}>Data vs Model Balance</PFCText>
            <PFCText variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 2 }}>
              {assessment.dataVsModelBalance}
            </PFCText>
          </View>

          {/* Weaknesses */}
          {assessment.weaknesses.length > 0 && (
            <View style={styles.listSection}>
              <PFCText variant="ui" size="xs" color={colors.semantic.error}>Weaknesses</PFCText>
              {assessment.weaknesses.map((w, i) => (
                <PFCText key={i} variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  {'\u2022'} {w}
                </PFCText>
              ))}
            </View>
          )}

          {/* Blind Spots */}
          {assessment.blindSpots.length > 0 && (
            <View style={styles.listSection}>
              <PFCText variant="ui" size="xs" color={colors.semantic.warning}>Blind Spots</PFCText>
              {assessment.blindSpots.map((b, i) => (
                <PFCText key={i} variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  {'\u2022'} {b}
                </PFCText>
              ))}
            </View>
          )}

          {/* Improvements */}
          {assessment.improvements.length > 0 && (
            <View style={styles.listSection}>
              <PFCText variant="ui" size="xs" color={colors.semantic.success}>Suggested Improvements</PFCText>
              {assessment.improvements.map((imp, i) => (
                <PFCText key={i} variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  {'\u2022'} {imp}
                </PFCText>
              ))}
            </View>
          )}

          {/* Recommended Actions */}
          {assessment.recommendedActions.length > 0 && (
            <View style={styles.listSection}>
              <PFCText variant="ui" size="xs" color={colors.brand.primary}>Recommended Actions</PFCText>
              {assessment.recommendedActions.map((a, i) => (
                <PFCText key={i} variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  {i + 1}. {a}
                </PFCText>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gaugeArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  gaugeTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 2,
  },
  details: {
    marginTop: 12,
    gap: 10,
  },
  section: {
    borderLeftWidth: 2,
    paddingLeft: 10,
  },
  listSection: {
    gap: 2,
  },
});
