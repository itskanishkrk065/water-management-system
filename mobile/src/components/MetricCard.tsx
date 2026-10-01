import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  style?: ViewStyle;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtext,
  icon,
  accentColor = Colors.primary[600],
  style,
}) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      {subtext && <Text style={styles.subtext}>{subtext}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconContainer: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: Colors.neutral[50],
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  // Polished natural SaaS numeric font styling
  value: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral[500],
    marginLeft: 6,
  },
  subtext: {
    fontSize: 12,
    color: Colors.neutral[400],
    marginTop: 6,
  },
});
