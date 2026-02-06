import React from 'react';
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
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { elevation3 } from '../theme/elevation';
import { PFCText } from './PFCText';
import { usePFCStore } from '../../store/usePFCStore';

const SIDEBAR_WIDTH = 280;

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
  { key: 'trainme', label: 'Train Me', icon: '\u{1F9EA}', route: 'trainme' },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export function Sidebar({ isOpen, onToggle, activeRoute, onNavigate }: SidebarProps) {
  const { colors, fonts, stateColors } = useTheme();
  const insets = useSafeAreaInsets();

  const messages = usePFCStore((s) => s.messages);
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const healthScore = usePFCStore((s) => s.healthScore);
  const safetyState = usePFCStore((s) => s.safetyState);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);
  const trainMeReport = usePFCStore((s) => s.trainMeReport);

  // Get user queries for conversation history
  const userQueries = messages
    .filter((m) => m.role === 'user')
    .slice(-20) // last 20
    .reverse();

  const insightCount = trainMeReport?.insights.length ?? 0;

  // Animated sidebar slide
  const sidebarStyle = useAnimatedStyle(() => ({
    width: withTiming(isOpen ? SIDEBAR_WIDTH : 0, {
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    }),
    opacity: withTiming(isOpen ? 1 : 0, { duration: 200 }),
  }));

  // Overlay for mobile
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isOpen ? 1 : 0, { duration: 200 }),
    pointerEvents: isOpen ? 'auto' as const : 'none' as const,
  }));

  const screenWidth = Dimensions.get('window').width;
  const isMobile = screenWidth < 768;

  return (
    <>
      {/* Overlay (mobile only) */}
      {isMobile && (
        <Animated.View
          style={[
            styles.overlay,
            overlayStyle,
            { backgroundColor: 'rgba(0,0,0,0.4)' },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onToggle} />
        </Animated.View>
      )}

      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          sidebarStyle,
          elevation3,
          {
            backgroundColor: colors.backgroundSecondary,
            borderRightColor: colors.border,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
          isMobile && styles.sidebarMobile,
        ]}
      >
        {isOpen && (
          <View style={styles.sidebarInner}>
            {/* Header */}
            <View style={styles.sidebarHeader}>
              <View style={styles.logoRow}>
                <PFCText variant="pixel" size="lg" color={colors.brand.primary} glow>
                  PFC
                </PFCText>
                <PFCText variant="ui" size="xs" color={colors.textTertiary}>
                  v3.0
                </PFCText>
              </View>
              <Pressable onPress={onToggle} hitSlop={8}>
                <PFCText variant="ui" size="lg" color={colors.textTertiary}>
                  {'\u2715'}
                </PFCText>
              </Pressable>
            </View>

            {/* New Chat button */}
            <Pressable
              style={[styles.newChatBtn, { borderColor: colors.border }]}
              onPress={() => onNavigate('index')}
            >
              <PFCText variant="ui" size="sm" color={colors.textSecondary}>
                + New Analysis
              </PFCText>
            </Pressable>

            {/* Navigation */}
            <View style={styles.navSection}>
              {NAV_ITEMS.map((item) => {
                const isActive = activeRoute === item.route ||
                  (activeRoute === 'index' && item.key === 'chat');
                return (
                  <Pressable
                    key={item.key}
                    style={[
                      styles.navItem,
                      isActive && {
                        backgroundColor: colors.brand.primary + '12',
                        borderLeftColor: colors.brand.primary,
                        borderLeftWidth: 3,
                      },
                    ]}
                    onPress={() => {
                      onNavigate(item.route);
                      if (isMobile) onToggle();
                    }}
                  >
                    <PFCText
                      variant="ui"
                      size="md"
                      color={isActive ? colors.brand.primary : colors.textSecondary}
                    >
                      {item.icon}
                    </PFCText>
                    <PFCText
                      variant="pixel"
                      size="xs"
                      color={isActive ? colors.brand.primary : colors.textSecondary}
                      style={{ flex: 1 }}
                    >
                      {item.label}
                    </PFCText>
                    {/* Badge for Train Me */}
                    {item.key === 'trainme' && insightCount > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.brand.accent }]}>
                        <PFCText variant="code" size="xs" color="#FFFFFF">
                          {insightCount}
                        </PFCText>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Conversation History */}
            <View style={styles.historyHeader}>
              <PFCText variant="ui" size="xs" color={colors.textTertiary}>
                Recent Queries
              </PFCText>
            </View>

            <ScrollView
              style={styles.historyScroll}
              showsVerticalScrollIndicator={false}
            >
              {userQueries.length === 0 ? (
                <PFCText variant="body" size="xs" color={colors.textTertiary} style={{ padding: 12 }}>
                  No queries yet
                </PFCText>
              ) : (
                userQueries.map((msg) => (
                  <View
                    key={msg.id}
                    style={[styles.historyItem, { borderBottomColor: colors.border + '40' }]}
                  >
                    <PFCText
                      variant="body"
                      size="xs"
                      color={colors.textSecondary}
                      style={{ lineHeight: 16 }}
                    >
                      {msg.text.length > 60 ? msg.text.slice(0, 57) + '...' : msg.text}
                    </PFCText>
                    <PFCText variant="code" size="xs" color={colors.textTertiary}>
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </PFCText>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Footer vitals */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <View style={styles.vitalsRow}>
                <VitalMini
                  label="C"
                  value={Math.round(confidence * 100)}
                  color={confidence > 0.66 ? colors.semantic.success : confidence > 0.33 ? colors.semantic.warning : colors.semantic.error}
                  colors={colors}
                />
                <VitalMini
                  label="E"
                  value={Math.round(entropy * 100)}
                  color={entropy < 0.34 ? colors.semantic.success : entropy < 0.67 ? colors.semantic.warning : colors.semantic.error}
                  colors={colors}
                />
                <VitalMini
                  label="H"
                  value={Math.round(healthScore * 100)}
                  color={healthScore > 0.66 ? colors.semantic.success : healthScore > 0.33 ? colors.semantic.warning : colors.semantic.error}
                  colors={colors}
                />
                <View style={[styles.safetyPill, {
                  borderColor: stateColors[safetyState],
                  backgroundColor: stateColors[safetyState] + '12',
                }]}>
                  <PFCText variant="code" size="xs" color={stateColors[safetyState]}>
                    {safetyState[0].toUpperCase()}
                  </PFCText>
                </View>
              </View>
              <PFCText variant="code" size="xs" color={colors.textTertiary}>
                {queriesProcessed} queries processed
              </PFCText>
            </View>
          </View>
        )}
      </Animated.View>
    </>
  );
}

function VitalMini({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: number;
  color: string;
  colors: any;
}) {
  return (
    <View style={styles.vitalMini}>
      <PFCText variant="code" size="xs" color={colors.textTertiary}>
        {label}
      </PFCText>
      <PFCText variant="code" size="xs" color={color}>
        {value}
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
      style={[styles.toggleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <PFCText variant="ui" size="md" color={colors.textSecondary}>
        {isOpen ? '\u2630' : '\u2630'}
      </PFCText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  sidebar: {
    zIndex: 11,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  sidebarMobile: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  sidebarInner: {
    flex: 1,
    width: SIDEBAR_WIDTH,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  newChatBtn: {
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  navSection: {
    gap: 2,
    paddingHorizontal: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 2,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  badge: {
    minWidth: 20,
    height: 18,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  historyHeader: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  historyScroll: {
    flex: 1,
  },
  historyItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    gap: 2,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  vitalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vitalMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  safetyPill: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
