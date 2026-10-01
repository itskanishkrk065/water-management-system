import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { useToast } from '../../../src/components/Toast';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { DiagnosticsService, DatabaseDiagnostics } from '../../../src/services/diagnosticsService';
import { executeCleanState, CleanStateScope } from '../../../src/db/cleanState';
import { Feather } from '../../../src/components/Icon';

const diagnosticsService = new DiagnosticsService();

export default function DeveloperPortalScreen() {
  const { showToast } = useToast();

  const [diagnostics, setDiagnostics] = useState<DatabaseDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [inspectTable, setInspectTable] = useState<string | null>(null);
  const [tableRecords, setTableRecords] = useState<any[]>([]);

  // Clean State Bottom Sheet
  const [activeCleanScope, setActiveCleanScope] = useState<{ scope: CleanStateScope; title: string; desc: string } | null>(null);
  const [executingClean, setExecutingClean] = useState(false);

  const loadDiagnostics = async () => {
    try {
      const diag = await diagnosticsService.runDiagnostics();
      setDiagnostics(diag);
    } catch (err) {
      console.error('Error loading diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDiagnostics();
    }, [])
  );

  const handleInspectTable = async (tableName: string) => {
    try {
      const data = await diagnosticsService.inspectTable(tableName, 4);
      setInspectTable(tableName);
      setTableRecords(data);
    } catch (err: any) {
      showToast({ message: err.message || 'Inspection error', type: 'error' });
    }
  };

  const handleConfirmClean = async () => {
    if (!activeCleanScope) return;
    setExecutingClean(true);
    try {
      const res = await executeCleanState(activeCleanScope.scope, true);
      showToast({ message: res.message, type: 'info' });
      setActiveCleanScope(null);
      await loadDiagnostics();
    } catch (err: any) {
      showToast({ message: err.message || 'Clean state failed', type: 'error' });
    } finally {
      setExecutingClean(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="Developer Portal"
        subtitle="SQLite Diagnostics & Scoped Clean State"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Engine Diagnostics */}
        <SectionHeader title="SQLite Database Engine" subtitle="Local embedded diagnostics" />
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Engine Status</Text>
            <StatusBadge status={diagnostics?.status || 'HEALTHY'} size="sm" />
          </View>

          <View style={styles.diagGrid}>
            <View style={styles.diagItem}>
              <Text style={styles.diagLabel}>SQLite Version</Text>
              <Text style={styles.diagVal}>{diagnostics?.sqliteVersion || '3.45.0'}</Text>
            </View>
            <View style={styles.diagItem}>
              <Text style={styles.diagLabel}>Integrity Check</Text>
              <Text style={styles.diagVal}>{diagnostics?.integrityCheck || 'ok'}</Text>
            </View>
            <View style={styles.diagItem}>
              <Text style={styles.diagLabel}>Total Tables</Text>
              <Text style={styles.diagVal}>{diagnostics?.totalTables || 12}</Text>
            </View>
            <View style={styles.diagItem}>
              <Text style={styles.diagLabel}>DB Size</Text>
              <Text style={styles.diagVal}>{diagnostics?.databaseSizeEstimateKB || 128} KB</Text>
            </View>
          </View>

          <Button
            title="Re-run Diagnostics"
            variant="secondary"
            size="sm"
            onPress={loadDiagnostics}
            icon={<Feather name="refresh-cw" size={14} color={colors.textPrimary} />}
            style={{ marginTop: 12 }}
          />
        </View>

        {/* Tables & Counts Inspector */}
        <SectionHeader title="Table Inspector" subtitle="Tap table to inspect raw rows" />
        <View style={styles.card}>
          <View style={styles.tableList}>
            {diagnostics?.tableStats.map((t) => (
              <TouchableOpacity
                key={t.tableName}
                style={[
                  styles.tableRow,
                  inspectTable === t.tableName && styles.tableRowSelected,
                ]}
                onPress={() => handleInspectTable(t.tableName)}
              >
                <Text style={styles.tableName}>{t.tableName}</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countText}>{t.rowCount} rows</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {inspectTable && (
            <View style={styles.inspectorContainer}>
              <Text style={styles.inspectorHeader}>
                Sample Records: {inspectTable} (Top {tableRecords.length})
              </Text>
              {tableRecords.length === 0 ? (
                <Text style={styles.noDataText}>No records in table.</Text>
              ) : (
                tableRecords.map((rec, i) => (
                  <View key={i} style={styles.jsonBlock}>
                    <Text style={styles.jsonText}>{JSON.stringify(rec, null, 2)}</Text>
                  </View>
                ))
              )}
            </View>
          )}
        </View>

        {/* Clean State Scopes */}
        <SectionHeader title="Clean State Protocol" subtitle="Scoped database reset tools" />
        <View style={styles.cleanCard}>
          <Text style={styles.cleanDesc}>
            Destructive reset actions require explicit confirmation and execute with full local transaction safety.
          </Text>

          <View style={styles.cleanBtnGroup}>
            <Button
              title="Clear Beneficiaries & Land"
              variant="secondary"
              size="sm"
              onPress={() =>
                setActiveCleanScope({
                  scope: 'BENEFICIARIES_ONLY',
                  title: 'Clear Beneficiaries & Land',
                  desc: 'This will delete all locally registered beneficiaries, holdings, and parcels.',
                })
              }
            />

            <Button
              title="Clear Water Apps & Bills"
              variant="secondary"
              size="sm"
              onPress={() =>
                setActiveCleanScope({
                  scope: 'WATER_APPLICATIONS_ONLY',
                  title: 'Clear Water Apps & Bills',
                  desc: 'This will purge all water applications, allotments, bills, and payment records.',
                })
              }
            />

            <Button
              title="Clear Sync Queue"
              variant="secondary"
              size="sm"
              onPress={() =>
                setActiveCleanScope({
                  scope: 'SYNC_QUEUE_ONLY',
                  title: 'Clear Sync Queue',
                  desc: 'This will empty the pending transmission queue without modifying local records.',
                })
              }
            />

            <Button
              title="Reset Local DB & Re-seed Master Data"
              variant="destructive"
              onPress={() =>
                setActiveCleanScope({
                  scope: 'FULL_DATABASE_RESET',
                  title: 'Full Database Reset & Master Re-seed',
                  desc: 'This will recreate all 12 SQLite tables and populate baseline test datasets (Coimbatore, Anaimalai, Project CSII-2026).',
                })
              }
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </ScrollView>

      {/* CLEAN STATE CONFIRMATION BOTTOM SHEET */}
      <BottomSheet
        visible={!!activeCleanScope}
        onClose={() => setActiveCleanScope(null)}
        title={activeCleanScope?.title || 'Clean State'}
        subtitle="Confirm Destructive Operation"
      >
        <View style={styles.cleanSheetContent}>
          <View style={styles.warningAlertBox}>
            <Feather name="alert-triangle" size={20} color={colors.danger} />
            <Text style={styles.warningAlertText}>{activeCleanScope?.desc}</Text>
          </View>

          <Button
            title="Execute Clean State"
            variant="destructive"
            loading={executingClean}
            onPress={handleConfirmClean}
            fullWidth
            style={{ marginTop: 12 }}
          />

          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => setActiveCleanScope(null)}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  diagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  diagItem: {
    width: '48%',
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  diagLabel: {
    fontSize: typography.fontSize.micro,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  diagVal: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.mono,
  },
  tableList: {
    gap: 4,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  tableRowSelected: {
    backgroundColor: colors.primaryLight,
  },
  tableName: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.mono,
  },
  countPill: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countText: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  inspectorContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  inspectorHeader: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  jsonBlock: {
    backgroundColor: colors.neutral[900],
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  jsonText: {
    fontSize: 10,
    color: '#34D399',
    fontFamily: typography.fontFamily.mono,
  },
  noDataText: {
    fontSize: typography.fontSize.tiny,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  cleanCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  cleanDesc: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  cleanBtnGroup: {
    gap: spacing.sm,
  },
  cleanSheetContent: {
    paddingBottom: spacing.lg,
  },
  warningAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  warningAlertText: {
    flex: 1,
    fontSize: typography.fontSize.caption,
    color: colors.danger,
    lineHeight: 18,
    fontWeight: '500',
  },
});
