import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Share,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { MetricGroup, MetricItem } from '../../../src/components/MetricGroup';
import { ListItem } from '../../../src/components/ListItem';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import {
  ReportRepository,
  FinancialReportSummary,
  WaterAllocationSummary,
  InfrastructureReportSummary,
  VillageLandCoverage,
} from '../../../src/repositories/ReportRepository';
import { Feather } from '../../../src/components/Icon';

const reportRepo = new ReportRepository();

export default function ReportsScreen() {
  const [financials, setFinancials] = useState<FinancialReportSummary | null>(null);
  const [waterStats, setWaterStats] = useState<WaterAllocationSummary | null>(null);
  const [infraStats, setInfraStats] = useState<InfrastructureReportSummary | null>(null);
  const [villageCoverage, setVillageCoverage] = useState<VillageLandCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [f, w, i, v] = await Promise.all([
        reportRepo.getFinancialSummary(),
        reportRepo.getWaterSummary(),
        reportRepo.getInfrastructureSummary(),
        reportRepo.getVillageLandCoverage(),
      ]);
      setFinancials(f);
      setWaterStats(w);
      setInfraStats(i);
      setVillageCoverage(v);
    } catch (err) {
      console.error('Error loading reports:', err);
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

  const financialMetrics: MetricItem[] = [
    {
      id: 'r_f1',
      label: 'Total Billed',
      value: `₹${((financials?.totalBilledAmount || 0) / 100000).toFixed(2)}L`,
      subvalue: 'Development & Running',
      color: colors.textPrimary,
    },
    {
      id: 'r_f2',
      label: 'Total Collected',
      value: `₹${((financials?.totalCollectedAmount || 0) / 100000).toFixed(2)}L`,
      subvalue: `${financials?.collectionRatePct || 0}% Recovery`,
      color: colors.success,
    },
  ];

  const waterMetrics: MetricItem[] = [
    {
      id: 'r_w1',
      label: 'Approved Litres',
      value: `${((waterStats?.totalApprovedLitres || 0) / 1000).toFixed(0)}k L`,
      subvalue: `${waterStats?.totalAllotments || 0} Allotments`,
      color: colors.accent.indigo,
    },
    {
      id: 'r_w2',
      label: 'Avg Allocation',
      value: `${(waterStats?.avgLitresPerAcre || 0).toLocaleString()} L/ac`,
      subvalue: `${waterStats?.totalLandAcres.toFixed(1) || 0} Acres covered`,
      color: colors.primary,
    },
  ];

  const handleShareReport = async () => {
    try {
      await Share.share({
        message: `WaterGrid Executive Report Summary\n--------------------------------\n• Total Billed: ₹${((financials?.totalBilledAmount || 0) / 100000).toFixed(2)} Lakhs\n• Total Collected: ₹${((financials?.totalCollectedAmount || 0) / 100000).toFixed(2)} Lakhs (${financials?.collectionRatePct || 0}% Recovery)\n• Approved Water Quota: ${((waterStats?.totalApprovedLitres || 0) / 1000).toFixed(0)}k Litres\n• Active Land Covered: ${waterStats?.totalLandAcres.toFixed(1) || 0} Acres\n• Commissioned Pipelines: ${infraStats?.commissioned || 0} of ${infraStats?.total || 0} (${infraStats?.commissionedRatePct || 0}%)\n--------------------------------\nGenerated from WaterGrid Mobile Client`,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="Analytics & Reports"
        subtitle="Aggregated field KPIs and village analytics"
        rightAction={{
          icon: 'share-2',
          onPress: handleShareReport,
          accessibilityLabel: 'Share Report',
        }}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Financial Billing & Recovery */}
        <SectionHeader title="Financial Billing & Recovery" subtitle="5-Stage development collections" />
        <MetricGroup metrics={financialMetrics} columns={2} />

        {/* Water Allocation Demands */}
        <SectionHeader title="Water Allocation Quotas" subtitle="Beneficiary demand vs approved quota" />
        <MetricGroup metrics={waterMetrics} columns={2} />

        {/* Infrastructure Progress */}
        <SectionHeader title="Infrastructure Delivery" subtitle="Pipeline commissioning status" />
        <View style={styles.card}>
          <View style={styles.infraSummaryHeader}>
            <Text style={styles.infraTotalText}>
              Total Distribution Lines: {infraStats?.total || 0}
            </Text>
            <Text style={styles.commissionedPctText}>
              {infraStats?.commissionedRatePct || 0}% Commissioned
            </Text>
          </View>

          <View style={styles.progressRow}>
            <View style={[styles.progressItem, { backgroundColor: colors.successLight }]}>
              <Text style={styles.progressLabel}>Commissioned</Text>
              <Text style={[styles.progressVal, { color: colors.success }]}>
                {infraStats?.commissioned || 0}
              </Text>
            </View>

            <View style={[styles.progressItem, { backgroundColor: colors.infoLight }]}>
              <Text style={styles.progressLabel}>Under Const.</Text>
              <Text style={[styles.progressVal, { color: colors.info }]}>
                {infraStats?.underConstruction || 0}
              </Text>
            </View>

            <View style={[styles.progressItem, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={styles.progressLabel}>Planned</Text>
              <Text style={[styles.progressVal, { color: colors.textSecondary }]}>
                {infraStats?.planned || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Village Land Coverage Breakdown */}
        <SectionHeader title="Village Land Coverage" subtitle="Registered acreage by LGD Village" />
        <View style={styles.card}>
          {villageCoverage.map((v, idx) => (
            <ListItem
              key={idx}
              title={v.villageName}
              subtitle={`${v.districtName} • ${v.beneficiariesCount} Beneficiaries`}
              rightElement={<Text style={styles.villageAcres}>{v.totalAcres.toFixed(2)} Acres</Text>}
              borderBottom={idx < villageCoverage.length - 1}
              showChevron={false}
            />
          ))}
        </View>
      </ScrollView>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  infraSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  infraTotalText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  commissionedPctText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '800',
    color: colors.success,
  },
  progressRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressItem: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  progressVal: {
    fontSize: typography.fontSize.heading,
    fontWeight: '800',
    marginTop: 2,
  },
  villageAcres: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.primary,
  },
});
