import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cs } from '@mtsales/shared';
import { colors, font, spacing } from '@/ui/theme';

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  // Typ `ref` z TabTrigger nesedí s Pressable v RN 0.88; za běhu je kompatibilní.
  const pressableProps = props as unknown as PressableProps;
  return (
    <Pressable {...pressableProps} style={styles.tab}>
      <Text style={[styles.tabText, isFocused && styles.tabTextActive]}>{children}</Text>
      <View style={[styles.indicator, isFocused && styles.indicatorActive]} />
    </Pressable>
  );
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={[styles.tabList, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton>{cs.nav.myDay}</TabButton>
        </TabTrigger>
        <TabTrigger name="team" href="/team" asChild>
          <TabButton>{cs.nav.team}</TabButton>
        </TabTrigger>
        <TabTrigger name="account" href="/account" asChild>
          <TabButton>{cs.nav.account}</TabButton>
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabList: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  tabText: { fontSize: font.sm, color: colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  indicator: { height: 3, width: 28, borderRadius: 2, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: colors.primary },
});
