import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';

export interface MetricItem {
  id: string;
  label: string;
  value: string | number;
  subvalue?: string;
  trend?: string;
  trendPositive?: boolean;
  color?: string;
  onPress?: () => void;
}

interface MetricGroupProps {
  title?: string;
  metrics?: MetricItem[];
  items?: MetricItem[];
  columns?: 2 | 3 | 4;
  style?: ViewStyle;
}

export const MetricGroup: React.FC<MetricGroupProps> = ({
  title,
  metrics,
  items,
  columns = 2,
  style,
}) => {
  const metricList = metrics || items || [];
  return (
    <View style={[styles.container, style]}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      <View style={styles.grid}>
        {metricList.map((item, index) => {
          const isLastInRow = (index + 1) % columns === 0;
          const isLastRow = index >= metricList.length - (metricList.length % columns || columns);

          const content = (
            <View
              key={item.id}
              style={[
                styles.metricTile,
                { width: `${100 / columns}%` },
                !isLastInRow && styles.tileBorderRight,
                !isLastRow && styles.tileBorderBottom,
              ]}
            >
              <Text style={styles.label} numberOfLines={1}>
                {item.label}
              </Text>
              <Text
                style={[
                  styles.value,
                  item.color ? { color: item.color } : undefined,
                ]}
                numberOfLines={1}
              >
                {typeof item.value === 'number'
                  ? item.value.toLocaleString()
                  : item.value}
              </Text>
              {item.subvalue ? (
                <Text style={styles.subvalue} numberOfLines={1}>
                  {item.subvalue}
                </Text>
              ) : null}
            </View>
          );

          if (item.onPress) {
            return (
              <TouchableOpacity
                key={item.id}
                onPress={item.onPress}
                activeOpacity={0.7}
                style={{ width: `${100 / columns}%` }}
              >
                {content}
              </TouchableOpacity>
            );
          }

          return content;
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  groupTitle: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: typography.fontFamily.bold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricTile: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  tileBorderRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  tileBorderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 4,
    fontFamily: typography.fontFamily.medium,
  },
  value: {
    fontSize: typography.fontSize.kpi,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: -0.5,
  },
  subvalue: {
    fontSize: typography.fontSize.micro,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
});
