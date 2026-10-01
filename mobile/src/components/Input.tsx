import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { colors, spacing, borderRadius, typography, layout } from '../constants/theme';
import { Feather } from './Icon';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  onClear?: () => void;
  showClearButton?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  containerStyle,
  inputStyle,
  icon,
  trailingIcon,
  value,
  onClear,
  showClearButton = false,
  onFocus,
  onBlur,
  secureTextEntry,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  const isSecure = secureTextEntry && !isPasswordVisible;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, isFocused && styles.labelFocused, !!error && styles.labelError]}>
          {label}
        </Text>
      )}
      <Pressable
        onPress={handleContainerPress}
        style={[
          styles.inputContainer,
          isFocused && styles.focusedInput,
          !!error && styles.errorInput,
          props.editable === false && styles.disabledInput,
        ]}
      >
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <TextInput
          ref={inputRef}
          style={[styles.input, inputStyle]}
          placeholderTextColor={colors.textMuted}
          value={value}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isSecure}
          accessible={true}
          accessibilityLabel={label || props.placeholder}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.actionButton}
          >
            <Feather
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        {showClearButton && !!value && onClear && (
          <TouchableOpacity
            onPress={onClear}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.actionButton}
          >
            <Feather name="x-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        {trailingIcon && <View style={styles.trailingContainer}>{trailingIcon}</View>}
      </Pressable>
      {error ? (
        <View style={styles.feedbackContainer}>
          <Feather name="alert-circle" size={12} color={colors.danger} style={styles.feedbackIcon} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    width: '100%',
  },
  label: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
    fontFamily: typography.fontFamily.medium,
  },
  labelFocused: {
    color: colors.primary,
  },
  labelError: {
    color: colors.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.2,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    minHeight: layout.minTouchTarget,
    width: '100%',
  },
  focusedInput: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  errorInput: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  disabledInput: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },
  iconContainer: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trailingContainer: {
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    height: '100%',
    minHeight: layout.minTouchTarget - 4,
    fontFamily: typography.fontFamily.regular,
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  feedbackIcon: {
    marginRight: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.tiny,
    color: colors.danger,
    fontWeight: '500',
    fontFamily: typography.fontFamily.medium,
  },
  hintText: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontFamily: typography.fontFamily.regular,
  },
});
