import React, { useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { PFCText } from './PFCText';
import { usePFCStore } from '../../store/usePFCStore';

const SIDEBAR_WIDTH = 288;

const SPRING_CONFIG = {
  damping: 28,
  stiffness: 320,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const SPRING_SNAPPY = {
  damping: 24,
  stiffness: 400,
  mass: 0.6,
};

interface NavItem {
  key: string;
  label: string;
  icon: string;
  route: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'chat', label: 'Chat', icon: '\u25C9', route: 'index' },
  { key: 'pipeline', label: 'Pipeline', icon: '\u25B2', route: 'pipeline' },
  { key: 'diagnostics', label: 'Diagnostics', icon: '\u25C8', route: 'diagnostics' },
  { key: 'visualize', label: 'Visualize', icon: '\u25C7', route: 'visualizer' },
  { key: 'trainme', label: 'Train Me', icon: '\uD83E\uDDEA', route: 'trainme' },
];

// Relative time formatter
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export function Sidebar({ isOpen, onToggle, activeRoute, onNavigate }: SidebarProps) {
  const { colors, stateColors } = useTheme();
  const insets = useSafeAreaInsets();

  const messages = usePFCStore((s) => s.messages);
  const confidence = usePFCStore((s) => s.confidence);
  const safetyState = usePFCStore((s) => s.safetyState);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const activeStage = usePFCStore((s) => s.activeStage);
  const trainMeReport = usePFCStore((s) => s.trainMeReport);

  // Get user queries for conversation history
  const userQueries = useMemo(() =>
    messages
      .filter((m) => m.role === 'user')
      .slice(-15)
      .reverse(),
    [messages]
  );

  const insightCount = trainMeReport?.insights.length ?? 0;

  // --- Animation values ---
  const slideProgress = useSharedValue(isOpen ? 1 : 0);
  const overlayOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(isOpen ? 1 : 0);

  useEffect(() => {
    if (isOpen) {
      slideProgress.value = withSpring(1, SPRING_CONFIG);
      overlayOpacity.value = withTiming(1, { duration: 200 });
      contentOpacity.value = withDelay(80, withTiming(1, { duration: 180 }));
    } else {
      contentOpacity.value = withTiming(0, { duration: 120 });
      slideProgress.value = withSpring(0, SPRING_SNAPPY);
      overlayOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [isOpen]);

  // Sidebar animated styles
  const sidebarAnimStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      slideProgress.value,
      [0, 1],
      [-SIDEBAR_WIDTH, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateX }],
    };
  });

  // Content fade
  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // Overlay
  const overlayAnimStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: isOpen ? ('auto' as const) : ('none' as const),
  }));

  const screenWidth = Dimensions.get('window').width;
  const isMobile = screenWidth < 768;

  // Status info
  const statusText = isProcessing
    ? (activeStage?.replace('_', ' ').toUpperCase() ?? 'PROCESSING')
    : queriesProcessed > 0 ? 'READY' : 'IDLE';
  const statusColor = isProcessing
    ? colors.semantic.info
    : queriesProcessed > 0 ? colors.semantic.success : colors.textTertiary;

  return (
    <>
      {/* Overlay */}
      {isMobile && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            overlayAnimStyle,
            { zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)' },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onToggle} />
        </Animated.View>
      )}

      {/* Sidebar panel */}
      <Animated.View
        style={[
          styles.sidebar,
          sidebarAnimStyle,
          {
            backgroundColor: colors.backgroundSecondary,
            borderRightColor: colors.border + '60',
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
          isMobile && styles.sidebarMobile,
          // Subtle shadow on the right edge
          Platform.OS === 'web' ? {
            // @ts-ignore web-only
            boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
          } : {},
        ]}
      >
        <Animated.View style={[styles.sidebarContent, contentAnimStyle]}>
          {/* ====== HEADER ====== */}
          <View style={[styles.header, { borderBottomColor: colors.border + '40' }]}>
            <View style={styles.logoSection}>
              <View style={[styles.logoIcon, {
                backgroundColor: colors.brand.primary + '15',
                borderColor: colors.brand.primary + '30',
              }]}>
                <PFCText variant="pixel" size="xs" color={colors.brand.primary} glow>
                  P
                </PFCText>
              </View>
              <View>
                <PFCText variant="pixel" size="sm" color={colors.brand.primary} glow>
                  PFC
                </PFCText>
                <PFCText variant="code" size="xs" color={colors.textTertiary} style={{ marginTop: -1 }}>
                  v3.0
                </PFCText>
              </View>
            </View>
            <Pressable
              onPress={onToggle}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: pressed ? colors.textTertiary + '18' : 'transparent',
                },
              ]}
            >
              <PFCText variant="ui" size="lg" color={colors.textTertiary}>
                {'\u2715'}
              </PFCText>
            </Pressable>
          </View>

          {/* ====== NEW ANALYSIS BUTTON ====== */}
          <Pressable
            style={({ pressed }) => [
              styles.newChatBtn,
              {
                borderColor: colors.brand.primary + (pressed ? '60' : '30'),
                backgroundColor: pressed ? colors.brand.primary + '10' : 'transparent',
              },
            ]}
            onPress={() => {
              onNavigate('index');
              if (isMobile) onToggle();
            }}
          >
            <PFCText variant="ui" size="sm" color={colors.brand.primary}>
              +
            </PFCText>
            <PFCText variant="ui" size="sm" color={colors.textSecondary}>
              New Analysis
            </PFCText>
          </Pressable>

          {/* ====== NAVIGATION ====== */}
          <View style={styles.navSection}>
            <PFCText variant="ui" size="xs" color={colors.textTertiary} style={styles.sectionLabel}>
              Navigation
            </PFCText>
            {NAV_ITEMS.map((item) => {
              const isActive = activeRoute === item.route ||
                (activeRoute === 'index' && item.key === 'chat');
              return (
                <NavButton
                  key={item.key}
                  item={item}
                  isActive={isActive}
                  insightCount={item.key === 'trainme' ? insightCount : 0}
                  colors={colors}
                  onPress={() => {
                    onNavigate(item.route);
                    if (isMobile) onToggle();
                  }}
                />
              );
            })}
          </View>

          {/* ====== DIVIDER ====== */}
          <View style={[styles.divider, { backgroundColor: colors.border + '40' }]} />

          {/* ====== CONVERSATION HISTORY ====== */}
          <View style={styles.historySection}>
            <View style={styles.historyHeaderRow}>
              <PFCText variant="ui" size="xs" color={colors.textTertiary} style={styles.sectionLabel}>
                Recent
              </PFCText>
              {userQueries.length > 0 && (
                <PFCText variant="code" size="xs" color={colors.textTertiary} style={{ paddingRight: 16 }}>
                  {userQueries.length}
                </PFCText>
              )}
            </View>
          </View>

          <ScrollView
            style={styles.historyScroll}
            contentContainerStyle={styles.historyContent}
            showsVerticalScrollIndicator={false}
          >
            {userQueries.length === 0 ? (
              <View style={styles.emptyHistory}>
                <PFCText variant="body" size="xs" color={colors.textTertiary} center>
                  No queries yet.{'\n'}Start by asking a research question.
                </PFCText>
              </View>
            ) : (
              userQueries.map((msg) => (
                <Pressable
                  key={msg.id}
                  style={({ pressed }) => [
                    styles.historyItem,
                    {
                      backgroundColor: pressed ? colors.textTertiary + '0A' : 'transparent',
                    },
                  ]}
                >
                  <PFCText
                    variant="body"
                    size="xs"
                    color={colors.textSecondary}
                    style={{ lineHeight: 17 }}
                  >
                    {msg.text.length > 70 ? msg.text.slice(0, 67) + '\u2026' : msg.text}
                  </PFCText>
                  <PFCText variant="code" size="xs" color={colors.textTertiary} style={{ marginTop: 2 }}>
                    {relativeTime(msg.timestamp)}
                  </PFCText>
                </Pressable>
              ))
            )}
          </ScrollView>

          {/* ====== FOOTER STATUS BAR ====== */}
          <View style={[styles.footer, { borderTopColor: colors.border + '40' }]}>
            {/* Status row */}
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <PFCText variant="code" size="xs" color={statusColor}>
                  {statusText}
                </PFCText>
              </View>
              <View style={[
                styles.safetyChip,
                {
                  borderColor: stateColors[safetyState] + '50',
                  backgroundColor: stateColors[safetyState] + '12',
                },
              ]}>
                <View style={[styles.safetyInnerDot, { backgroundColor: stateColors[safetyState] }]} />
                <PFCText variant="code" size="xs" color={stateColors[safetyState]}>
                  {safetyState.toUpperCase()}
                </PFCText>
              </View>
            </View>

            {/* Vitals row */}
            <View style={styles.vitalsRow}>
              <VitalChip
                label="Conf"
                value={Math.round(confidence * 100)}
                suffix="%"
                color={confidence > 0.66 ? colors.semantic.success : confidence > 0.33 ? colors.semantic.warning : colors.semantic.error}
                colors={colors}
              />
              <View style={[styles.vitalDivider, { backgroundColor: colors.border + '40' }]} />
              <PFCText variant="code" size="xs" color={colors.textTertiary}>
                {queriesProcessed} {queriesProcessed === 1 ? 'query' : 'queries'}
              </PFCText>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </>
  );
}

// --- Nav Button with active state ---
function NavButton({
  item,
  isActive,
  insightCount,
  colors,
  onPress,
}: {
  item: NavItem;
  isActive: boolean;
  insightCount: number;
  colors: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        {
          backgroundColor: isActive
            ? colors.brand.primary + '10'
            : pressed
            ? colors.textTertiary + '08'
            : 'transparent',
        },
      ]}
    >
      {/* Active indicator bar */}
      <View style={[
        styles.activeBar,
        {
          backgroundColor: isActive ? colors.brand.primary : 'transparent',
          opacity: isActive ? 1 : 0,
        },
      ]} />

      <PFCText
        variant="ui"
        size="md"
        color={isActive ? colors.brand.primary : colors.textTertiary}
        style={{ width: 22, textAlign: 'center' }}
      >
        {item.icon}
      </PFCText>

      <PFCText
        variant="ui"
        size="sm"
        color={isActive ? colors.textPrimary : colors.textSecondary}
        style={{ flex: 1 }}
      >
        {item.label}
      </PFCText>

      {/* Badge for Train Me insights */}
      {insightCount > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.brand.accent }]}>
          <PFCText variant="code" size="xs" color="#FFFFFF">
            {insightCount}
          </PFCText>
        </View>
      )}
    </Pressable>
  );
}

// --- Vital chip ---
function VitalChip({
  label,
  value,
  suffix,
  color,
  colors,
}: {
  label: string;
  value: number;
  suffix: string;
  color: string;
  colors: any;
}) {
  return (
    <View style={styles.vitalChip}>
      <PFCText variant="code" size="xs" color={colors.textTertiary}>
        {label}
      </PFCText>
      <PFCText variant="code" size="xs" color={color}>
        {value}{suffix}
      </PFCText>
    </View>
  );
}

// --- Sidebar Toggle Button ---
export function SidebarToggle({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      style={({ pressed }) => [
        styles.toggleBtn,
        {
          backgroundColor: pressed ? colors.textTertiary + '12' : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.hamburgerLines}>
        <View style={[styles.hamburgerLine, { backgroundColor: colors.textSecondary }]} />
        <View style={[styles.hamburgerLine, { backgroundColor: colors.textSecondary, width: 14 }]} />
        <View style={[styles.hamburgerLine, { backgroundColor: colors.textSecondary }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 11,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  sidebarMobile: {
    // Same positioning, mobile overlay handled by z-index
  },
  sidebarContent: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // New Analysis
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
  },

  // Navigation
  navSection: {
    paddingTop: 4,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    borderRadius: 6,
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  badge: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginVertical: 8,
  },

  // History
  historySection: {
    paddingHorizontal: 0,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  historyScroll: {
    flex: 1,
  },
  historyContent: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  emptyHistory: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  historyItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 2,
  },

  // Footer
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  safetyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  safetyInnerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  vitalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  vitalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vitalDivider: {
    width: 1,
    height: 12,
  },

  // Toggle button
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerLines: {
    gap: 4,
    alignItems: 'flex-start',
  },
  hamburgerLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
});
