import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import { MetricGroup, MetricItem } from '../../../src/components/MetricGroup';
import { Tabs, TabItem } from '../../../src/components/Tabs';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { ListItem } from '../../../src/components/ListItem';
import { EmptyState } from '../../../src/components/EmptyState';
import { useToast } from '../../../src/components/Toast';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { BillingRepository } from '../../../src/repositories/BillingRepository';
import { ReportRepository } from '../../../src/repositories/ReportRepository';
import { Payment } from '../../../src/types/domain';
import { useAuth } from '../../../src/auth/AuthContext';
import { Feather } from '../../../src/components/Icon';

const billingRepo = new BillingRepository();
const reportRepo = new ReportRepository();

export default function BillingScreen() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('PAYMENTS');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [financialStats, setFinancialStats] = useState({
    totalBilledAmount: 0,
    totalCollectedAmount: 0,
    totalPendingAmount: 0,
    collectionRatePct: 0,
    devBillsCount: 0,
    runningBillsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Payment Reversal Bottom Sheet
  const [selectedPaymentForReversal, setSelectedPaymentForReversal] = useState<Payment | null>(null);
  const [reversing, setReversing] = useState(false);

  const loadData = async () => {
    try {
      const pays = await billingRepo.getPayments();
      const stats = await reportRepo.getFinancialSummary();
      setPayments(pays);
      setFinancialStats(stats);
    } catch (err) {
      console.error('Error loading billing data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleConfirmReversal = async () => {
    if (!selectedPaymentForReversal) return;
    setReversing(true);
    try {
      await billingRepo.reversePayment(
        selectedPaymentForReversal.payment_id,
        'Reversed via mobile administrative portal'
      );
      showToast({ message: '✓ Payment reversed. Balances restored.', type: 'info' });
      setSelectedPaymentForReversal(null);
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Reversal failed', type: 'error' });
    } finally {
      setReversing(false);
    }
  };

  const tabs: TabItem[] = [
    { id: 'PAYMENTS', label: 'Payment Receipts', badge: payments.length },
    { id: 'SCHEDULE', label: '5-Stage Milestone Schedule' },
    { id: 'BALANCES', label: 'Financial Balances' },
  ];

  const financialMetrics: MetricItem[] = [
    {
      id: 'fb1',
      label: 'Total Billed',
      value: `₹${(financialStats.totalBilledAmount / 100000).toFixed(2)}L`,
      subvalue: `${financialStats.devBillsCount} Dev Bills`,
      color: colors.textPrimary,
    },
    {
      id: 'fb2',
      label: 'Total Collected',
      value: `₹${(financialStats.totalCollectedAmount / 100000).toFixed(2)}L`,
      subvalue: `${financialStats.collectionRatePct}% Rate`,
      color: colors.success,
    },
    {
      id: 'fb3',
      label: 'Outstanding Dues',
      value: `₹${(financialStats.totalPendingAmount / 100000).toFixed(2)}L`,
      subvalue: 'Milestone Dues',
      color: colors.warning,
    },
    {
      id: 'fb4',
      label: 'Running Bills',
      value: `${financialStats.runningBillsCount}`,
      subvalue: 'Periodic Charges',
      color: colors.accent.indigo,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="Billing & Installments"
        subtitle="5-Stage development schedule & payments"
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChangeTab={setActiveTab} />

      {activeTab === 'BALANCES' ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} colors={[colors.primary]} />}
          showsVerticalScrollIndicator={false}
        >
          <MetricGroup metrics={financialMetrics} columns={2} title="Device Financial Summary" />
        </ScrollView>
      ) : activeTab === 'SCHEDULE' ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>WaterGrid 5-Stage Development Schedule</Text>
            <Text style={styles.cardSubtitle}>
              Authoritative milestone distribution required for development bill settlement:
            </Text>

            {[
              { stage: 1, pct: '2.5%', name: 'Initial Administrative Fee & Booking' },
              { stage: 2, pct: '20.0%', name: 'Pipeline Earthwork, Trenching & Laying' },
              { stage: 3, pct: '25.0%', name: 'Main Feeder Storage Pipe Delivery' },
              { stage: 4, pct: '25.0%', name: 'Distribution Valves & Node Installation' },
              { stage: 5, pct: '27.5%', name: 'Final Commissioning & Water Release' },
            ].map((s) => (
              <View key={s.stage} style={styles.stageRow}>
                <View style={styles.stageNumberBadge}>
                  <Text style={styles.stageNumberText}>0{s.stage}</Text>
                </View>
                <View style={styles.stageTextContainer}>
                  <Text style={styles.stageTitle}>{s.name}</Text>
                  <Text style={styles.stagePct}>Milestone Quota: {s.pct}</Text>
                </View>
              </View>
            ))}

            <View style={styles.stageTotalRow}>
              <Text style={styles.stageTotalLabel}>Total Allocation Percentage:</Text>
              <Text style={styles.stageTotalVal}>100.0%</Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.payment_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} colors={[colors.primary]} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.receiptTitle}>{item.receipt_number}</Text>
                  <Text style={styles.payDate}>
                    {new Date(item.payment_date).toLocaleDateString()} • {item.payment_mode}
                  </Text>
                </View>
                <StatusBadge status={item.status} size="sm" />
              </View>

              <View style={styles.payAmountRow}>
                <Text style={styles.payRef}>Ref: {item.payment_reference || 'CASH'}</Text>
                <Text style={styles.payAmountVal}>₹{item.amount.toLocaleString()}</Text>
              </View>

              {item.remarks ? (
                <Text style={styles.payRemarksText}>Notes: {item.remarks}</Text>
              ) : null}

              {isAdmin && !item.is_reversal && item.status !== 'REVERSED' && (
                <TouchableOpacity
                  style={styles.reverseActionBtn}
                  onPress={() => setSelectedPaymentForReversal(item)}
                  activeOpacity={0.7}
                >
                  <Feather name="rotate-ccw" size={13} color={colors.danger} />
                  <Text style={styles.reverseActionText}>Reverse Payment</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon={<Feather name="credit-card" size={32} color={colors.secondary} />}
                title="No Payment Receipts"
                description="No payment records found on this device."
              />
            ) : null
          }
        />
      )}

      {/* Payment Reversal Confirmation Bottom Sheet */}
      <BottomSheet
        visible={!!selectedPaymentForReversal}
        onClose={() => setSelectedPaymentForReversal(null)}
        title="Reverse Payment"
        subtitle={`Receipt: ${selectedPaymentForReversal?.receipt_number}`}
      >
        <View style={styles.reversalSheet}>
          <Text style={styles.reversalWarning}>
            Reversing this payment of ₹{selectedPaymentForReversal?.amount.toLocaleString()} will restore the pending installment balance and mark this receipt as reversed in the audit trail.
          </Text>

          <Button
            title="Confirm Payment Reversal"
            variant="destructive"
            loading={reversing}
            onPress={handleConfirmReversal}
            fullWidth
            style={{ marginTop: 12 }}
          />

          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => setSelectedPaymentForReversal(null)}
            fullWidth
            style={{ marginTop: 8 }}
          />
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
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
  cardTitle: {
    fontSize: typography.fontSize.heading,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  cardSubtitle: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.lg,
    fontFamily: typography.fontFamily.regular,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stageNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stageNumberText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  stageTextContainer: {
    flex: 1,
  },
  stageTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  stagePct: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    marginTop: 1,
  },
  stageTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  stageTotalLabel: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stageTotalVal: {
    fontSize: typography.fontSize.heading,
    fontWeight: '800',
    color: colors.primary,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  receiptTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  payDate: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    marginTop: 2,
  },
  payAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  payRef: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  payAmountVal: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '800',
    color: colors.success,
  },
  payRemarksText: {
    fontSize: typography.fontSize.micro,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
  },
  reverseActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  reverseActionText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '600',
    color: colors.danger,
  },
  reversalSheet: {
    paddingBottom: spacing.lg,
  },
  reversalWarning: {
    fontSize: typography.fontSize.bodySecondary,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
});
