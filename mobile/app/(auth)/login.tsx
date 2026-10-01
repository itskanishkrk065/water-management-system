import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius, typography, shadows, layout } from '../../src/constants/theme';
import { useAuth } from '../../src/auth/AuthContext';
import { useToast } from '../../src/components/Toast';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Feather } from '../../src/components/Icon';
import { UserRole } from '../../src/types/domain';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('field@watergrid.local');
  const [password, setPassword] = useState('watergrid123');
  const [selectedRole, setSelectedRole] = useState<UserRole>('FIELD_OFFICER');
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'ADMIN') {
      setEmail('admin@watergrid.local');
      setPassword('admin123');
    } else {
      setEmail('field@watergrid.local');
      setPassword('watergrid123');
    }
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      showToast({ message: 'Please enter your email or username', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const success = await login(email.trim(), selectedRole);
      if (success) {
        showToast({ message: `Logged in as ${selectedRole === 'ADMIN' ? 'Admin' : 'Field Officer'}`, type: 'success' });
        router.replace('/(app)');
      } else {
        showToast({ message: 'Authentication failed. Please try again.', type: 'error' });
      }
    } catch (err: any) {
      console.error('Login error:', err);
      showToast({ message: err.message || 'Login error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.wrapper}>
            {/* Header & Logo */}
            <View style={styles.header}>
              <View style={styles.logoBadge}>
                <Feather name="droplet" size={30} color="#FFFFFF" />
              </View>
              <Text style={styles.brandTitle}>WaterGrid</Text>
              <Text style={styles.brandSubtitle}>
                Field Operations & Water Management
              </Text>
              <View style={styles.offlinePill}>
                <View style={styles.offlineDot} />
                <Text style={styles.offlineText}>Offline Engine Active</Text>
              </View>
            </View>

            {/* Login Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign In</Text>
              <Text style={styles.cardSubtitle}>
                Select your operational profile or enter credentials
              </Text>

              {/* Role Quick Selector */}
              <Text style={styles.roleLabel}>Operational Profile</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  onPress={() => handleRoleSelect('FIELD_OFFICER')}
                  style={[
                    styles.roleOption,
                    selectedRole === 'FIELD_OFFICER' && styles.roleOptionActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Feather
                    name="user-check"
                    size={18}
                    color={
                      selectedRole === 'FIELD_OFFICER'
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.roleOptionText,
                      selectedRole === 'FIELD_OFFICER' && styles.roleOptionTextActive,
                    ]}
                  >
                    Field Officer
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleRoleSelect('ADMIN')}
                  style={[
                    styles.roleOption,
                    selectedRole === 'ADMIN' && styles.roleOptionActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Feather
                    name="shield"
                    size={18}
                    color={
                      selectedRole === 'ADMIN' ? colors.primary : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.roleOptionText,
                      selectedRole === 'ADMIN' && styles.roleOptionTextActive,
                    ]}
                  >
                    Admin
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inputs */}
              <Input
                label="Email / Username"
                placeholder="Enter email (e.g. field@watergrid.local)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                icon={<Feather name="mail" size={16} color={colors.textSecondary} />}
                showClearButton={true}
                onClear={() => setEmail('')}
              />

              <Input
                label="Password / PIN"
                placeholder="Enter password or PIN"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={true}
                icon={<Feather name="lock" size={16} color={colors.textSecondary} />}
              />

              <Button
                title="Continue to WaterGrid"
                onPress={handleLogin}
                loading={loading}
                fullWidth
                style={styles.loginButton}
              />

              <View style={styles.securityNotice}>
                <Feather name="shield" size={12} color={colors.textMuted} />
                <Text style={styles.securityText}>
                  AES-encrypted SQLite engine • Local audit trail
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  wrapper: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.floating,
  },
  brandTitle: {
    fontSize: typography.fontSize.title,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: typography.fontSize.bodySecondary,
    color: colors.textSecondary,
    marginTop: 4,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  offlineText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '600',
    color: colors.success,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...shadows.card,
  },
  cardTitle: {
    fontSize: typography.fontSize.heading,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  cardSubtitle: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.lg,
    fontFamily: typography.fontFamily.regular,
  },
  roleLabel: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontFamily: typography.fontFamily.medium,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    gap: spacing.xs,
  },
  roleOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleOptionText: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  roleOptionTextActive: {
    color: colors.primary,
  },
  loginButton: {
    marginTop: spacing.sm,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: 6,
  },
  securityText: {
    fontSize: typography.fontSize.micro,
    color: colors.textMuted,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'center',
  },
});
