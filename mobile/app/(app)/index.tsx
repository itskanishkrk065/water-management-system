import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../../src/components/Header';
import { MetricCard } from '../../src/components/MetricCard';
import { Button } from '../../src/components/Button';
import { StatusBadge } from '../../src/components/StatusBadge';
import { Colors } from '../../src/constants/colors';
import { BeneficiaryRepository } from '../../src/repositories/BeneficiaryRepository';
import { SyncRepository } from '../../src/repositories/SyncRepository';
import { AuditRepository } from '../../src/repositories/AuditRepository';
import {
  UserPlus,
  Users,
  Layers,
  Droplets,
  RefreshCw,
  Clock,
  ArrowRight,
} from 'lucide-react-native';

const beneficiaryRepo = new BeneficiaryRepository();
const syncRepo = new SyncRepository();
const auditRepo = new AuditRepository();

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    beneficiariesCount: 0,
    landHoldingsCount: 0,
    waterAppsCount: 0,
    pendingSyncCount: 0,
  });
  const [recentRecords, setRecentRecords] = useState<any[]>([]);

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
      });

      setRecentRecords(recentAudits);
    } catch (err) {
      console.error('Error loading dashboard:', err);
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Field Operations"
        pendingCount={stats.pendingSyncCount}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Primary Field Action */}
        <View style={styles.actionCard}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionTitle}>New Field Registration</Text>
            <Text style={styles.actionSubtitle}>
              Continuous 6-step offline onboarding workflow
            </Text>
          </View>
          <Button
            title="+ New Beneficiary"
            onPress={() => router.push('/(app)/new-registration')}
            variant="primary"
            size="large"
            icon={<UserPlus size={18} color="#FFFFFF" />}
          />
        </View>

        {/* Today's Activity Metrics Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Activity</Text>
          <Text style={styles.sectionSubtext}>Local Device Totals</Text>
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.gridRow}>
            <MetricCard
              label="Beneficiaries"
              value={stats.beneficiariesCount}
              accentColor={Colors.primary[600]}
              icon={<Users size={18} color={Colors.primary[600]} />}
              style={styles.gridCard}
            />
            <MetricCard
              label="Land Holdings"
              value={stats.landHoldingsCount}
              accentColor={Colors.secondary[600]}
              icon={<Layers size={18} color={Colors.secondary[600]} />}
              style={styles.gridCard}
            />
          </View>

          <View style={styles.gridRow}>
            <MetricCard
              label="Water Apps"
              value={stats.waterAppsCount}
              accentColor={Colors.accent.emerald}
              icon={<Droplets size={18} color={Colors.accent.emerald} />}
              style={styles.gridCard}
            />
            <MetricCard
              label="Pending Sync"
              value={stats.pendingSyncCount}
              accentColor={Colors.accent.amber}
              icon={<RefreshCw size={18} color={Colors.accent.amber} />}
              style={styles.gridCard}
            />
          </View>
        </View>

        {/* Quick Operations Links */}
        <View style={styles.quickLinksRow}>
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => router.push('/(app)/drafts')}
          >
            <Clock size={16} color={Colors.primary[600]} />
            <Text style={styles.quickLinkText}>My Drafts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => router.push('/(app)/sync')}
          >
            <RefreshCw size={16} color={Colors.accent.amber} />
            <Text style={styles.quickLinkText}>Pending Queue ({stats.pendingSyncCount})</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Records / Local Mutations */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Device Records</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/beneficiaries')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentList}>
          {recentRecords.length === 0 ? (
            <View style={styles.emptyRecent}>
              <Text style={styles.emptyText}>No recent local operations.</Text>
            </View>
          ) : (
            recentRecords.map((item, idx) => (
              <View key={item.audit_id || idx} style={styles.recentItem}>
                <View style={styles.recentLeft}>
                  <Text style={styles.recentTitle}>
                    {item.entity_type.replace('_', ' ')}: {item.entity_id}
                  </Text>
                  <Text style={styles.recentAction}>
                    Action: {item.action} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <StatusBadge status={item.sync_status || 'LOCAL_ONLY'} size="small" />
              </View>
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
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  actionHeader: {
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  actionSubtitle: {
    fontSize: 13,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral[800],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtext: {
    fontSize: 12,
    color: Colors.neutral[400],
  },
  viewAllText: {
    fontSize: 13,
    color: Colors.primary[600],
    fontWeight: '600',
  },
  metricsGrid: {
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  gridCard: {
    flex: 1,
  },
  quickLinksRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    gap: 6,
  },
  quickLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  recentList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    overflow: 'hidden',
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  recentLeft: {
    flex: 1,
    marginRight: 10,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  recentAction: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  emptyRecent: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.neutral[400],
  },
});
