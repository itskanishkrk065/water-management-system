import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../constants/theme';

export interface TabItem {
  id?: string;
  key?: string;
  label: string;
  badge?: number | string;
  icon?: string;
}

export interface TabsProps {
  tabs?: TabItem[];
  items?: TabItem[];
  activeTab: string;
  onChangeTab?: (id: string) => void;
  onTabChange?: (id: string) => void;
  style?: ViewStyle;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  items,
  activeTab,
  onChangeTab,
  onTabChange,
  style,
}) => {
  const actualTabs = tabs || items || [];
  const handleSelect = (selectedId: string) => {
    onChangeTab?.(selectedId);
    onTabChange?.(selectedId);
  };
  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {actualTabs.map((tab) => {
          const tabKey = tab.id || tab.key || '';
          const isActive = tabKey === activeTab;
          return (
            <TouchableOpacity
              key={tabKey}
              onPress={() => handleSelect(tabKey)}
              activeOpacity={0.7}
              style={[styles.tabButton, isActive && styles.activeTabButton]}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {tab.label}
              </Text>
              {tab.badge !== undefined && tab.badge !== null && (
                <View
                  style={[
                    styles.badge,
                    isActive ? styles.activeBadge : styles.inactiveBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      isActive ? styles.activeBadgeText : styles.inactiveBadgeText,
                    ]}
                  >
                    {tab.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSubtle,
  },
  activeTabButton: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  badge: {
    marginLeft: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  activeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  inactiveBadge: {
    backgroundColor: colors.surfaceMuted,
  },
  badgeText: {
    fontSize: typography.fontSize.micro,
    fontWeight: '700',
  },
  activeBadgeText: {
    color: '#FFFFFF',
  },
  inactiveBadgeText: {
    color: colors.textSecondary,
  },
});
