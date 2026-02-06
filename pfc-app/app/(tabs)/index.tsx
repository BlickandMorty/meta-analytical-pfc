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
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
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
    <View style={[badgeStyles.badge, { borderColor: color + '40', backgroundColor: color + '0A' }]}>
      <PFCText variant="code" size="xs" color={color}>{label}</PFCText>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginTop: 4 },
});

// --- Processing Indicator ---
function ProcessingIndicator() {
  const { colors } = useTheme();
  const activeStage = usePFCStore((s) => s.activeStage);

  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View style={[procStyles.container, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      <View style={procStyles.dots}>
        <Animated.View style={[procStyles.dot, { backgroundColor: colors.semantic.info }, dotStyle]} />
        <Animated.View style={[procStyles.dot, { backgroundColor: colors.semantic.info, opacity: 0.6 }, dotStyle]} />
        <Animated.View style={[procStyles.dot, { backgroundColor: colors.semantic.info, opacity: 0.3 }, dotStyle]} />
      </View>
      {activeStage && (
        <PFCText variant="code" size="xs" color={colors.semantic.info}>
          {activeStage.replace('_', ' ')}
        </PFCText>
      )}
    </View>
  );
}

const procStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    borderTopLeftRadius: 4,
    marginHorizontal: 16,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
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
    <View style={{ marginTop: 10, gap: 14 }}>
      {sections.map((s) => (
        <View key={s.icon} style={{ gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[laymanStyles.numBadge, { backgroundColor: colors.brand.primary + '15' }]}>
              <PFCText variant="ui" size="xs" color={colors.brand.primary}>{s.icon}</PFCText>
            </View>
            <PFCText variant="ui" size="sm" color={colors.textPrimary}>{s.title}</PFCText>
          </View>
          {animate ? (
            <TypewriterText text={s.text} variant="body" size="sm" color={colors.textSecondary} style={{ marginLeft: 32, lineHeight: 20 }} speed={120} />
          ) : (
            <PFCText variant="body" size="sm" color={colors.textSecondary} style={{ marginLeft: 32, lineHeight: 20 }}>
              {s.text}
            </PFCText>
          )}
        </View>
      ))}
    </View>
  );
}

const laymanStyles = StyleSheet.create({
  numBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});

// --- Raw Research View ---
function RawView({ msg, colors, animate }: { msg: ChatMessage; colors: any; animate: boolean }) {
  const dual = msg.dualMessage;
  const [showReflection, setShowReflection] = useState(false);

  return (
    <View style={{ marginTop: 8, gap: 10 }}>
      {animate ? (
        <TypewriterText text={dual?.rawAnalysis ?? msg.text} variant="body" size="md" color={colors.textPrimary} speed={100} />
      ) : (
        <PFCText variant="body" size="md" color={colors.textPrimary} style={{ lineHeight: 22 }}>
          {dual?.rawAnalysis ?? msg.text}
        </PFCText>
      )}

      {/* Uncertainty + data flags */}
      {dual && (dual.uncertaintyTags.length > 0 || dual.modelVsDataFlags.length > 0) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
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
        <View style={[rawStyles.consensusBanner, { backgroundColor: dual.arbitration.consensus ? colors.semantic.success + '0A' : colors.semantic.warning + '0A', borderColor: dual.arbitration.consensus ? colors.semantic.success + '30' : colors.semantic.warning + '30' }]}>
          <PFCText variant="ui" size="xs" color={dual.arbitration.consensus ? colors.semantic.success : colors.semantic.warning}>
            {dual.arbitration.consensus ? 'Consensus Reached' : 'Split Decision'} \u2014 {dual.arbitration.votes.length} engines voted
          </PFCText>
        </View>
      )}

      {/* Reflection toggle */}
      {dual?.reflection && (
        <Pressable
          onPress={() => setShowReflection(!showReflection)}
          style={({ pressed }) => [
            rawStyles.reflectionToggle,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <PFCText variant="ui" size="xs" color={colors.brand.accent}>
            {showReflection ? '\u25BE Hide Reflection' : '\u25B8 Show Reflection Pass'}
          </PFCText>
        </Pressable>
      )}

      {showReflection && dual?.reflection && (
        <View style={[rawStyles.reflectionBox, { borderLeftColor: colors.brand.accent, backgroundColor: colors.brand.accent + '06' }]}>
          <PFCText variant="ui" size="xs" color={colors.brand.accent} style={{ marginBottom: 6 }}>
            Self-Critical Questions
          </PFCText>
          {dual.reflection.selfCriticalQuestions.map((q, i) => (
            <PFCText key={i} variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 3, lineHeight: 16 }}>
              \u2022 {q}
            </PFCText>
          ))}
          {dual.reflection.adjustments.length > 0 && (
            <>
              <PFCText variant="ui" size="xs" color={colors.semantic.warning} style={{ marginTop: 10 }}>
                Adjustments Applied
              </PFCText>
              {dual.reflection.adjustments.map((a, i) => (
                <PFCText key={i} variant="body" size="xs" color={colors.textSecondary} style={{ marginTop: 3, lineHeight: 16 }}>
                  \u2022 {a}
                </PFCText>
              ))}
            </>
          )}
          <PFCText variant="code" size="xs" color={colors.textTertiary} style={{ marginTop: 10 }}>
            Least defensible: {dual.reflection.leastDefensibleClaim}
          </PFCText>
        </View>
      )}
    </View>
  );
}

const rawStyles = StyleSheet.create({
  consensusBanner: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  reflectionToggle: { paddingVertical: 4 },
  reflectionBox: { borderLeftWidth: 3, borderRadius: 6, padding: 12 },
});

// --- Synthesis Card ---
function SynthesisCard() {
  const { colors } = useTheme();
  const report = usePFCStore((s) => s.synthesisReport);
  const showSynthesis = usePFCStore((s) => s.showSynthesis);
  const [tab, setTab] = useState<'plain' | 'research'>('plain');

  if (!report || !showSynthesis) return null;

  return (
    <View style={[synthStyles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.brand.primary + '30' }]}>
      <View style={synthStyles.header}>
        <PFCText variant="ui" size="sm" color={colors.brand.primary} glow>
          Synthesis Report
        </PFCText>
        <PFCText variant="code" size="xs" color={colors.textTertiary}>
          {new Date(report.timestamp).toLocaleTimeString()}
        </PFCText>
      </View>

      {/* Tab switcher */}
      <View style={[synthStyles.tabs, { borderBottomColor: colors.border + '30' }]}>
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

      <PFCText variant="body" size="sm" color={colors.textPrimary} style={{ marginTop: 12, lineHeight: 20 }}>
        {tab === 'plain' ? report.plainSummary : report.researchSummary}
      </PFCText>

      {report.suggestions.length > 0 && (
        <View style={{ marginTop: 14, gap: 4 }}>
          <PFCText variant="ui" size="xs" color={colors.brand.accent}>Suggestions</PFCText>
          {report.suggestions.map((s, i) => (
            <PFCText key={i} variant="body" size="xs" color={colors.textSecondary} style={{ lineHeight: 16 }}>
              \u2022 {s}
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
  tabs: { flexDirection: 'row', marginTop: 12, gap: 16, borderBottomWidth: 1, paddingBottom: 0 },
  tab: { paddingBottom: 8, paddingHorizontal: 2 },
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
  const showSynthesis = usePFCStore((s) => s.showSynthesis);
  const toggleMessageLayer = usePFCStore((s) => s.toggleMessageLayer);

  const [inputText, setInputText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
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
    if (store.showSynthesis) {
      store.toggleSynthesisView();
      return;
    }
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
    setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 150);
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
      ListFooterComponent={isProcessing ? <ProcessingIndicator /> : null}
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
                ? [styles.userBubble, { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary }]
                : [styles.systemBubble, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }],
            ]}>
              {/* header row */}
              <View style={styles.msgHeader}>
                {!isUser && item.evidenceGrade && (
                  <Badge label={`GRADE: ${item.evidenceGrade}`} color={colors.semantic.warning} />
                )}
                {!isUser && item.confidence !== undefined && (
                  <Badge label={`C: ${Math.round(item.confidence * 100)}%`} color={colors.semantic.success} />
                )}
                <PFCText variant="code" size="xs" color={isUser ? colors.textInverse + '70' : colors.textTertiary} style={{ marginLeft: 'auto' }}>
                  {formatTimestamp(item.timestamp)}
                </PFCText>
              </View>

              {/* Attachments */}
              {item.attachments && item.attachments.length > 0 && (
                <MessageAttachments attachments={item.attachments} isUser={isUser} />
              )}

              {/* content */}
              {isUser ? (
                <PFCText variant="body" size="md" color={colors.textInverse} style={{ marginTop: 4, lineHeight: 22 }}>
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
          <PFCText variant="body" size="sm" color={colors.textSecondary} center style={{ marginTop: 8, lineHeight: 20 }}>
            10-stage executive reasoning pipeline
          </PFCText>
          <PFCText variant="body" size="xs" color={colors.textTertiary} center style={{ marginTop: 4 }}>
            Enter a research query to begin analysis
          </PFCText>

          <View style={styles.exampleQueries}>
            <PFCText variant="ui" size="xs" color={colors.textTertiary} style={{ marginBottom: 12 }}>
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
                style={({ pressed }) => [
                  styles.exampleCard,
                  {
                    backgroundColor: pressed ? colors.surface : colors.surface,
                    borderColor: pressed ? colors.brand.primary + '40' : colors.borderSubtle,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <PFCText variant="body" size="sm" color={colors.textSecondary} style={{ lineHeight: 19 }}>
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
      <View style={[styles.headerBar, { borderBottomColor: colors.border + '40' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PFCText variant="pixel" size="sm" color={colors.brand.primary} glow>
            Meta-Analytical PFC
          </PFCText>
          {isProcessing && activeStage && (
            <View style={[styles.processingPill, { backgroundColor: colors.semantic.info + '12', borderColor: colors.semantic.info + '30' }]}>
              <View style={[styles.processingDot, { backgroundColor: colors.semantic.info }]} />
              <PFCText variant="code" size="xs" color={colors.semantic.info}>
                {activeStage.replace('_', ' ')}
              </PFCText>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Layer toggle */}
          <Pressable
            onPress={toggleMessageLayer}
            style={({ pressed }) => [
              styles.headerBtn,
              {
                borderColor: colors.border + '60',
                backgroundColor: pressed ? colors.brand.primary + '10' : 'transparent',
              },
            ]}
          >
            <PFCText variant="ui" size="xs" color={colors.textSecondary}>
              {activeMessageLayer === 'layman' ? 'Plain' : 'Research'}
            </PFCText>
          </Pressable>

          {queriesProcessed > 0 && !isProcessing && (
            <Pressable
              onPress={handleSynthesize}
              style={({ pressed }) => [
                styles.headerBtn,
                {
                  borderColor: showSynthesis ? colors.brand.primary + '60' : colors.border + '60',
                  backgroundColor: showSynthesis
                    ? colors.brand.primary + '15'
                    : pressed
                    ? colors.brand.primary + '10'
                    : 'transparent',
                },
              ]}
            >
              <PFCText variant="ui" size="xs" color={showSynthesis ? colors.brand.primary : colors.textSecondary}>
                {showSynthesis ? 'Hide Report' : 'Synthesize'}
              </PFCText>
            </Pressable>
          )}
        </View>
      </View>

      {/* Main body: dual-panel on desktop, stacked on mobile */}
      {isWideScreen ? (
        <View style={styles.dualPanelRow}>
          {/* Left sidebar: LiveBrief */}
          <View style={[styles.sidebarColumn, { borderRightColor: colors.border + '30' }]}>
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

      {/* input area */}
      <View style={[styles.inputArea, { borderTopColor: colors.border + '40', backgroundColor: colors.background }]}>
        <FileUploadButton disabled={isProcessing} />

        <View style={[
          styles.inputWrapper,
          {
            borderColor: inputFocused ? colors.brand.primary + '50' : colors.border + '60',
            backgroundColor: colors.surface,
          },
        ]}>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.textPrimary,
                fontFamily: fonts.serif,
                fontSize: fontSizes.md,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="Ask a research question..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={1000}
            editable={!isProcessing}
            onSubmitEditing={handleSend}
          />
        </View>

        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || isProcessing}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: (!inputText.trim() || isProcessing)
                ? colors.border + '40'
                : pressed
                ? colors.brand.primaryDark
                : colors.brand.primary,
              transform: [{ scale: pressed && inputText.trim() ? 0.92 : 1 }],
            },
          ]}
        >
          <PFCText variant="ui" size="md" color={(!inputText.trim() || isProcessing) ? colors.textTertiary : colors.textInverse} center>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  processingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  processingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dualPanelRow: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarColumn: {
    width: 260,
    borderRightWidth: 1,
  },
  contentColumn: {
    flex: 1,
  },
  mobileBody: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 16,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  systemBubble: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
    borderWidth: 1,
    borderRadius: 16,
    borderTopLeftRadius: 4,
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
    paddingHorizontal: 24,
  },
  exampleQueries: {
    marginTop: 32,
    width: '100%',
    maxWidth: 500,
  },
  exampleCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
