import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../modules/shared/theme';
import { Sidebar, SidebarToggle } from '../../modules/shared/components/Sidebar';
import { usePFCStore } from '../../modules/store/usePFCStore';

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

  return (
    <View style={[styles.container, {
      paddingTop: insets.top,
      backgroundColor: colors.background,
    }]}>
      <View style={styles.mainLayout}>
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen || isWideScreen}
          onToggle={toggleSidebar}
          activeRoute={activeRoute}
          onNavigate={handleNavigate}
        />

        {/* Content area */}
        <View style={styles.content}>
          {/* Top bar with toggle */}
          <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
            {!isWideScreen && (
              <SidebarToggle isOpen={sidebarOpen} onToggle={toggleSidebar} />
            )}
            <View style={{ flex: 1 }} />
          </View>

          {/* Active screen */}
          <Slot />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
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
