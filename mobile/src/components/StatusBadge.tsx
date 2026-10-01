import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { Feather } from './Icon';

export type StatusType =
  | 'APPROVED'
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'REJECTED'
  | 'CANCELLED'
  | 'VOIDED'
  | 'DRAFT'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ARCHIVED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'UNPAID'
  | 'OVERDUE'
  | 'SYNCED'
  | 'PENDING_SYNC'
  | 'SYNC_FAILED'
  | 'CONFLICT'
  | 'LOCAL_ONLY'
  | 'PLANNED'
  | 'UNDER_CONSTRUCTION'
  | 'COMPLETED'
  | 'COMMISSIONED';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  style,
  showIcon = true,
}) => {
  const normalized = (status || '').toUpperCase() as StatusType;

  const getBadgeConfig = () => {
    switch (normalized) {
      case 'APPROVED':
      case 'ACTIVE':
      case 'PAID':
      case 'SYNCED':
      case 'COMMISSIONED':
      case 'COMPLETED':
        return {
          bg: colors.successLight,
          border: colors.successBorder,
          text: colors.success,
          icon: 'check-circle' as const,
        };
      case 'PENDING':
      case 'UNDER_REVIEW':
      case 'PARTIALLY_PAID':
      case 'PENDING_SYNC':
      case 'UNDER_CONSTRUCTION':
        return {
          bg: colors.warningLight,
          border: colors.warningBorder,
          text: colors.warning,
          icon: 'clock' as const,
        };
      case 'REJECTED':
      case 'CANCELLED':
      case 'VOIDED':
      case 'OVERDUE':
      case 'SYNC_FAILED':
      case 'CONFLICT':
        return {
          bg: colors.dangerLight,
          border: colors.dangerBorder,
          text: colors.danger,
          icon: 'alert-circle' as const,
        };
      case 'DRAFT':
      case 'INACTIVE':
      case 'ARCHIVED':
      case 'UNPAID':
      case 'LOCAL_ONLY':
      case 'PLANNED':
      default:
        return {
          bg: colors.surfaceSubtle,
          border: colors.border,
          text: colors.textSecondary,
          icon: 'minus-circle' as const,
        };
    }
  };

  const config = getBadgeConfig();
  const displayLabel = label || normalized.replace(/_/g, ' ');
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg, borderColor: config.border },
        isSmall && styles.badgeSm,
        style,
      ]}
    >
      {showIcon && (
        <Feather
          name={config.icon}
          size={isSmall ? 10 : 12}
          color={config.text}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.text,
          { color: config.text },
          isSmall && styles.textSm,
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  icon: {
    marginRight: spacing.xs,
  },
  text: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
    fontFamily: typography.fontFamily.medium,
    letterSpacing: 0.2,
  },
  textSm: {
    fontSize: typography.fontSize.micro,
  },
});
