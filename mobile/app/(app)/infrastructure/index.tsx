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
import { Input } from '../../../src/components/Input';
import { Tabs, TabItem } from '../../../src/components/Tabs';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { EmptyState } from '../../../src/components/EmptyState';
import { useToast } from '../../../src/components/Toast';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { InfrastructureRepository } from '../../../src/repositories/InfrastructureRepository';
import { Infrastructure, InfrastructureStatus } from '../../../src/types/domain';
import { Feather } from '../../../src/components/Icon';

const infraRepo = new InfrastructureRepository();

export default function InfrastructureScreen() {
  const { showToast } = useToast();

  const [infras, setInfras] = useState<Infrastructure[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Update Status Bottom Sheet
  const [selectedInfra, setSelectedInfra] = useState<Infrastructure | null>(null);
  const [newStatus, setNewStatus] = useState<InfrastructureStatus>('COMMISSIONED');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const filter = selectedStatus === 'ALL' ? undefined : (selectedStatus as InfrastructureStatus);
      const data = await infraRepo.getAll(filter);
      setInfras(data);
    } catch (err) {
      console.error('Error loading infrastructure:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedStatus])
  );

  const handleUpdateStatus = async () => {
    if (!selectedInfra) return;
    setSubmitting(true);
    try {
      await infraRepo.updateStatus(
        selectedInfra.infrastructure_id,
        newStatus,
        {
          commissioned_date: newStatus === 'COMMISSIONED' ? new Date().toISOString().split('T')[0] : undefined,
          construction_start_date: newStatus === 'UNDER_CONSTRUCTION' ? new Date().toISOString().split('T')[0] : undefined,
          completion_date: newStatus === 'COMPLETED' ? new Date().toISOString().split('T')[0] : undefined,
        },
        remarks || undefined
      );

      showToast({ message: `✓ Infrastructure status set to ${newStatus}`, type: 'success' });
      setSelectedInfra(null);
      setRemarks('');
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Update failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: TabItem[] = [
    { id: 'ALL', label: 'All Pipelines', badge: infras.length },
    { id: 'PLANNED', label: 'Planned' },
    { id: 'UNDER_CONSTRUCTION', label: 'Construction' },
    { id: 'COMPLETED', label: 'Completed' },
    { id: 'COMMISSIONED', label: 'Commissioned' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="Infrastructure"
        subtitle="Distribution line tracking & valve network"
      />

      <Tabs tabs={tabs} activeTab={selectedStatus} onChangeTab={setSelectedStatus} />

      <FlatList
        data={infras}
        keyExtractor={(item) => item.infrastructure_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} colors={[colors.primary]} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.infraId}>Node #{item.infrastructure_id.slice(-6)}</Text>
                <Text style={styles.benName}>Farmer: {item.beneficiary_name || 'Beneficiary'}</Text>
              </View>
              <StatusBadge status={item.status} size="sm" />
            </View>

            <View style={styles.timelineBox}>
              {item.planned_date && (
                <Text style={styles.timelineText}>• Planned: {item.planned_date}</Text>
              )}
              {item.construction_start_date && (
                <Text style={styles.timelineText}>• Construction: {item.construction_start_date}</Text>
              )}
              {item.commissioned_date && (
                <Text style={[styles.timelineText, styles.commissionedText]}>
                  ✓ Commissioned: {item.commissioned_date}
                </Text>
              )}
            </View>

            {item.remarks ? (
              <Text style={styles.remarksText}>Details: {item.remarks}</Text>
            ) : null}

            <View style={styles.cardFooter}>
              <Text style={styles.allotmentRef}>Allotment #{item.allotment_id.slice(-6)}</Text>
              <Button
                title="Update Status"
                size="sm"
                variant="outline"
                onPress={() => {
                  setSelectedInfra(item);
                  setNewStatus(item.status === 'PLANNED' ? 'UNDER_CONSTRUCTION' : 'COMMISSIONED');
                }}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Feather name="activity" size={32} color={colors.secondary} />}
              title="No Infrastructure Found"
              description="No pipeline or distribution records match the selected filter."
            />
          ) : null
        }
      />

      {/* UPDATE STATUS BOTTOM SHEET */}
      <BottomSheet
        visible={!!selectedInfra}
        onClose={() => setSelectedInfra(null)}
        title="Update Commissioning Status"
        subtitle={`Node #${selectedInfra?.infrastructure_id.slice(-6)} • ${selectedInfra?.beneficiary_name}`}
      >
        <View style={styles.sheetForm}>
          <Text style={styles.fieldLabel}>New Status</Text>
          <View style={styles.statusOptions}>
            {(['PLANNED', 'UNDER_CONSTRUCTION', 'COMPLETED', 'COMMISSIONED'] as const).map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.statusOption, newStatus === st && styles.statusOptionSelected]}
                onPress={() => setNewStatus(st)}
              >
                <Text style={[styles.statusOptionText, newStatus === st && styles.statusOptionTextSelected]}>
                  {st.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Engineering / Commissioning Notes"
            placeholder="e.g. Pressure tested and line commissioned with valve tag #V-102"
            value={remarks}
            onChangeText={setRemarks}
          />

          <View style={styles.sheetActionButtons}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setSelectedInfra(null)}
              style={{ flex: 1 }}
            />
            <Button
              title="Save Status"
              variant="primary"
              loading={submitting}
              onPress={handleUpdateStatus}
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  listContent: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
  infraId: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  benName: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timelineBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    marginVertical: spacing.sm,
    gap: 4,
  },
  timelineText: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
  },
  commissionedText: {
    color: colors.success,
    fontWeight: '700',
  },
  remarksText: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  allotmentRef: {
    fontSize: typography.fontSize.micro,
    color: colors.textMuted,
  },
  sheetForm: {
    paddingBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  statusOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1.2,
    borderColor: colors.border,
  },
  statusOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  statusOptionText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  statusOptionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  sheetActionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
