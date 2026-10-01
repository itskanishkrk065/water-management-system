import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface StatusBadgeProps {
  status?: string;
  size?: 'small' | 'medium';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status = 'LOCAL_ONLY', size = 'medium' }) => {
  const getStyle = () => {
    switch ((status || 'LOCAL_ONLY').toUpperCase()) {
      case 'SYNCED':
      case 'APPROVED':
      case 'PAID':
      case 'ACTIVE':
      case 'HEALTHY':
        return {
          bg: Colors.status.successBg,
          text: Colors.status.successText,
          border: Colors.status.successBorder,
          label: status === 'SYNCED' ? '✓ Synced' : status === 'APPROVED' ? '✓ Approved' : status,
        };
      case 'PENDING_SYNC':
        return {
          bg: Colors.status.warningBg,
          text: Colors.status.warningText,
          border: Colors.status.warningBorder,
          label: '↑ Pending Sync',
        };
      case 'LOCAL_ONLY':
        return {
          bg: Colors.neutral[100],
          text: Colors.neutral[700],
          border: Colors.neutral[300],
          label: '● Saved to Device',
        };
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
      case 'PENDING':
      case 'PARTIALLY_PAID':
        return {
          bg: Colors.status.infoBg,
          text: Colors.status.infoText,
          border: Colors.status.infoBorder,
          label: status.replace('_', ' '),
        };
      case 'REJECTED':
      case 'CANCELLED':
      case 'VOIDED':
      case 'FAILED':
      case 'DEGRADED':
        return {
          bg: Colors.status.dangerBg,
          text: Colors.status.dangerText,
          border: Colors.status.dangerBorder,
          label: status,
        };
      default:
        return {
          bg: Colors.neutral[100],
          text: Colors.neutral[700],
          border: Colors.neutral[200],
          label: status,
        };
    }
  };

  const styleConfig = getStyle();
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: styleConfig.bg,
          borderColor: styleConfig.border,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 6 : 10,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: styleConfig.text,
            fontSize: isSmall ? 10 : 12,
          },
        ]}
      >
        {styleConfig.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
