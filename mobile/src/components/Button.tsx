import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Animated,
  View,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows, layout } from '../constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'subtle' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  iconPosition = 'left',
  fullWidth = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const getVariantStyles = (): { button: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'secondary':
        return {
          button: {
            backgroundColor: colors.surfaceSubtle,
            borderWidth: 1,
            borderColor: colors.border,
          },
          text: { color: colors.textPrimary },
        };
      case 'outline':
        return {
          button: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: colors.primary,
          },
          text: { color: colors.primary },
        };
      case 'subtle':
        return {
          button: {
            backgroundColor: colors.primaryLight,
            borderWidth: 1,
            borderColor: colors.primaryBorder,
          },
          text: { color: colors.primary },
        };
      case 'destructive':
        return {
          button: {
            backgroundColor: colors.danger,
          },
          text: { color: '#FFFFFF' },
        };
      case 'primary':
      default:
        return {
          button: {
            backgroundColor: colors.primary,
            ...shadows.subtle,
          },
          text: { color: '#FFFFFF' },
        };
    }
  };

  const getSizeStyles = (): { button: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          button: {
            paddingVertical: spacing.xs + 2,
            paddingHorizontal: spacing.md,
            minHeight: 38,
            borderRadius: borderRadius.md,
          },
          text: { fontSize: typography.fontSize.caption },
        };
      case 'lg':
        return {
          button: {
            paddingVertical: spacing.md + 2,
            paddingHorizontal: spacing.xxl,
            minHeight: 52,
            borderRadius: borderRadius.lg,
          },
          text: { fontSize: typography.fontSize.heading },
        };
      case 'md':
      default:
        return {
          button: {
            paddingVertical: spacing.sm + 4,
            paddingHorizontal: spacing.lg,
            minHeight: layout.minTouchTarget,
            borderRadius: borderRadius.lg,
          },
          text: { fontSize: typography.fontSize.body },
        };
    }
  };

  const variantStyle = getVariantStyles();
  const sizeStyle = getSizeStyles();

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, fullWidth && { width: '100%' }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.88}
        style={[
          styles.baseButton,
          variantStyle.button,
          sizeStyle.button,
          fullWidth && styles.fullWidth,
          disabled && styles.disabledButton,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'outline' || variant === 'subtle' ? colors.primary : '#FFFFFF'
            }
          />
        ) : (
          <View style={styles.contentRow}>
            {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
            <Text
              style={[
                styles.baseText,
                variantStyle.text,
                sizeStyle.text,
                disabled && styles.disabledText,
                textStyle,
              ]}
            >
              {title}
            </Text>
            {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  baseText: {
    fontWeight: '600',
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  disabledText: {
    color: colors.textMuted,
  },
});
