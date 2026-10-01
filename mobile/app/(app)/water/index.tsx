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
import { EmptyState } from '../../../src/components/EmptyState';
import { Tabs, TabItem } from '../../../src/components/Tabs';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { ListItem } from '../../../src/components/ListItem';
import { Input } from '../../../src/components/Input';
import { useToast } from '../../../src/components/Toast';
import { useAuth } from '../../../src/auth/AuthContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { WaterRepository } from '../../../src/repositories/WaterRepository';
import { WaterApplication } from '../../../src/types/domain';
import { Feather } from '../../../src/components/Icon';

const waterRepo = new WaterRepository();

export default function WaterApplicationsScreen() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('PENDING');
  const [applications, setApplications] = useState<WaterApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admin Review Sheet
  const [selectedApp, setSelectedApp] = useState<WaterApplication | null>(null);
  const [approvedLitresInput, setApprovedLitresInput] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const loadApplications = async () => {
    try {
      let data: WaterApplication[] = [];
      if (activeTab === 'HISTORY') {
        data = await waterRepo.getHistoricalApplications();
      } else {
        data = await waterRepo.getActiveApplications();
        if (activeTab === 'PENDING') {
          data = data.filter((a) => a.status === 'DRAFT' || a.status === 'UNDER_REVIEW');
        } else if (activeTab === 'APPROVED') {
          data = data.filter((a) => a.status === 'APPROVED');
        }
      }
      setApplications(data);
    } catch (err) {
      console.error('Error loading water applications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadApplications();
    }, [activeTab])
  );

  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = async () => {
    if (!selectedApp) return;
    setReviewing(true);
    try {
      const litresToApprove = parseFloat(approvedLitresInput) || selectedApp.calculated_litres;
      await waterRepo.approveApplication(selectedApp.application_id, litresToApprove, 'Approved via mobile review');
      showToast({ message: `✓ Quota of ${litresToApprove.toLocaleString()} L approved`, type: 'success' });
      setSelectedApp(null);
      await loadApplications();
    } catch (err: any) {
      showToast({ message: err.message || 'Approval failed', type: 'error' });
    } finally {
      setReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    if (!rejectionReason.trim()) {
      showToast({ message: 'Please provide a rejection reason', type: 'warning' });
      return;
    }
    setReviewing(true);
    try {
      await waterRepo.rejectApplication(selectedApp.application_id, rejectionReason.trim());
      showToast({ message: 'Water application rejected', type: 'info' });
      setSelectedApp(null);
      setRejectionReason('');
      await loadApplications();
    } catch (err: any) {
      showToast({ message: err.message || 'Rejection failed', type: 'error' });
    } finally {
      setReviewing(false);
    }
  };

  const tabs: TabItem[] = [
    { id: 'PENDING', label: 'Pending Review' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'ALL', label: 'All Active' },
    { id: 'HISTORY', label: 'Closed / History' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="Water Quotas"
        subtitle={`${applications.length} applications in local queue`}
        rightAction={
          !isAdmin
            ? {
                icon: 'plus',
                onPress: () => router.push('/(app)/water/new'),
                accessibilityLabel: 'New Water Application',
              }
            : undefined
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChangeTab={setActiveTab} />

      <FlatList
        data={applications}
        keyExtractor={(item) => item.application_id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadApplications} colors={[colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => {
              if (isAdmin && (item.status === 'DRAFT' || item.status === 'UNDER_REVIEW')) {
                setSelectedApp(item);
                setApprovedLitresInput(String(item.calculated_litres));
              } else {
                router.push(`/(app)/beneficiaries/${item.beneficiary_id}`);
              }
            }}
          >
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.cardTitle}>App #{item.application_id.slice(-6)}</Text>
                <Text style={styles.cardBeneficiary}>{item.beneficiary_name || 'Beneficiary'}</Text>
              </View>
              <StatusBadge status={item.status} size="sm" />
            </View>

            <View style={styles.quotasGrid}>
              <View style={styles.quotaTile}>
                <Text style={styles.quotaLabel}>Required</Text>
                <Text style={styles.quotaValue}>{item.required_litres.toLocaleString()} L</Text>
              </View>
              <View style={styles.quotaTile}>
                <Text style={styles.quotaLabel}>Calculated</Text>
                <Text style={styles.quotaValue}>{item.calculated_litres.toLocaleString()} L</Text>
              </View>
              <View style={styles.quotaTile}>
                <Text style={styles.quotaLabel}>Approved</Text>
                <Text style={[styles.quotaValue, item.allotment ? styles.approvedVal : styles.pendingVal]}>
                  {item.allotment ? `${item.allotment.approved_litres.toLocaleString()} L` : 'Pending'}
                </Text>
              </View>
            </View>

            {item.remarks ? (
              <Text style={styles.remarksText} numberOfLines={2}>
                Notes: {item.remarks}
              </Text>
            ) : null}

            <View style={styles.cardFooter}>
              <Text style={styles.dateText}>
                Date: {new Date(item.application_date).toLocaleDateString()}
              </Text>
              {isAdmin && (item.status === 'DRAFT' || item.status === 'UNDER_REVIEW') ? (
                <Text style={styles.reviewCtaText}>Review & Approve →</Text>
              ) : (
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Feather name="droplet" size={32} color={colors.primary} />}
              title={activeTab === 'PENDING' ? 'No Pending Approvals' : 'No Applications Found'}
              description={
                activeTab === 'PENDING'
                  ? 'All water applications on this device have been reviewed and processed.'
                  : 'No water applications match the current tab filter.'
              }
            />
          ) : null
        }
      />

      {/* Admin Approval Bottom Sheet */}
      <BottomSheet
        visible={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title="Review Water Application"
        subtitle={`App #${selectedApp?.application_id.slice(-6)} • ${selectedApp?.beneficiary_name}`}
      >
        {selectedApp && (
          <View style={styles.reviewSheet}>
            <View style={styles.reviewMetrics}>
              <ListItem
                title="Required by Beneficiary"
                subtitle={`${selectedApp.required_litres.toLocaleString()} Litres`}
                showChevron={false}
              />
              <ListItem
                title="Calculated Standard Quota"
                subtitle={`${selectedApp.calculated_litres.toLocaleString()} Litres`}
                showChevron={false}
              />
            </View>

            <View style={styles.reviewForm}>
              <Text style={styles.fieldLabel}>Approved Quantity (Litres)</Text>
              <Input
                value={approvedLitresInput}
                onChangeText={setApprovedLitresInput}
                keyboardType="numeric"
                hint="Defaults to calculated standard quota"
              />
              <Input
                label="Rejection Reason (if rejecting)"
                value={rejectionReason}
                onChangeText={setRejectionReason}
                placeholder="e.g. Ineligible holding / exceeds scheme capacity"
              />
            </View>

            <View style={styles.reviewActions}>
              <Button
                title="Reject"
                variant="destructive"
                loading={reviewing}
                onPress={handleReject}
                style={{ flex: 1 }}
              />
              <Button
                title="Approve Quota"
                variant="primary"
                loading={reviewing}
                onPress={handleApprove}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        )}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  cardBeneficiary: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  quotasGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  quotaTile: {
    flex: 1,
  },
  quotaLabel: {
    fontSize: typography.fontSize.micro,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  quotaValue: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  approvedVal: {
    color: colors.success,
  },
  pendingVal: {
    color: colors.warning,
  },
  remarksText: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  dateText: {
    fontSize: typography.fontSize.micro,
    color: colors.textMuted,
  },
  reviewCtaText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  reviewSheet: {
    paddingBottom: spacing.lg,
  },
  reviewMetrics: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  reviewForm: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
