import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../modules/shared/theme';
import { elevation1, elevation2 } from '../../modules/shared/theme/elevation';
import { PFCText } from '../../modules/shared/components/PFCText';
import { PFCButton } from '../../modules/shared/components/PFCButton';
import { SparkleAnimation } from '../../modules/shared/components/SparkleAnimation';
import { TypewriterText } from '../../modules/shared/components/TypewriterText';
import { TruthBotCard } from '../../modules/shared/components/TruthBotCard';
import { FileUploadButton } from '../../modules/shared/components/FileUploadButton';
import { AttachmentPreview } from '../../modules/shared/components/AttachmentPreview';
import { MessageAttachments } from '../../modules/shared/components/MessageAttachments';
import { LiveBrief } from '../../modules/shared/components/LiveBrief';
import { CRTPanel } from '../../modules/shared/components/CRTPanel';
import { usePFCStore } from '../../modules/store/usePFCStore';
import { simulateQuery } from '../../modules/engine/simulate';
import { generateSynthesisReport } from '../../modules/engine/synthesizer';
import type { ChatMessage } from '../../modules/store/usePFCStore';

const screenWidth = Dimensions.get('window').width;
const isWideScreen = screenWidth >= 768;

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

// --- Uncertainty Badge ---
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[badgeStyles.badge, { borderColor: color + '60', backgroundColor: color + '12' }]}>
      <PFCText variant="code" size="xs" color={color}>{label}</PFCText>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1, marginRight: 4, marginTop: 4 },
});

// --- Layman Message View ---
function LaymanView({ msg, colors, animate }: { msg: ChatMessage; colors: any; animate: boolean }) {
  const layman = msg.dualMessage?.laymanSummary;
  if (!layman) {
    return animate ? (
      <TypewriterText text={msg.text} variant="body" size="md" color={colors.textPrimary} style={{ marginTop: 8 }} speed={100} />
    ) : (
      <PFCText variant="body" size="md" color={colors.textPrimary} style={{ marginTop: 8 }}>{msg.text}</PFCText>
    );
  }

  const sections = [
    { title: 'What We Tried', text: layman.whatWasTried, icon: '1' },
    { title: 'What Is Likely True', text: layman.whatIsLikelyTrue, icon: '2' },
    { title: 'Confidence', text: layman.confidenceExplanation, icon: '3' },
    { title: 'What Could Change', text: layman.whatCouldChange, icon: '4' },
    { title: 'Who Should Trust This', text: layman.whoShouldTrust, icon: '5' },
  ];

  return (
    <View style={{ marginTop: 8, gap: 12 }}>
      {sections.map((s) => (
        <View key={s.icon} style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[laymanStyles.numBadge, { backgroundColor: colors.brand.primary + '18' }]}>
              <PFCText variant="ui" size="xs" color={colors.brand.primary}>{s.icon}</PFCText>
            </View>
            <PFCText variant="ui" size="sm" color={colors.textPrimary}>{s.title}</PFCText>
          </View>
          {animate ? (
            <TypewriterText text={s.text} variant="body" size="sm" color={colors.textSecondary} style={{ marginLeft: 28 }} speed={120} />
          ) : (
            <PFCText variant="body" size="sm" color={colors.textSecondary} style={{ marginLeft: 28 }}>
              {s.text}
            </PFCText>
          )}
        </View>
      ))}
    </View>
  );
}

const laymanStyles = StyleSheet.create({
  numBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

// --- Raw Research View ---
function RawView({ msg, colors, animate }: { msg: ChatMessage; colors: any; animate: boolean }) {
  const dual = msg.dualMessage;
  const [showReflection, setShowReflection] = useState(false);

  return (
    <View style={{ marginTop: 8, gap: 8 }}>
      {animate ? (
        <TypewriterText text={dual?.rawAnalysis ?? msg.text} variant="body" size="md" color={colors.textPrimary} speed={100} />
      ) : (
        <PFCText variant="body" size="md" color={colors.textPrimary}>
          {dual?.rawAnalysis ?? msg.text}
        </PFCText>
      )}

      {/* Uncertainty + data flags */}
      {dual && (dual.uncertaintyTags.length > 0 || dual.modelVsDataFlags.length > 0) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 4 }}>
          {dual.uncertaintyTags.map((tag, i) => (
            <Badge key={`u-${i}`} label={tag.tag} color={colors.semantic.warning} />
          ))}
          {dual.modelVsDataFlags.map((flag, i) => (
            <Badge key={`d-${i}`} label={flag.source} color={colors.semantic.info} />
          ))}
        </View>
      )}

      {/* Arbitration consensus */}
      {dual?.arbitration && (
        <View style={[rawStyles.consensusBanner, { backgroundColor: dual.arbitration.consensus ? colors.semantic.success + '12' : colors.semantic.warning + '12', borderColor: dual.arbitration.consensus ? colors.semantic.success + '40' : colors.semantic.warning + '40' }]}>
          <PFCText variant="ui" size="xs" color={dual.arbitration.consensus ? colors.semantic.success : colors.semantic.warning}>
            {dual.arbitration.consensus ? 'Consensus Reached' : 'Split Decision'} — {dual.arbitration.votes.length} engines voted
          </PFCText>
        </View>
      )}

      {/* Reflection toggle */}
      {dual?.reflection && (
        <Pressable onPress={() => setShowReflection(!showReflection)}>
          <PFCText variant="ui" size="xs" color={colors.brand.accent}>
            {showReflection ? '\u25BE Hide Reflection' : '\u25B8 Show Reflection Pass'}
          </PFCText>
        </Pressable>
      )}

      {showReflection && dual?.reflection && (
        <View style={[rawStyles.reflectionBox, { borderLeftColor: colors.brand.accent, backgroundColor: colors.brand.accent + '08' }]}>
          <PFCText variant="ui" size="xs" color={colors.brand.accent} style={{ marginBottom: 4 }}>
            Self-Critical Questions
          </PFCText>
          {dual.reflection.selfCriticalQuestions.map((q, i) => (
            <PFCText key={i} variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 2 }}>
              {'\u2022'} {q}
            </PFCText>
          ))}
          {dual.reflection.adjustments.length > 0 && (
            <>
              <PFCText variant="ui" size="xs" color={colors.semantic.warning} style={{ marginTop: 8 }}>
                Adjustments Applied
              </PFCText>
              {dual.reflection.adjustments.map((a, i) => (
                <PFCText key={i} variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 2 }}>
                  {'\u2022'} {a}
                </PFCText>
              ))}
            </>
          )}
          <PFCText variant="code" size="xs" color={colors.textTertiary} style={{ marginTop: 8 }}>
            Least defensible: {dual.reflection.leastDefensibleClaim}
          </PFCText>
        </View>
      )}
    </View>
  );
}

const rawStyles = StyleSheet.create({
  consensusBanner: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  reflectionBox: { borderLeftWidth: 3, borderRadius: 4, padding: 10 },
});

// --- Synthesis Card ---
function SynthesisCard() {
  const { colors } = useTheme();
  const report = usePFCStore((s) => s.synthesisReport);
  const showSynthesis = usePFCStore((s) => s.showSynthesis);
  const [tab, setTab] = useState<'plain' | 'research'>('plain');

  if (!report || !showSynthesis) return null;

  return (
    <View style={[synthStyles.card, elevation2, { backgroundColor: colors.surfaceElevated, borderColor: colors.brand.primary + '40' }]}>
      <View style={synthStyles.header}>
        <PFCText variant="ui" size="sm" color={colors.brand.primary} glow>
          Synthesis Report
        </PFCText>
        <PFCText variant="code" size="xs" color={colors.textTertiary}>
          {new Date(report.timestamp).toLocaleTimeString()}
        </PFCText>
      </View>

      {/* Tab switcher */}
      <View style={synthStyles.tabs}>
        <Pressable
          onPress={() => setTab('plain')}
          style={[synthStyles.tab, tab === 'plain' && { borderBottomColor: colors.brand.primary, borderBottomWidth: 2 }]}
        >
          <PFCText variant="ui" size="xs" color={tab === 'plain' ? colors.brand.primary : colors.textTertiary}>
            Plain Summary
          </PFCText>
        </Pressable>
        <Pressable
          onPress={() => setTab('research')}
          style={[synthStyles.tab, tab === 'research' && { borderBottomColor: colors.brand.primary, borderBottomWidth: 2 }]}
        >
          <PFCText variant="ui" size="xs" color={tab === 'research' ? colors.brand.primary : colors.textTertiary}>
            Research Summary
          </PFCText>
        </Pressable>
      </View>

      <PFCText variant="body" size="sm" color={colors.textPrimary} style={{ marginTop: 8 }}>
        {tab === 'plain' ? report.plainSummary : report.researchSummary}
      </PFCText>

      {report.suggestions.length > 0 && (
        <View style={{ marginTop: 12, gap: 4 }}>
          <PFCText variant="ui" size="xs" color={colors.brand.accent}>Suggestions</PFCText>
          {report.suggestions.map((s, i) => (
            <PFCText key={i} variant="body" size="xs" color={colors.textSecondary}>
              {'\u2022'} {s}
            </PFCText>
          ))}
        </View>
      )}
    </View>
  );
}

const synthStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginHorizontal: 16, marginVertical: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tabs: { flexDirection: 'row', marginTop: 12, gap: 16 },
  tab: { paddingBottom: 6 },
});

// --- Main Screen ---
export default function QueryScreen() {
  const { colors, fonts, fontSizes, stateColors } = useTheme();

  const messages = usePFCStore((s) => s.messages);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const safetyState = usePFCStore((s) => s.safetyState);
  const activeStage = usePFCStore((s) => s.activeStage);
  const activeMessageLayer = usePFCStore((s) => s.activeMessageLayer);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);
  const showTruthBot = usePFCStore((s) => s.showTruthBot);
  const toggleMessageLayer = usePFCStore((s) => s.toggleMessageLayer);

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Track which messages have been animated (typewriter)
  const [animatedMessages, setAnimatedMessages] = useState<Set<string>>(new Set());

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isProcessing) return;
    setInputText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    simulateQuery(text);
  }, [inputText, isProcessing]);

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

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Mark message as animated after first render
  const markAnimated = useCallback((id: string) => {
    setAnimatedMessages((prev) => new Set(prev).add(id));
  }, []);

  const renderMessageList = () => (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.messageList}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<SynthesisCard />}
      renderItem={({ item }) => {
        const isUser = item.role === 'user';
        const shouldAnimate = !isUser && !animatedMessages.has(item.id);

        // Mark as animated after first render
        if (shouldAnimate) {
          setTimeout(() => markAnimated(item.id), 50);
        }

        return (
          <View>
            <View style={[
              styles.messageBubble,
              isUser
                ? [styles.userBubble, elevation2, { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary }]
                : [styles.systemBubble, elevation1, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }],
            ]}>
              {/* header row */}
              <View style={styles.msgHeader}>
                {!isUser && item.evidenceGrade && (
                  <Badge label={`GRADE: ${item.evidenceGrade}`} color={colors.semantic.warning} />
                )}
                {!isUser && item.confidence !== undefined && (
                  <Badge label={`C: ${Math.round(item.confidence * 100)}%`} color={colors.semantic.success} />
                )}
                <PFCText variant="code" size="xs" color={isUser ? colors.textInverse + '80' : colors.textTertiary} style={{ marginLeft: 'auto' }}>
                  {formatTimestamp(item.timestamp)}
                </PFCText>
              </View>

              {/* Attachments */}
              {item.attachments && item.attachments.length > 0 && (
                <MessageAttachments attachments={item.attachments} isUser={isUser} />
              )}

              {/* content */}
              {isUser ? (
                <PFCText variant="body" size="md" color={colors.textInverse} style={{ marginTop: 4 }}>
                  {item.text}
                </PFCText>
              ) : activeMessageLayer === 'layman' ? (
                <LaymanView msg={item} colors={colors} animate={shouldAnimate} />
              ) : (
                <RawView msg={item} colors={colors} animate={shouldAnimate} />
              )}
            </View>

            {/* Truth Bot card (after system messages) */}
            {!isUser && showTruthBot && item.truthAssessment && (
              <View style={{ marginHorizontal: 16, marginBottom: 4 }}>
                <TruthBotCard assessment={item.truthAssessment} />
              </View>
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <SparkleAnimation />
          <PFCText variant="pixel" size="xl" color={colors.brand.primary} center glow style={{ marginTop: 16 }}>
            Meta-Analytical PFC
          </PFCText>
          <PFCText variant="body" size="sm" color={colors.textSecondary} center style={{ marginTop: 8 }}>
            10-stage executive reasoning pipeline
          </PFCText>
          <PFCText variant="body" size="xs" color={colors.textTertiary} center style={{ marginTop: 4 }}>
            Enter a research query to begin analysis
          </PFCText>

          <View style={styles.exampleQueries}>
            <PFCText variant="ui" size="xs" color={colors.textTertiary} style={{ marginBottom: 10 }}>
              Try an example:
            </PFCText>
            {[
              'What is the effect of aspirin on secondary stroke prevention?',
              'Analyze the causal relationship between sleep and cognitive decline.',
              'Meta-analyze RCTs on SSRI efficacy for major depression.',
            ].map((q, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  simulateQuery(q);
                }}
                style={[styles.exampleCard, elevation1, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              >
                <PFCText variant="body" size="sm" color={colors.textSecondary}>
                  {q}
                </PFCText>
              </Pressable>
            ))}
          </View>
        </View>
      }
    />
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* header bar */}
      <View style={[styles.headerBar, { borderBottomColor: stateColors[safetyState] }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PFCText variant="pixel" size="lg" color={colors.brand.primary} glow>
            Meta-Analytical PFC
          </PFCText>
          {isProcessing && activeStage && (
            <PFCText variant="code" size="xs" color={colors.semantic.info} glow>
              {activeStage.toUpperCase()}...
            </PFCText>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Layer toggle */}
          <Pressable
            onPress={toggleMessageLayer}
            style={[styles.layerToggle, { borderColor: colors.brand.primary + '40', backgroundColor: colors.brand.primary + '08' }]}
          >
            <PFCText variant="ui" size="xs" color={colors.brand.primary}>
              {activeMessageLayer === 'layman' ? 'Plain' : 'Research'}
            </PFCText>
          </Pressable>

          {queriesProcessed > 0 && !isProcessing && (
            <Pressable
              onPress={handleSynthesize}
              style={[styles.synthBtn, { borderColor: colors.brand.primary + '60', backgroundColor: colors.brand.primary + '08' }]}
            >
              <PFCText variant="ui" size="xs" color={colors.brand.primary}>
                Synthesize
              </PFCText>
            </Pressable>
          )}
        </View>
      </View>

      {/* Main body: dual-panel on desktop, stacked on mobile */}
      {isWideScreen ? (
        <View style={styles.dualPanelRow}>
          {/* Left sidebar: LiveBrief */}
          <View style={styles.sidebarColumn}>
            <LiveBrief />
          </View>
          {/* Right content: message list */}
          <View style={styles.contentColumn}>
            {renderMessageList()}
          </View>
        </View>
      ) : (
        <View style={styles.mobileBody}>
          {/* Compact LiveBrief on mobile */}
          <LiveBrief compact onExpand={() => {}} />
          {renderMessageList()}
        </View>
      )}

      {/* Attachment preview area */}
      <AttachmentPreview />

      {/* input */}
      <View style={[styles.inputArea, { borderTopColor: colors.border }]}>
        <FileUploadButton disabled={isProcessing} />

        <TextInput
          style={[
            styles.input,
            {
              borderColor: colors.border,
              color: colors.textPrimary,
              fontFamily: fonts.serif,
              fontSize: fontSizes.md,
              backgroundColor: colors.surface,
            },
          ]}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask a research question..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={1000}
          editable={!isProcessing}
        />

        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || isProcessing}
          style={({ pressed }) => [
            styles.sendBtn,
            elevation1,
            {
              backgroundColor: (!inputText.trim() || isProcessing) ? colors.border : pressed ? colors.brand.primaryDark : colors.brand.primary,
              opacity: (!inputText.trim() || isProcessing) ? 0.4 : 1,
            },
          ]}
        >
          <PFCText variant="ui" size="lg" color={colors.textInverse} center>
            {'\u25B6'}
          </PFCText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  layerToggle: {
    borderWidth: 2,
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  synthBtn: {
    borderWidth: 2,
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  dualPanelRow: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarColumn: {
    width: 260,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  contentColumn: {
    flex: 1,
  },
  mobileBody: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderWidth: 1,
    borderRadius: 4,
    borderBottomRightRadius: 2,
  },
  systemBubble: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
    borderWidth: 2,
    borderRadius: 2,
  },
  msgHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  exampleQueries: {
    marginTop: 32,
    width: '100%',
  },
  exampleCard: {
    borderWidth: 1,
    borderRadius: 2,
    padding: 14,
    marginBottom: 8,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
