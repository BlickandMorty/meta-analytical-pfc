import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Slot, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../modules/shared/theme';
import { Sidebar, SidebarToggle } from '../../modules/shared/components/Sidebar';
import { usePFCStore } from '../../modules/store/usePFCStore';

const SIDEBAR_WIDTH = 288;

const SPRING_CONTENT = {
  damping: 28,
  stiffness: 320,
  mass: 0.8,
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const sidebarOpen = usePFCStore((s) => s.sidebarOpen);
  const toggleSidebar = usePFCStore((s) => s.toggleSidebar);

  // Derive active route from pathname
  const activeRoute = pathname === '/' ? 'index' : pathname.replace('/', '');

  const handleNavigate = useCallback((route: string) => {
    const path = route === 'index' ? '/' : `/${route}`;
    router.push(path as any);
  }, [router]);

  const screenWidth = Dimensions.get('window').width;
  const isWideScreen = screenWidth >= 768;

  // Animate content margin on desktop when sidebar opens
  const contentMargin = useSharedValue(0);

  useEffect(() => {
    if (isWideScreen && sidebarOpen) {
      contentMargin.value = withSpring(SIDEBAR_WIDTH, SPRING_CONTENT);
    } else {
      contentMargin.value = withSpring(0, SPRING_CONTENT);
    }
  }, [sidebarOpen, isWideScreen]);

  const contentAnimStyle = useAnimatedStyle(() => ({
    marginLeft: contentMargin.value,
  }));

  return (
    <View style={[styles.container, {
      paddingTop: insets.top,
      backgroundColor: colors.background,
    }]}>
      {/* Sidebar (absolutely positioned) */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        activeRoute={activeRoute}
        onNavigate={handleNavigate}
      />

      {/* Content area - shifts right on desktop when sidebar is open */}
      <Animated.View style={[styles.content, contentAnimStyle]}>
        {/* Top bar with toggle */}
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <SidebarToggle isOpen={sidebarOpen} onToggle={toggleSidebar} />
          <View style={{ flex: 1 }} />
        </View>

        {/* Active screen */}
        <Slot />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    minHeight: 48,
  },
});
