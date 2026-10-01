import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionTitle,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          size="medium"
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    marginVertical: 16,
  },
  iconContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 50,
    backgroundColor: Colors.primary[50],
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.neutral[800],
    marginBottom: 6,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: Colors.neutral[500],
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});
