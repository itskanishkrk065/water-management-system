import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../../src/components/Header';
import { MetricGroup, MetricItem } from '../../src/components/MetricGroup';
import { Button } from '../../src/components/Button';
import { StatusBadge } from '../../src/components/StatusBadge';
import { ListItem } from '../../src/components/ListItem';
import { SectionHeader } from '../../src/components/SectionHeader';
import { colors, spacing, borderRadius, typography, shadows } from '../../src/constants/theme';
import { BeneficiaryRepository } from '../../src/repositories/BeneficiaryRepository';
import { SyncRepository } from '../../src/repositories/SyncRepository';
import { AuditRepository } from '../../src/repositories/AuditRepository';
import { useAuth } from '../../src/auth/AuthContext';
import { Feather } from '../../src/components/Icon';

const beneficiaryRepo = new BeneficiaryRepository();
const syncRepo = new SyncRepository();
const auditRepo = new AuditRepository();

export default function HomeScreen() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    beneficiariesCount: 0,
    landHoldingsCount: 0,
    waterAppsCount: 0,
    pendingSyncCount: 0,
    totalAllocatedLitres: 0,
  });
  const [recentRecords, setRecentRecords] = useState<any[]>([]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const loadDashboardData = async () => {
    try {
      const beneficiaries = await beneficiaryRepo.getAll();
      const syncSummary = await syncRepo.getSummary();
      const recentAudits = await auditRepo.getRecent(5);

      let holdingsTotal = 0;
      let appsTotal = 0;

      beneficiaries.forEach((b) => {
        holdingsTotal += b.holdings_count || 0;
        appsTotal += b.applications_count || 0;
      });

      setStats({
        beneficiariesCount: beneficiaries.length,
        landHoldingsCount: holdingsTotal,
        waterAppsCount: appsTotal,
        pendingSyncCount: syncSummary.pending,
        totalAllocatedLitres: appsTotal * 5000,
      });

      setRecentRecords(recentAudits);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const metrics: MetricItem[] = [
    {
      id: 'm1',
      label: 'Beneficiaries',
      value: stats.beneficiariesCount,
      subvalue: 'Local database',
      color: colors.primary,
      onPress: () => router.push('/(app)/beneficiaries'),
    },
    {
      id: 'm2',
      label: 'Land Holdings',
      value: stats.landHoldingsCount,
      subvalue: 'Parcels verified',
      color: colors.secondary,
    },
    {
      id: 'm3',
      label: 'Water Apps',
      value: stats.waterAppsCount,
      subvalue: 'Active quotas',
      color: colors.accent.indigo,
      onPress: () => router.push('/(app)/water'),
    },
    {
      id: 'm4',
      label: 'Pending Sync',
      value: stats.pendingSyncCount,
      subvalue: stats.pendingSyncCount > 0 ? 'Needs sync' : 'All synced',
      color: stats.pendingSyncCount > 0 ? colors.warning : colors.success,
      onPress: () => router.push('/(app)/sync'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="Command Center"
        subtitle={isAdmin ? 'Administrative Operations' : 'Field Operations'}
        showRoleBadge
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* User Context & Offline State Bar */}
        <View style={styles.greetingCard}>
          <View style={styles.greetingHeader}>
            <View>
              <Text style={styles.greetingText}>{getGreeting()},</Text>
              <Text style={styles.userNameText}>{user?.name || 'Field Officer'}</Text>
            </View>
            <View style={styles.offlineStatusTag}>
              <View style={styles.greenPulseDot} />
              <Text style={styles.offlineStatusLabel}>Offline Ready</Text>
            </View>
          </View>
          <Text style={styles.greetingSubtext}>
            All actions are saved locally to SQLite and queued for automatic sync.
          </Text>
        </View>

        {/* Primary Action Shortcuts */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={[styles.primaryActionPill, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(app)/new-registration')}
            activeOpacity={0.88}
          >
            <Feather name="user-plus" size={18} color="#FFFFFF" />
            <Text style={styles.primaryActionPillText}>+ New Registration</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryActionPill}
            onPress={() => router.push('/(app)/beneficiaries')}
            activeOpacity={0.8}
          >
            <Feather name="search" size={16} color={colors.textPrimary} />
            <Text style={styles.secondaryActionPillText}>Search Directory</Text>
          </TouchableOpacity>
        </View>

        {/* Operational Metrics Group */}
        <SectionHeader
          title="Operational Overview"
          subtitle="Device snapshot and queues"
          actionText={isAdmin ? 'View Reports' : undefined}
          onAction={isAdmin ? () => router.push('/(app)/reports') : undefined}
        />
        <MetricGroup metrics={metrics} columns={2} />

        {/* Quick Navigation Cards */}
        <View style={styles.navTilesRow}>
          <TouchableOpacity
            style={styles.navTile}
            onPress={() => router.push('/(app)/drafts')}
            activeOpacity={0.7}
          >
            <View style={[styles.navTileIcon, { backgroundColor: colors.primaryLight }]}>
              <Feather name="file-text" size={18} color={colors.primary} />
            </View>
            <Text style={styles.navTileTitle}>Registration Drafts</Text>
            <Text style={styles.navTileSub}>Continue onboarding</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navTile}
            onPress={() => router.push('/(app)/billing')}
            activeOpacity={0.7}
          >
            <View style={[styles.navTileIcon, { backgroundColor: colors.secondaryLight }]}>
              <Feather name="credit-card" size={18} color={colors.secondary} />
            </View>
            <Text style={styles.navTileTitle}>5-Stage Billing</Text>
            <Text style={styles.navTileSub}>Installments & Payments</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Local Activity Stream */}
        <SectionHeader
          title="Recent Activity"
          subtitle="Latest local mutations on this device"
          actionText="All Beneficiaries"
          onAction={() => router.push('/(app)/beneficiaries')}
        />

        <View style={styles.activityCard}>
          {recentRecords.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Feather name="check-circle" size={24} color={colors.textMuted} />
              <Text style={styles.emptyActivityText}>No local modifications recorded yet.</Text>
            </View>
          ) : (
            recentRecords.map((item, index) => (
              <ListItem
                key={item.audit_id || index}
                title={`${item.entity_type.replace(/_/g, ' ')}: ${item.entity_id}`}
                subtitle={`Action: ${item.action} • ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                rightElement={
                  <StatusBadge
                    status={item.sync_status || 'LOCAL_ONLY'}
                    size="sm"
                  />
                }
                borderBottom={index < recentRecords.length - 1}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  greetingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  greetingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  greetingText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    fontWeight: '500',
    fontFamily: typography.fontFamily.medium,
  },
  userNameText: {
    fontSize: typography.fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
    letterSpacing: -0.3,
  },
  offlineStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginRight: 4,
  },
  offlineStatusLabel: {
    fontSize: typography.fontSize.micro,
    fontWeight: '700',
    color: colors.success,
  },
  greetingSubtext: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  primaryActionPill: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
    ...shadows.subtle,
  },
  primaryActionPillText: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: typography.fontFamily.medium,
  },
  secondaryActionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  secondaryActionPillText: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.medium,
  },
  navTilesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  navTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  navTileIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  navTileTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  navTileSub: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  emptyActivity: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActivityText: {
    fontSize: typography.fontSize.bodySecondary,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontFamily: typography.fontFamily.regular,
  },
});
