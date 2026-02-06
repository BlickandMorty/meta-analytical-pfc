import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../modules/shared/theme';
import { PFCText } from '../../modules/shared/components/PFCText';
import { PFCButton } from '../../modules/shared/components/PFCButton';
import { ResearchRain } from '../../modules/visualizations/ResearchRain';
import { TDATopologyViz } from '../../modules/visualizations/TDATopologyViz';
import { FocusControllerViz } from '../../modules/visualizations/FocusControllerViz';
import { ConceptChordsViz } from '../../modules/visualizations/ConceptChordsViz';
import { SafetyStateMachineViz } from '../../modules/visualizations/SafetyStateMachineViz';
import { ConfidenceCalibrationViz } from '../../modules/visualizations/ConfidenceCalibrationViz';
import { EntropyDissonanceViz } from '../../modules/visualizations/EntropyDissonanceViz';
import { PipelineFlowViz } from '../../modules/visualizations/PipelineFlowViz';

const VISUALIZATIONS = [
  { key: 'tda', Component: TDATopologyViz },
  { key: 'focus', Component: FocusControllerViz },
  { key: 'concepts', Component: ConceptChordsViz },
  { key: 'safety', Component: SafetyStateMachineViz },
  { key: 'confidence', Component: ConfidenceCalibrationViz },
  { key: 'entropy', Component: EntropyDissonanceViz },
  { key: 'pipeline', Component: PipelineFlowViz },
] as const;

const VIZ_COUNT = VISUALIZATIONS.length;

export default function VisualizerScreen() {
  const { colors } = useTheme();

  const [activeIndex, setActiveIndex] = useState(0);
  const [autoCycle, setAutoCycle] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const screenWidth = Dimensions.get('window').width;

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const newIndex = Math.round(offsetX / screenWidth);
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < VIZ_COUNT) {
        setActiveIndex(newIndex);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [activeIndex, screenWidth]
  );

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(VIZ_COUNT - 1, index));
      scrollRef.current?.scrollTo({ x: clamped * screenWidth, animated: true });
      setActiveIndex(clamped);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [screenWidth]
  );

  useEffect(() => {
    if (autoCycle) {
      timerRef.current = setInterval(() => {
        setActiveIndex((prev) => {
          const next = (prev + 1) % VIZ_COUNT;
          scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
          return next;
        });
      }, 5000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoCycle, screenWidth]);

  const toggleAutoCycle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAutoCycle((prev) => !prev);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ResearchRain background — always visible */}
      <ResearchRain />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <PFCText variant="ui" size="xs" color={colors.textTertiary}>
          Visualization {activeIndex + 1}/{VIZ_COUNT}
        </PFCText>
        <Pressable
          onPress={toggleAutoCycle}
          style={[styles.autoCycleBtn, { borderColor: autoCycle ? colors.brand.primary : colors.border }]}
        >
          <PFCText variant="ui" size="xs" color={autoCycle ? colors.brand.primary : colors.textTertiary} glow={autoCycle}>
            {autoCycle ? 'Auto On' : 'Auto Off'}
          </PFCText>
        </Pressable>
      </View>

      {/* Horizontal scrolling visualizations */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {VISUALIZATIONS.map(({ key, Component }) => (
          <View key={key} style={[styles.vizPage, { width: screenWidth }]}>
            <Component />
          </View>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View style={styles.dotRow}>
        {VISUALIZATIONS.map((_, i) => (
          <Pressable key={i} onPress={() => goTo(i)}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: i === activeIndex ? colors.brand.primary : colors.border,
                  width: i === activeIndex ? 16 : 6,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>

      {/* Nav arrows */}
      <View style={styles.navRow}>
        <PFCButton
          label={'\u25C2'}
          onPress={() => goTo(activeIndex - 1)}
          variant="ghost"
          size="sm"
          disabled={activeIndex === 0}
        />
        <PFCText variant="body" size="xs" color={colors.textTertiary} center style={{ flex: 1 }}>
          Swipe or tap arrows
        </PFCText>
        <PFCButton
          label={'\u25B8'}
          onPress={() => goTo(activeIndex + 1)}
          variant="ghost"
          size="sm"
          disabled={activeIndex === VIZ_COUNT - 1}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    zIndex: 2,
  },
  autoCycleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
    zIndex: 1,
  },
  vizPage: {
    flex: 1,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    zIndex: 2,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    zIndex: 2,
  },
});
