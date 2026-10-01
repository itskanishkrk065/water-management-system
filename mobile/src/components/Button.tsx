import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Colors } from '../constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
}) => {
  const isLarge = size === 'large';
  const isSmall = size === 'small';

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          btn: { backgroundColor: Colors.secondary[600] },
          text: { color: '#FFFFFF' },
        };
      case 'outline':
        return {
          btn: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: Colors.neutral[300],
          },
          text: { color: Colors.neutral[800] },
        };
      case 'danger':
        return {
          btn: { backgroundColor: Colors.status.dangerText },
          text: { color: '#FFFFFF' },
        };
      case 'ghost':
        return {
          btn: { backgroundColor: 'transparent' },
          text: { color: Colors.primary[600] },
        };
      case 'primary':
      default:
        return {
          btn: { backgroundColor: Colors.primary[600] },
          text: { color: '#FFFFFF' },
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        vStyles.btn,
        {
          paddingVertical: isSmall ? 8 : isLarge ? 16 : 12,
          paddingHorizontal: isSmall ? 12 : isLarge ? 24 : 18,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={vStyles.text.color} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text
            style={[
              styles.text,
              vStyles.text,
              {
                fontSize: isSmall ? 13 : isLarge ? 16 : 14,
                fontWeight: '600',
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    letterSpacing: 0.1,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
