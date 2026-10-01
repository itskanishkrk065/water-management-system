import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';
import { Colors } from '../../../src/constants/colors';
import { DiagnosticsService, DatabaseDiagnostics } from '../../../src/services/diagnosticsService';
import { executeCleanState, CleanStateScope } from '../../../src/db/cleanState';
import {
  Terminal,
  Database,
  Activity,
  AlertTriangle,
  RefreshCw,
  Trash2,
  HardDrive,
  CheckCircle,
} from 'lucide-react-native';

const diagnosticsService = new DiagnosticsService();

export default function DeveloperPortalScreen() {
  const [diagnostics, setDiagnostics] = useState<DatabaseDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState(false);
  const [inspectTable, setInspectTable] = useState<string | null>(null);
  const [tableRecords, setTableRecords] = useState<any[]>([]);

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
      const data = await diagnosticsService.inspectTable(tableName, 5);
      setInspectTable(tableName);
      setTableRecords(data);
    } catch (err: any) {
      Alert.alert('Inspector Error', err.message || 'Could not fetch records.');
    }
  };

  const handleCleanStateScope = (scope: CleanStateScope, title: string) => {
    Alert.alert(
      `Clean State: ${title}`,
      'This operation will modify or remove local test data. Do you wish to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Execute Clean State',
          style: 'destructive',
          onPress: async () => {
            setRunningAction(true);
            try {
              const res = await executeCleanState(scope, true);
              Alert.alert('Clean State Complete', res.message);
              await loadDiagnostics();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Clean state execution failed.');
            } finally {
              setRunningAction(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Developer Portal"
        subtitle="Protected Mobile Diagnostics & Clean State"
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* System Diagnostics Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Database size={18} color={Colors.primary[600]} />
              <Text style={styles.cardTitle}>SQLite Database Engine</Text>
            </View>
            <StatusBadge status={diagnostics?.status || 'HEALTHY'} size="small" />
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary[600]} style={{ margin: 16 }} />
          ) : (
            <View style={styles.diagGrid}>
              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>SQLite Version</Text>
                <Text style={styles.diagValue}>{diagnostics?.sqliteVersion}</Text>
              </View>

              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>Integrity Check</Text>
                <Text style={styles.diagValue}>{diagnostics?.integrityCheck}</Text>
              </View>

              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>Total Tables</Text>
                <Text style={styles.diagValue}>{diagnostics?.totalTables}</Text>
              </View>

              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>Estimated Size</Text>
                <Text style={styles.diagValue}>
                  {diagnostics?.databaseSizeEstimateKB} KB
                </Text>
              </View>
            </View>
          )}

          <Button
            title="Re-run Diagnostics"
            variant="outline"
            size="small"
            onPress={loadDiagnostics}
            icon={<RefreshCw size={14} color={Colors.neutral[800]} />}
            style={{ marginTop: 12 }}
          />
        </View>

        {/* Database Table Inspector */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Activity size={18} color={Colors.secondary[600]} />
              <Text style={styles.cardTitle}>Database Inspector & Counts</Text>
            </View>
          </View>

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
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{t.rowCount} rows</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {inspectTable && (
            <View style={styles.inspectorContainer}>
              <Text style={styles.inspectorTitle}>
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

        {/* Protected Clean State Protocol */}
        <View style={styles.cleanCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <AlertTriangle size={18} color={Colors.status.dangerText} />
              <Text style={[styles.cardTitle, { color: Colors.status.dangerText }]}>
                Clean State Protocol
              </Text>
            </View>
          </View>

          <Text style={styles.cleanWarningText}>
            Safely reset specific local data partitions or perform a full baseline reconstruction.
          </Text>

          <View style={styles.cleanActionsList}>
            <Button
              title="Clear Beneficiaries & Land"
              variant="outline"
              size="small"
              onPress={() => handleCleanStateScope('BENEFICIARIES_ONLY', 'Clear Beneficiaries')}
              style={styles.cleanBtn}
            />

            <Button
              title="Clear Water Applications & Bills"
              variant="outline"
              size="small"
              onPress={() =>
                handleCleanStateScope('WATER_APPLICATIONS_ONLY', 'Clear Water Apps & Bills')
              }
              style={styles.cleanBtn}
            />

            <Button
              title="Clear Sync Queue"
              variant="outline"
              size="small"
              onPress={() => handleCleanStateScope('SYNC_QUEUE_ONLY', 'Clear Sync Queue')}
              style={styles.cleanBtn}
            />

            <Button
              title="Reset Local Database (Full Reset + Re-seed)"
              variant="danger"
              size="medium"
              loading={runningAction}
              onPress={() =>
                handleCleanStateScope('FULL_DATABASE_RESET', 'Full Reset & Master Re-seed')
              }
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  diagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderColor: Colors.neutral[100],
    paddingTop: 12,
  },
  diagItem: {
    width: '48%',
    backgroundColor: Colors.neutral[50],
    padding: 10,
    borderRadius: 8,
  },
  diagLabel: {
    fontSize: 11,
    color: Colors.neutral[500],
    marginBottom: 2,
  },
  diagValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutral[800],
    fontVariant: ['tabular-nums'],
  },
  tableList: {
    borderTopWidth: 1,
    borderColor: Colors.neutral[100],
    paddingTop: 8,
    gap: 4,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  tableRowSelected: {
    backgroundColor: Colors.primary[50],
  },
  tableName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[800],
  },
  countBadge: {
    backgroundColor: Colors.neutral[100],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutral[700],
    fontVariant: ['tabular-nums'],
  },
  inspectorContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.neutral[200],
  },
  inspectorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.neutral[700],
    marginBottom: 6,
  },
  jsonBlock: {
    backgroundColor: Colors.neutral[900],
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  jsonText: {
    fontSize: 10,
    color: '#34D399',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  noDataText: {
    fontSize: 12,
    color: Colors.neutral[400],
    fontStyle: 'italic',
  },
  cleanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.status.dangerBorder,
  },
  cleanWarningText: {
    fontSize: 13,
    color: Colors.neutral[600],
    marginBottom: 14,
    lineHeight: 18,
  },
  cleanActionsList: {
    gap: 8,
  },
  cleanBtn: {
    borderColor: Colors.neutral[300],
  },
});
