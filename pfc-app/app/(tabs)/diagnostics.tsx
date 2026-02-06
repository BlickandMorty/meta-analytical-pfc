import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../modules/shared/theme';
import { elevation1, elevation2 } from '../../modules/shared/theme/elevation';
import { PFCText } from '../../modules/shared/components/PFCText';
import { PFCButton } from '../../modules/shared/components/PFCButton';
import { ConfirmDialog } from '../../modules/shared/components/ConfirmDialog';
import { CRTPanel } from '../../modules/shared/components/CRTPanel';
import { usePFCStore } from '../../modules/store/usePFCStore';
import { generateSynthesisReport } from '../../modules/engine/synthesizer';

export default function DiagnosticsScreen() {
  const { colors, stateColors } = useTheme();

  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const dissonance = usePFCStore((s) => s.dissonance);
  const healthScore = usePFCStore((s) => s.healthScore);
  const safetyState = usePFCStore((s) => s.safetyState);
  const riskScore = usePFCStore((s) => s.riskScore);
  const tda = usePFCStore((s) => s.tda);
  const focusDepth = usePFCStore((s) => s.focusDepth);
  const temperatureScale = usePFCStore((s) => s.temperatureScale);
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const activeChordProduct = usePFCStore((s) => s.activeChordProduct);
  const harmonyKeyDistance = usePFCStore((s) => s.harmonyKeyDistance);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);
  const totalTraces = usePFCStore((s) => s.totalTraces);
  const skillGapsDetected = usePFCStore((s) => s.skillGapsDetected);
  const inferenceMode = usePFCStore((s) => s.inferenceMode);
  const messages = usePFCStore((s) => s.messages);
  const reset = usePFCStore((s) => s.reset);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetRequest = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowResetConfirm(true);
  }, []);

  const handleResetConfirm = useCallback(() => {
    setShowResetConfirm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    reset();
  }, [reset]);

  const handleSynthesize = useCallback(() => {
    const store = usePFCStore.getState();
    const report = generateSynthesisReport(store.messages, {
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
      inferenceMode: store.inferenceMode,
    });
    store.setSynthesisReport(report);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // Get last reflection from most recent system message
  const lastSystemMsg = [...messages].reverse().find((m) => m.role === 'system' && m.dualMessage);
  const reflection = lastSystemMsg?.dualMessage?.reflection;

  const statColor = (val: number, inverse = false) => {
    const v = inverse ? 1 - val : val;
    return v > 0.66 ? colors.semantic.success : v > 0.33 ? colors.semantic.warning : colors.semantic.error;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* header */}
      <View style={styles.header}>
        <PFCText variant="pixel" size="xxl" color={colors.brand.accent} glow center>
          Diagnostics
        </PFCText>
        <PFCText variant="ui" size="xs" color={colors.textSecondary} center style={{ marginTop: 4 }}>
          System signals, TDA, executive state
        </PFCText>
      </View>

      {/* Synthesize button */}
      {queriesProcessed > 0 && (
        <View style={styles.section}>
          <PFCButton
            label="Synthesize & Report"
            onPress={handleSynthesize}
            variant="primary"
            size="md"
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      )}

      {/* Reflection report */}
      {reflection && (
        <View style={styles.section}>
          <CRTPanel title="REFLECTION" accentColor={colors.brand.accent}>
            {reflection.selfCriticalQuestions.length > 0 && (
              <View style={{ marginTop: 8, gap: 4 }}>
                {reflection.selfCriticalQuestions.map((q, i) => (
                  <PFCText key={i} variant="body" size="xs" color={colors.textSecondary}>
                    {'\u2022'} {q}
                  </PFCText>
                ))}
              </View>
            )}

            {reflection.adjustments.length > 0 && (
              <View style={{ marginTop: 8, gap: 2 }}>
                <PFCText variant="ui" size="xs" color={colors.semantic.warning}>Adjustments</PFCText>
                {reflection.adjustments.map((a, i) => (
                  <PFCText key={i} variant="code" size="xs" color={colors.textTertiary}>{a}</PFCText>
                ))}
              </View>
            )}

            <PFCText variant="code" size="xs" color={colors.textTertiary} style={{ marginTop: 8 }}>
              {reflection.precisionVsEvidenceCheck}
            </PFCText>
          </CRTPanel>
        </View>
      )}

      {/* Core stats */}
      <View style={styles.statsGrid}>
        <StatBox label="Confidence" value={`${Math.round(confidence * 100)}%`} color={statColor(confidence)} colors={colors} />
        <StatBox label="Entropy" value={`${Math.round(entropy * 100)}%`} color={statColor(entropy, true)} colors={colors} />
        <StatBox label="Dissonance" value={`${Math.round(dissonance * 100)}%`} color={statColor(dissonance, true)} colors={colors} />
        <StatBox label="Health" value={`${Math.round(healthScore * 100)}%`} color={statColor(healthScore)} colors={colors} />
        <StatBox label="Safety" value={safetyState.toUpperCase()} color={stateColors[safetyState]} colors={colors} />
        <StatBox label="Risk" value={`${Math.round(riskScore * 100)}%`} color={statColor(riskScore, true)} colors={colors} />
        <StatBox label="Queries" value={`${queriesProcessed}`} color={colors.semantic.info} colors={colors} />
        <StatBox label="Traces" value={`${totalTraces}`} color={colors.textSecondary} colors={colors} />
        <StatBox label="Gaps" value={`${skillGapsDetected}`} color={skillGapsDetected > 0 ? colors.semantic.warning : colors.semantic.success} colors={colors} />
      </View>

      {/* TDA */}
      <View style={styles.section}>
        <PFCText variant="pixel" size="sm" color={colors.semantic.info}>Topological Data Analysis</PFCText>
        <PFCText variant="body" size="xs" color={colors.textTertiary} style={{ marginTop: 4, marginBottom: 12 }}>
          Persistent homology on activation manifolds
        </PFCText>

        <View style={styles.tdaGrid}>
          <TDAMetric label={'\u03B2\u2080'} sublabel="connected components" value={tda.betti0} color={colors.semantic.info} colors={colors} />
          <TDAMetric label={'\u03B2\u2081'} sublabel="1-cycles (loops)" value={tda.betti1} color={colors.brand.accent} colors={colors} />
          <TDAMetric label="H(persist)" sublabel="persistence entropy" value={tda.persistenceEntropy} color={colors.semantic.success} colors={colors} decimals={3} />
          <TDAMetric label={'\u2113_max'} sublabel="max persistence" value={tda.maxPersistence} color={colors.semantic.warning} colors={colors} decimals={3} />
        </View>

        <View style={[styles.tdaInterpretation, { borderLeftColor: colors.semantic.info }]}>
          <PFCText variant="body" size="xs" color={colors.textTertiary}>
            {'\u03B2\u2080'} = {tda.betti0 > 5 ? 'fragmented reasoning' : tda.betti0 > 2 ? 'multi-track reasoning' : 'focused reasoning'}
          </PFCText>
          <PFCText variant="body" size="xs" color={colors.textTertiary}>
            {'\u03B2\u2081'} = {tda.betti1 > 3 ? 'circular dependencies detected' : tda.betti1 > 0 ? 'minor loops present' : 'no cycles'}
          </PFCText>
        </View>
      </View>

      {/* Focus controller */}
      <View style={styles.section}>
        <PFCText variant="pixel" size="sm" color={colors.semantic.warning}>Focus Controller</PFCText>
        <PFCText variant="body" size="xs" color={colors.textTertiary} style={{ marginTop: 4, marginBottom: 12 }}>
          Entropy valve — modulates reasoning depth
        </PFCText>

        <View style={styles.focusRow}>
          <View style={[styles.focusBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <PFCText variant="ui" size="xs" color={colors.textTertiary}>Depth</PFCText>
            <PFCText variant="code" size="xxl" color={colors.brand.accent} glow center>{focusDepth.toFixed(1)}</PFCText>
            <View style={[styles.depthBar, { backgroundColor: colors.backgroundTertiary }]}>
              <View style={[styles.depthFill, { width: `${(focusDepth / 10) * 100}%`, backgroundColor: colors.brand.accent }]} />
            </View>
            <PFCText variant="body" size="xs" color={colors.textTertiary} center>range: 2-10</PFCText>
          </View>

          <View style={[styles.focusBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <PFCText variant="ui" size="xs" color={colors.textTertiary}>Temperature</PFCText>
            <PFCText variant="code" size="xxl" color={colors.semantic.warning} glow center>{temperatureScale.toFixed(2)}</PFCText>
            <View style={[styles.depthBar, { backgroundColor: colors.backgroundTertiary }]}>
              <View style={[styles.depthFill, { width: `${temperatureScale * 100}%`, backgroundColor: colors.semantic.warning }]} />
            </View>
            <PFCText variant="body" size="xs" color={colors.textTertiary} center>scale: 0-1</PFCText>
          </View>
        </View>
      </View>

      {/* Concept chords */}
      <View style={styles.section}>
        <PFCText variant="pixel" size="sm" color={colors.brand.primary}>Concept Harmonics</PFCText>
        <PFCText variant="body" size="xs" color={colors.textTertiary} style={{ marginTop: 4, marginBottom: 12 }}>
          Prime-encoded concept tracking
        </PFCText>

        <View style={styles.chordRow}>
          <View style={[styles.chordBox, { flex: 1, borderColor: colors.border, backgroundColor: colors.surface }]}>
            <PFCText variant="ui" size="xs" color={colors.textTertiary}>Chord Product</PFCText>
            <PFCText variant="code" size="lg" color={colors.brand.primary} glow>{'\u03A0'} = {activeChordProduct}</PFCText>
          </View>
          <View style={[styles.chordBox, { flex: 1, borderColor: colors.border, backgroundColor: colors.surface }]}>
            <PFCText variant="ui" size="xs" color={colors.textTertiary}>Key Distance</PFCText>
            <PFCText variant="code" size="lg" color={harmonyKeyDistance > 0.5 ? colors.semantic.warning : colors.semantic.success} glow>
              {'\u03B4'} = {harmonyKeyDistance.toFixed(2)}
            </PFCText>
          </View>
        </View>

        {activeConcepts.length > 0 && (
          <View style={styles.conceptList}>
            <PFCText variant="ui" size="xs" color={colors.textTertiary} style={{ marginBottom: 6 }}>Active Concepts:</PFCText>
            <View style={styles.conceptTags}>
              {activeConcepts.map((c, i) => (
                <View key={i} style={[styles.conceptTag, { borderColor: colors.brand.primary + '40', backgroundColor: colors.brand.primary + '08' }]}>
                  <PFCText variant="code" size="xs" color={colors.brand.primary}>{c}</PFCText>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Allostasis */}
      <View style={styles.section}>
        <PFCText variant="pixel" size="sm" color={stateColors[safetyState]}>Allostasis Engine</PFCText>
        <PFCText variant="body" size="xs" color={colors.textTertiary} style={{ marginTop: 4, marginBottom: 12 }}>
          Graded safety response system
        </PFCText>

        <View style={styles.safetyStates}>
          {(['green', 'yellow', 'red'] as const).map((state) => (
            <View
              key={state}
              style={[
                styles.safetyStateBox,
                {
                  borderColor: stateColors[state],
                  backgroundColor: safetyState === state ? stateColors[state] + '15' : colors.surface,
                  opacity: safetyState === state ? 1 : 0.4,
                  borderRadius: 2,
                },
              ]}
            >
              <PFCText variant="ui" size="sm" color={stateColors[state]} glow={safetyState === state} center>
                {state.toUpperCase()}
              </PFCText>
              <PFCText variant="code" size="xs" color={colors.textTertiary} center>
                {state === 'green' ? 'T=1.0' : state === 'yellow' ? 'T=0.7' : 'T=0.5'}
              </PFCText>
            </View>
          ))}
        </View>

        <View style={styles.riskBar}>
          <PFCText variant="ui" size="xs" color={colors.textTertiary}>Risk Score</PFCText>
          <View style={[styles.barOuter, { backgroundColor: colors.backgroundTertiary }]}>
            <View style={[styles.barInner, { width: `${riskScore * 100}%`, backgroundColor: stateColors[safetyState] }]} />
          </View>
          <PFCText variant="code" size="xs" color={stateColors[safetyState]}>{(riskScore * 100).toFixed(1)}%</PFCText>
        </View>
      </View>

      {/* System info */}
      <View style={styles.section}>
        <PFCText variant="code" size="xs" color={colors.textTertiary}>
          Mode: {inferenceMode.toUpperCase()} | Queries: {queriesProcessed} | Traces: {totalTraces}
        </PFCText>
      </View>

      {/* Reset */}
      <View style={styles.section}>
        <PFCButton
          label="Reset System"
          onPress={handleResetRequest}
          variant="danger"
          size="md"
        />
        <PFCText variant="body" size="xs" color={colors.textTertiary} center style={{ marginTop: 8 }}>
          Clear all signals, traces, and conversation history
        </PFCText>
      </View>

      <ConfirmDialog
        visible={showResetConfirm}
        title="System Reset"
        message="This will clear all signals, traces, conversation history, and return to initial state. This action cannot be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
      />
    </ScrollView>
  );
}

function StatBox({ label, value, color, colors }: { label: string; value: string; color: string; colors: any }) {
  return (
    <CRTPanel accentColor={color} style={statStyles.statBox}>
      <PFCText variant="pixel" size="xs" color={colors.textTertiary}>{label}</PFCText>
      <PFCText variant="code" size="lg" color={color} glow>{value}</PFCText>
    </CRTPanel>
  );
}

function TDAMetric({ label, sublabel, value, color, colors, decimals = 0 }: { label: string; sublabel: string; value: number; color: string; colors: any; decimals?: number }) {
  return (
    <CRTPanel accentColor={color} style={statStyles.tdaMetric}>
      <PFCText variant="code" size="xl" color={color} glow center>{decimals > 0 ? value.toFixed(decimals) : value}</PFCText>
      <PFCText variant="pixel" size="sm" color={color} center>{label}</PFCText>
      <PFCText variant="body" size="xs" color={colors.textTertiary} center>{sublabel}</PFCText>
    </CRTPanel>
  );
}

const statStyles = StyleSheet.create({
  statBox: {
    width: '30%', flexGrow: 1,
    alignItems: 'center',
  },
  tdaMetric: {
    width: '47%', flexGrow: 1,
    alignItems: 'center',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 24 },
  header: { paddingVertical: 16 },
  section: { gap: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tdaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tdaInterpretation: { marginTop: 8, paddingLeft: 12, borderLeftWidth: 2, gap: 2 },
  focusRow: { flexDirection: 'row', gap: 8 },
  focusBox: { flex: 1, borderWidth: 1, borderRadius: 2, padding: 16, alignItems: 'center', gap: 6 },
  depthBar: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  depthFill: { height: '100%', borderRadius: 2 },
  chordRow: { flexDirection: 'row', gap: 8 },
  chordBox: { borderWidth: 1, borderRadius: 2, padding: 12, gap: 4 },
  conceptList: { marginTop: 12 },
  conceptTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  conceptTag: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 4 },
  safetyStates: { flexDirection: 'row', gap: 8 },
  safetyStateBox: { flex: 1, borderWidth: 1.5, padding: 12, alignItems: 'center', gap: 4 },
  riskBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  barOuter: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  barInner: { height: '100%', borderRadius: 3 },
});
