import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../constants/theme';
import { Feather } from './Icon';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextType {
  showToast: (options: ToastOptions | string) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [opacityAnim, slideAnim]);

  const showToast = useCallback(
    (options: ToastOptions | string) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      const opts: ToastOptions =
        typeof options === 'string' ? { message: options, type: 'info' } : options;
      const type = opts.type || 'info';
      const duration = opts.duration || 3200;

      setToast({ ...opts, type });

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 250,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [hideToast, opacityAnim, slideAnim]
  );

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <Feather name="check-circle" size={18} color={colors.success} />;
      case 'warning':
        return <Feather name="alert-triangle" size={18} color={colors.warning} />;
      case 'error':
        return <Feather name="alert-circle" size={18} color={colors.danger} />;
      case 'info':
      default:
        return <Feather name="info" size={18} color={colors.primary} />;
    }
  };

  const getToastBorderColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return colors.successBorder;
      case 'warning':
        return colors.warningBorder;
      case 'error':
        return colors.dangerBorder;
      case 'info':
      default:
        return colors.primaryBorder;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (
        <SafeAreaView pointerEvents="box-none" style={styles.toastWrapper}>
          <Animated.View
            style={[
              styles.toastContainer,
              { borderColor: getToastBorderColor(toast.type || 'info') },
              { opacity: opacityAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.iconContainer}>{getToastIcon(toast.type || 'info')}</View>
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.actionLabel && toast.onAction && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  toast.onAction?.();
                  hideToast();
                }}
              >
                <Text style={styles.actionText}>{toast.actionLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={hideToast}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.dismissButton}
            >
              <Feather name="x" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 24,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastContainer: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...shadows.sheet,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: typography.fontSize.bodySecondary,
    color: colors.textPrimary,
    fontWeight: '500',
    fontFamily: typography.fontFamily.medium,
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  actionText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  dismissButton: {
    marginLeft: spacing.sm,
    padding: spacing.xxs,
  },
});
