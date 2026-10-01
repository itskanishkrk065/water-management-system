import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';
import { Tabs, TabItem } from '../../../src/components/Tabs';
import { MetricGroup, MetricItem } from '../../../src/components/MetricGroup';
import { EmptyState } from '../../../src/components/EmptyState';
import { useToast } from '../../../src/components/Toast';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { SyncRepository } from '../../../src/repositories/SyncRepository';
import { SyncQueueItem, SyncSummary } from '../../../src/types/sync';
import { Feather } from '../../../src/components/Icon';

const syncRepo = new SyncRepository();

export default function SyncScreen() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('PENDING');
  const [queue, setQueue] = useState<SyncQueueItem[]>([]);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSyncData = async () => {
    try {
      const q = await syncRepo.getQueue();
      const s = await syncRepo.getSummary();
      setQueue(q);
      setSummary(s);
    } catch (err) {
      console.error('Error loading sync data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSyncData();
    }, [])
  );

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await syncRepo.processPendingSync();
      showToast({
        message: `✓ Synchronized ${result.successCount} local records`,
        type: 'success',
      });
      loadSyncData();
    } catch (err: any) {
      showToast({ message: err.message || 'Sync failed', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryItem = async (id: string) => {
    try {
      await syncRepo.retryItem(id);
      showToast({ message: 'Retrying sync operation...', type: 'info' });
      loadSyncData();
    } catch (err: any) {
      showToast({ message: err.message || 'Retry failed', type: 'error' });
    }
  };

  const filteredQueue = queue.filter((item) => {
    if (activeTab === 'PENDING') return item.status === 'PENDING';
    if (activeTab === 'SYNCED') return item.status === 'SYNCED';
    if (activeTab === 'FAILED') return item.status === 'FAILED' || item.status === 'CONFLICT';
    return true;
  });

  const syncMetrics: MetricItem[] = [
    {
      id: 'sq_p',
      label: 'Pending Upload',
      value: summary?.pending || 0,
      subvalue: 'Local mutations',
      color: (summary?.pending || 0) > 0 ? colors.warning : colors.success,
    },
    {
      id: 'sq_s',
      label: 'Synced',
      value: summary?.synced || 0,
      subvalue: 'Transmitted records',
      color: colors.success,
    },
    {
      id: 'sq_f',
      label: 'Failed / Conflict',
      value: summary?.failed || 0,
      subvalue: (summary?.failed || 0) > 0 ? 'Requires retry' : 'No errors',
      color: (summary?.failed || 0) > 0 ? colors.danger : colors.textMuted,
    },
  ];

  const tabs: TabItem[] = [
    { id: 'PENDING', label: 'Pending Upload', badge: summary?.pending },
    { id: 'SYNCED', label: 'Synced Records', badge: summary?.synced },
    { id: 'FAILED', label: 'Failed & Errors', badge: summary?.failed },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="Sync Center"
        subtitle={`${summary?.pending || 0} local mutations queued for sync`}
      />

      <View style={styles.metricsWrapper}>
        <MetricGroup metrics={syncMetrics} columns={3} />
      </View>

      <View style={styles.actionBanner}>
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerTitle}>Offline Sync Engine</Text>
          <Text style={styles.bannerSubtitle}>
            Changes are saved locally and queued for secure transmission.
          </Text>
        </View>

        <Button
          title="Sync Now"
          onPress={handleSyncNow}
          loading={syncing}
          disabled={!summary || summary.pending === 0}
          size="sm"
          icon={<Feather name="refresh-cw" size={14} color="#FFFFFF" />}
        />
      </View>

      <Tabs tabs={tabs} activeTab={activeTab} onChangeTab={setActiveTab} />

      <FlatList
        data={filteredQueue}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadSyncData} colors={[colors.primary]} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.entityTitle}>{item.entity_type.replace(/_/g, ' ')}</Text>
                <Text style={styles.entityIdText}>ID: {item.entity_id}</Text>
              </View>
              <StatusBadge
                status={item.status === 'PENDING' ? 'PENDING_SYNC' : item.status}
                size="sm"
              />
            </View>

            <View style={styles.payloadBox}>
              <Text style={styles.payloadText} numberOfLines={2}>
                {item.payload}
              </Text>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.timestampText}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Local Queue
              </Text>

              {item.status === 'FAILED' && (
                <TouchableOpacity
                  onPress={() => handleRetryItem(item.id)}
                  style={styles.retryChip}
                  activeOpacity={0.7}
                >
                  <Feather name="rotate-cw" size={12} color={colors.danger} />
                  <Text style={styles.retryChipText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Feather name="check-circle" size={32} color={colors.success} />}
            title="Queue is Empty"
            description={
              activeTab === 'PENDING'
                ? 'All device records have been synchronized with the master database.'
                : 'No items match the current sync tab.'
            }
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  metricsWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bannerInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  bannerTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  bannerSubtitle: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    marginTop: 1,
    fontFamily: typography.fontFamily.regular,
  },
  listContent: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  entityTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  entityIdText: {
    fontSize: typography.fontSize.micro,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.mono,
    marginTop: 1,
  },
  payloadBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  payloadText: {
    fontSize: typography.fontSize.micro,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.mono,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  timestampText: {
    fontSize: typography.fontSize.micro,
    color: colors.textMuted,
  },
  retryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  retryChipText: {
    fontSize: typography.fontSize.micro,
    fontWeight: '700',
    color: colors.danger,
  },
});
