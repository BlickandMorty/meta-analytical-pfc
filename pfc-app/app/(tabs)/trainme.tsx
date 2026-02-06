import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../modules/shared/theme';
import { elevation1, elevation2 } from '../../modules/shared/theme/elevation';
import { PFCText } from '../../modules/shared/components/PFCText';
import { PFCButton } from '../../modules/shared/components/PFCButton';
import { usePFCStore } from '../../modules/store/usePFCStore';
import { generateTrainMeReport } from '../../modules/engine/trainme';
import type { TrainingInsight } from '../../modules/engine/types';

// ---------------------------------------------------------------------------
// Category & priority color maps
// ---------------------------------------------------------------------------

type CategoryKey = TrainingInsight['category'];
type PriorityKey = TrainingInsight['priority'];

const CATEGORY_COLOR_KEY: Record<CategoryKey, 'accent' | 'info' | 'warning' | 'success' | 'error'> = {
  architecture: 'accent',
  data: 'info',
  optimization: 'warning',
  evaluation: 'success',
  alignment: 'error',
};

const PRIORITY_COLOR_KEY: Record<PriorityKey, 'error' | 'warning' | 'info'> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveSemantic(key: string, colors: any): string {
  if (key === 'accent') return colors.brand.accent;
  return colors.semantic[key] ?? colors.textSecondary;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function TrainMeScreen() {
  const { colors, fonts, fontSizes, isArcade } = useTheme();

  const trainMeReport = usePFCStore((s) => s.trainMeReport);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);

  const [expandedInsights, setExpandedInsights] = useState<Record<string, boolean>>({});
  const [researcherNotesExpanded, setResearcherNotesExpanded] = useState(false);

  // --- Generate report ---

  const handleGenerate = useCallback(() => {
    const store = usePFCStore.getState();
    const report = generateTrainMeReport(
      store.messages,
      {
        confidence: store.confidence,
        entropy: store.entropy,
        dissonance: store.dissonance,
        healthScore: store.healthScore,
        safetyState: store.safetyState,
        riskScore: store.riskScore,
        tda: store.tda,
        focusDepth: store.focusDepth,
        temperatureScale: store.temperatureScale,
        activeConcepts: store.activeConcepts,
        activeChordProduct: store.activeChordProduct,
        harmonyKeyDistance: store.harmonyKeyDistance,
        queriesProcessed: store.queriesProcessed,
        totalTraces: store.totalTraces,
        skillGapsDetected: store.skillGapsDetected,
      },
      store.latestTruthAssessment,
    );
    store.setTrainMeReport(report);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // --- Toggle insight expansion ---

  const toggleInsight = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedInsights((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // --- Toggle researcher notes ---

  const toggleResearcherNotes = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResearcherNotesExpanded((prev) => !prev);
  }, []);

  // --- Improvement item color ---

  const improvementColor = (text: string): string => {
    if (text.startsWith('[URGENT]')) return colors.semantic.error;
    if (text.startsWith('[RECOMMENDED]')) return colors.semantic.warning;
    if (text.startsWith('[OPTIONAL]')) return colors.semantic.info;
    return colors.textSecondary;
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <View style={styles.header}>
        <PFCText variant="pixel" size="xxl" color={colors.brand.accent} glow center>
          Meta-Engineering Lab
        </PFCText>
        <PFCText variant="ui" size="xs" color={colors.textSecondary} center style={{ marginTop: 4 }}>
          AI copilot for training pipeline optimization
        </PFCText>
      </View>

      {/* ----------------------------------------------------------------- */}
      {/* Generate button                                                   */}
      {/* ----------------------------------------------------------------- */}
      <View style={styles.section}>
        <PFCButton
          label="Generate Training Report"
          onPress={handleGenerate}
          variant="primary"
          size="lg"
          style={{ alignSelf: 'stretch' }}
        />
      </View>

      {/* ----------------------------------------------------------------- */}
      {/* Empty state                                                       */}
      {/* ----------------------------------------------------------------- */}
      {!trainMeReport && queriesProcessed === 0 && (
        <View style={styles.emptyState}>
          <PFCText variant="ui" size="sm" color={colors.textTertiary} center>
            {'\u2014'}
          </PFCText>
          <PFCText variant="body" size="sm" color={colors.textTertiary} center style={{ marginTop: 8 }}>
            Submit research queries to generate training insights
          </PFCText>
        </View>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Report content                                                    */}
      {/* ----------------------------------------------------------------- */}
      {trainMeReport && (
        <>
          {/* ------------------------------------------------------------- */}
          {/* Self-Assessment Card                                          */}
          {/* ------------------------------------------------------------- */}
          <View
            style={[
              styles.card,
              elevation2,
              {
                backgroundColor: colors.surface,
                borderColor: colors.brand.accent + '40',
              },
            ]}
          >
            <PFCText variant="pixel" size="sm" color={colors.brand.accent}>
              System Self-Assessment
            </PFCText>
            <PFCText
              variant="body"
              size="sm"
              color={colors.textSecondary}
              style={{ marginTop: 10, lineHeight: 20 }}
            >
              {trainMeReport.systemSelfAssessment}
            </PFCText>
          </View>

          {/* ------------------------------------------------------------- */}
          {/* Prioritized Improvements                                      */}
          {/* ------------------------------------------------------------- */}
          {trainMeReport.prioritizedImprovements.length > 0 && (
            <View style={styles.section}>
              <PFCText variant="pixel" size="sm" color={colors.brand.primary} style={{ marginBottom: 8 }}>
                Prioritized Improvements
              </PFCText>
              {trainMeReport.prioritizedImprovements.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.improvementItem,
                    elevation1,
                    {
                      backgroundColor: colors.surface,
                      borderLeftColor: improvementColor(item),
                    },
                  ]}
                >
                  <PFCText variant="ui" size="sm" color={improvementColor(item)}>
                    {item}
                  </PFCText>
                </View>
              ))}
            </View>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Training Insights (expandable)                                */}
          {/* ------------------------------------------------------------- */}
          {trainMeReport.insights.length > 0 && (
            <View style={styles.section}>
              <PFCText variant="pixel" size="sm" color={colors.semantic.info} style={{ marginBottom: 8 }}>
                Training Insights
              </PFCText>
              {trainMeReport.insights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  expanded={!!expandedInsights[insight.id]}
                  onToggle={() => toggleInsight(insight.id)}
                  colors={colors}
                  fonts={fonts}
                  fontSizes={fontSizes}
                  isArcade={isArcade}
                />
              ))}
            </View>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Researcher Notes (collapsible)                                */}
          {/* ------------------------------------------------------------- */}
          <Pressable
            onPress={toggleResearcherNotes}
            style={[
              styles.researcherNotesHeader,
              elevation1,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <PFCText variant="pixel" size="sm" color={colors.textPrimary}>
              Researcher Notes
            </PFCText>
            <PFCText variant="code" size="sm" color={colors.textTertiary}>
              {researcherNotesExpanded ? '\u25B2' : '\u25BC'}
            </PFCText>
          </Pressable>
          {researcherNotesExpanded && (
            <View
              style={[
                styles.researcherNotesBody,
                {
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <PFCText
                variant="code"
                size="xs"
                color={colors.textSecondary}
                style={{ lineHeight: 18 }}
              >
                {trainMeReport.researcherNotes}
              </PFCText>
            </View>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Timestamp                                                     */}
          {/* ------------------------------------------------------------- */}
          <View style={styles.timestampRow}>
            <PFCText variant="code" size="xs" color={colors.textTertiary}>
              Report generated: {formatTimestamp(trainMeReport.timestamp)}
            </PFCText>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ===========================================================================
// Insight Card (sub-component)
// ===========================================================================

function InsightCard({
  insight,
  expanded,
  onToggle,
  colors,
  fonts,
  fontSizes,
  isArcade,
}: {
  insight: TrainingInsight;
  expanded: boolean;
  onToggle: () => void;
  colors: any;
  fonts: any;
  fontSizes: any;
  isArcade: boolean;
}) {
  const categoryColor = resolveSemantic(CATEGORY_COLOR_KEY[insight.category], colors);
  const priorityColor = resolveSemantic(PRIORITY_COLOR_KEY[insight.priority], colors);

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.insightCard,
        elevation1,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
        },
      ]}
    >
      {/* Badges row */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: categoryColor + '18', borderColor: categoryColor + '40' }]}>
          <PFCText variant="ui" size="xs" color={categoryColor}>
            {insight.category}
          </PFCText>
        </View>
        <View style={[styles.badge, { backgroundColor: priorityColor + '18', borderColor: priorityColor + '40' }]}>
          <PFCText variant="ui" size="xs" color={priorityColor}>
            {insight.priority}
          </PFCText>
        </View>
      </View>

      {/* Title */}
      <PFCText variant="ui" size="md" color={colors.textPrimary} style={{ marginTop: 8 }}>
        {insight.title}
      </PFCText>

      {/* Observation */}
      <PFCText variant="body" size="sm" color={colors.textSecondary} style={{ marginTop: 6, lineHeight: 20 }}>
        {insight.observation}
      </PFCText>

      {/* Expand indicator */}
      <PFCText variant="code" size="xs" color={colors.textTertiary} style={{ marginTop: 8 }}>
        {expanded ? '\u25B2 collapse' : '\u25BC expand'}
      </PFCText>

      {/* Expanded content */}
      {expanded && (
        <View style={[styles.expandedContent, { borderTopColor: colors.borderSubtle }]}>
          {/* Hypothesis */}
          <View style={styles.expandedSection}>
            <PFCText variant="ui" size="sm" color={colors.brand.accent}>
              Hypothesis
            </PFCText>
            <PFCText variant="body" size="sm" color={colors.textSecondary} style={{ marginTop: 4, lineHeight: 20 }}>
              {insight.hypothesis}
            </PFCText>
          </View>

          {/* Experiment details */}
          <View style={[styles.experimentCard, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]}>
            <PFCText variant="ui" size="sm" color={colors.brand.primary}>
              Experiment: {insight.experiment.name}
            </PFCText>
            <PFCText variant="body" size="sm" color={colors.textSecondary} style={{ marginTop: 6, lineHeight: 20 }}>
              {insight.experiment.description}
            </PFCText>

            <View style={{ marginTop: 10 }}>
              <PFCText variant="ui" size="xs" color={colors.textTertiary}>
                Methodology
              </PFCText>
              <PFCText variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 2, lineHeight: 18 }}>
                {insight.experiment.methodology}
              </PFCText>
            </View>

            <View style={{ marginTop: 10 }}>
              <PFCText variant="ui" size="xs" color={colors.textTertiary}>
                Expected Outcome
              </PFCText>
              <PFCText variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 2, lineHeight: 18 }}>
                {insight.experiment.expectedOutcome}
              </PFCText>
            </View>

            {/* Difficulty + time + tools row */}
            <View style={styles.experimentMeta}>
              <View style={[styles.badge, { backgroundColor: colors.brand.accent + '18', borderColor: colors.brand.accent + '40' }]}>
                <PFCText variant="ui" size="xs" color={colors.brand.accent}>
                  {DIFFICULTY_LABEL[insight.experiment.difficulty] ?? insight.experiment.difficulty}
                </PFCText>
              </View>
              <PFCText variant="code" size="xs" color={colors.textTertiary}>
                ~{insight.experiment.estimatedTime}
              </PFCText>
            </View>

            {/* Required tools */}
            {insight.experiment.requiredTools.length > 0 && (
              <View style={styles.toolsList}>
                <PFCText variant="ui" size="xs" color={colors.textTertiary} style={{ marginBottom: 4 }}>
                  Required Tools
                </PFCText>
                <View style={styles.tagsRow}>
                  {insight.experiment.requiredTools.map((tool, i) => (
                    <View
                      key={i}
                      style={[styles.tag, { backgroundColor: colors.semantic.info + '12', borderColor: colors.semantic.info + '30' }]}
                    >
                      <PFCText variant="code" size="xs" color={colors.semantic.info}>
                        {tool}
                      </PFCText>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Related signals */}
          {insight.relatedSignals.length > 0 && (
            <View style={styles.relatedSignals}>
              <PFCText variant="ui" size="xs" color={colors.textTertiary} style={{ marginBottom: 4 }}>
                Related Signals
              </PFCText>
              <View style={styles.tagsRow}>
                {insight.relatedSignals.map((signal, i) => (
                  <View
                    key={i}
                    style={[styles.tag, { backgroundColor: colors.brand.primary + '10', borderColor: colors.brand.primary + '30' }]}
                  >
                    <PFCText variant="code" size="xs" color={colors.brand.primary}>
                      {signal}
                    </PFCText>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ===========================================================================
// Styles
// ===========================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 24,
  },
  header: {
    paddingVertical: 16,
  },
  section: {
    gap: 4,
  },

  // Empty state
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Self-assessment card
  card: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 16,
  },

  // Prioritized improvements
  improvementItem: {
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },

  // Insight card
  insightCard: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 14,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  // Expanded content
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 14,
  },
  expandedSection: {},
  experimentCard: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 14,
  },
  experimentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  toolsList: {
    marginTop: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  relatedSignals: {
    marginTop: 2,
  },

  // Researcher notes
  researcherNotesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 2,
    padding: 14,
  },
  researcherNotesBody: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    padding: 14,
    marginTop: -12,
  },

  // Timestamp
  timestampRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});
