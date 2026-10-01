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
import { useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';
import { Tabs, TabItem } from '../../../src/components/Tabs';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { EmptyState } from '../../../src/components/EmptyState';
import { useToast } from '../../../src/components/Toast';
import { useAuth } from '../../../src/auth/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { ExtensionRepository } from '../../../src/repositories/ExtensionRepository';
import { Extension, ExtensionStatus } from '../../../src/types/domain';
import { Feather } from '../../../src/components/Icon';

const extRepo = new ExtensionRepository();

export default function ExtensionsScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Approval Bottom Sheet State
  const [selectedExt, setSelectedExt] = useState<Extension | null>(null);
  const [approvedArea, setApprovedArea] = useState('');
  const [approvedLitres, setApprovedLitres] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const loadData = async () => {
    try {
      const filter = selectedStatus === 'ALL' ? undefined : (selectedStatus as ExtensionStatus);
      const data = await extRepo.getAll(filter);
      setExtensions(data);
    } catch (err) {
      console.error('Error loading extensions:', err);
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

  const handleApprove = async () => {
    if (!selectedExt) return;
    if (!approvedArea || !approvedLitres) {
      showToast({ message: 'Please enter approved acreage and litres', type: 'warning' });
      return;
    }

    setSubmittingApproval(true);
    try {
      await extRepo.approveExtension(
        selectedExt.extension_id,
        parseFloat(approvedArea),
        parseFloat(approvedLitres),
        'prj-csii',
        'ADMIN',
        approvalRemarks || undefined
      );

      showToast({ message: '✓ Water extension approved and cost calculated', type: 'success' });
      setSelectedExt(null);
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Approval failed', type: 'error' });
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleReject = async (ext: Extension) => {
    try {
      await extRepo.updateStatus(ext.extension_id, 'REJECTED', 'Rejected by administrator');
      showToast({ message: 'Extension request rejected', type: 'info' });
      loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Rejection failed', type: 'error' });
    }
  };

  const tabs: TabItem[] = [
    { id: 'ALL', label: 'All Requests', badge: extensions.length },
    { id: 'REQUESTED', label: 'Pending Review' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="Water Extensions"
        subtitle="Additional acreage & quota expansion"
        rightAction={
          !isAdmin
            ? {
                icon: 'plus',
                onPress: () => router.push('/(app)/extensions/new'),
                accessibilityLabel: 'Request Extension',
              }
            : undefined
        }
      />

      <Tabs tabs={tabs} activeTab={selectedStatus} onChangeTab={setSelectedStatus} />

      <FlatList
        data={extensions}
        keyExtractor={(item) => item.extension_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} colors={[colors.primary]} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.extId}>Ext #{item.extension_id.slice(-6)}</Text>
                <Text style={styles.benName}>{item.beneficiary_name || 'Beneficiary'}</Text>
              </View>
              <StatusBadge status={item.status} size="sm" />
            </View>

            <View style={styles.expansionBox}>
              <View style={styles.expansionRow}>
                <Text style={styles.expansionLabel}>Requested Expansion</Text>
                <Text style={styles.expansionValue}>
                  +{item.requested_additional_area.toFixed(2)} ac ({item.requested_additional_litres.toLocaleString()} L)
                </Text>
              </View>

              {item.approved_additional_litres ? (
                <View style={[styles.expansionRow, { marginTop: 4 }]}>
                  <Text style={styles.expansionLabel}>Approved & Cost</Text>
                  <Text style={[styles.expansionValue, styles.approvedCost]}>
                    +{item.approved_additional_litres.toLocaleString()} L (₹{(item.extension_cost || 0).toLocaleString()})
                  </Text>
                </View>
              ) : null}
            </View>

            {item.remarks ? (
              <Text style={styles.remarksText}>Notes: {item.remarks}</Text>
            ) : null}

            {isAdmin && item.status === 'REQUESTED' && (
              <View style={styles.actionRow}>
                <Button
                  title="Reject"
                  variant="destructive"
                  size="sm"
                  onPress={() => handleReject(item)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Review & Approve"
                  size="sm"
                  variant="primary"
                  onPress={() => {
                    setSelectedExt(item);
                    setApprovedArea(String(item.requested_additional_area));
                    setApprovedLitres(String(item.requested_additional_litres));
                  }}
                  style={{ flex: 1.5 }}
                />
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Feather name="git-pull-request" size={32} color={colors.accent.indigo} />}
              title="No Extension Requests"
              description="No water extension requests found matching the current tab filter."
              actionTitle={!isAdmin ? '+ Request Extension' : undefined}
              onAction={!isAdmin ? () => router.push('/(app)/extensions/new') : undefined}
            />
          ) : null
        }
      />

      {/* APPROVAL BOTTOM SHEET */}
      <BottomSheet
        visible={!!selectedExt}
        onClose={() => setSelectedExt(null)}
        title="Approve Water Extension"
        subtitle={`${selectedExt?.beneficiary_name} • Ext #${selectedExt?.extension_id.slice(-6)}`}
      >
        <View style={styles.sheetForm}>
          <Input
            label="Approved Additional Land (Acres)"
            placeholder="e.g. 2.00"
            keyboardType="decimal-pad"
            value={approvedArea}
            onChangeText={setApprovedArea}
          />

          <Input
            label="Approved Additional Litres"
            placeholder="e.g. 10000"
            keyboardType="number-pad"
            value={approvedLitres}
            onChangeText={setApprovedLitres}
          />

          <Input
            label="Approval Remarks"
            placeholder="e.g. Technical clearance granted for extra acreage"
            value={approvalRemarks}
            onChangeText={setApprovalRemarks}
          />

          <View style={styles.sheetActionButtons}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setSelectedExt(null)}
              style={{ flex: 1 }}
            />
            <Button
              title="Confirm Approval"
              variant="primary"
              loading={submittingApproval}
              onPress={handleApprove}
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
  extId: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  benName: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  expansionBox: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    marginVertical: spacing.sm,
  },
  expansionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expansionLabel: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
  },
  expansionValue: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  approvedCost: {
    color: colors.success,
  },
  remarksText: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sheetForm: {
    paddingBottom: spacing.lg,
  },
  sheetActionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
