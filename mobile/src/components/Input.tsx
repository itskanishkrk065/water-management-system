import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Colors } from '../constants/colors';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  helper?: string;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helper,
  containerStyle,
  leftIcon,
  rightIcon,
  required,
  style,
  ...rest
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label} {required && <Text style={styles.requiredStar}>*</Text>}
        </Text>
      </View>

      <View
        style={[
          styles.inputWrapper,
          error ? styles.inputError : null,
          rest.editable === false ? styles.inputDisabled : null,
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}
        <TextInput
          placeholderTextColor={Colors.neutral[400]}
          style={[
            styles.input,
            leftIcon ? { paddingLeft: 0 } : null,
            rightIcon ? { paddingRight: 0 } : null,
            style,
          ]}
          {...rest}
        />
        {rightIcon && <View style={styles.rightIconContainer}>{rightIcon}</View>}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  requiredStar: {
    color: Colors.status.dangerText,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  inputError: {
    borderColor: Colors.status.dangerBorder,
    backgroundColor: '#FFF5F5',
  },
  inputDisabled: {
    backgroundColor: Colors.neutral[100],
    borderColor: Colors.neutral[200],
  },
  leftIconContainer: {
    marginRight: 10,
  },
  rightIconContainer: {
    marginLeft: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.neutral[900],
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 12,
    color: Colors.status.dangerText,
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 4,
  },
});
