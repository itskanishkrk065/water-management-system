import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { Colors } from '../../../src/constants/colors';
import { WaterRepository } from '../../../src/repositories/WaterRepository';
import { WaterApplication } from '../../../src/types/domain';
import { Droplets, User, Calendar, Plus, ChevronRight, CheckCircle2 } from 'lucide-react-native';

const waterRepo = new WaterRepository();

export default function WaterApplicationsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [applications, setApplications] = useState<WaterApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadApplications = async (tab: 'ACTIVE' | 'HISTORY' = activeTab) => {
    try {
      let data: WaterApplication[] = [];
      if (tab === 'ACTIVE') {
        data = await waterRepo.getActiveApplications();
      } else {
        data = await waterRepo.getHistoricalApplications();
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
      loadApplications(activeTab);
    }, [activeTab])
  );

  const handleTabChange = (tab: 'ACTIVE' | 'HISTORY') => {
    setActiveTab(tab);
    setLoading(true);
    loadApplications(tab);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Water Applications"
        subtitle={`${activeTab === 'ACTIVE' ? 'Operational' : 'Archived'} records`}
        rightAction={
          <Button
            title="+ Apply"
            size="small"
            variant="primary"
            onPress={() => router.push('/(app)/water/new')}
          />
        }
      />

      {/* Tabs for Active vs History */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ACTIVE' && styles.activeTab]}
          onPress={() => handleTabChange('ACTIVE')}
        >
          <Text style={[styles.tabText, activeTab === 'ACTIVE' && styles.activeTabText]}>
            Active Applications
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'HISTORY' && styles.activeTab]}
          onPress={() => handleTabChange('HISTORY')}
        >
          <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.activeTabText]}>
            History & Closed
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={applications}
        keyExtractor={(item) => item.application_id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadApplications(activeTab)} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => router.push(`/(app)/beneficiaries/${item.beneficiary_id}`)}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.appId}>App #{item.application_id}</Text>
                <View style={styles.userRow}>
                  <User size={13} color={Colors.neutral[500]} />
                  <Text style={styles.beneficiaryName}>{item.beneficiary_name}</Text>
                </View>
              </View>
              <StatusBadge status={item.status} size="small" />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Required Water</Text>
                <Text style={styles.statValue}>{item.required_litres.toLocaleString()} L</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Calculated Quota</Text>
                <Text style={styles.statValue}>{item.calculated_litres.toLocaleString()} L</Text>
              </View>
            </View>

            {item.remarks && (
              <Text style={styles.remarksText} numberOfLines={2}>
                Remarks: {item.remarks}
              </Text>
            )}

            <View style={styles.cardFooter}>
              <View style={styles.dateRow}>
                <Calendar size={12} color={Colors.neutral[400]} />
                <Text style={styles.dateText}>
                  {new Date(item.application_date).toLocaleDateString()}
                </Text>
              </View>
              <ChevronRight size={16} color={Colors.neutral[400]} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Droplets size={32} color={Colors.accent.emerald} />}
              title={activeTab === 'ACTIVE' ? 'No Active Applications' : 'No Historical Records'}
              description={
                activeTab === 'ACTIVE'
                  ? 'There are no active water applications in progress on this device.'
                  : 'There are no rejected, cancelled or voided water applications.'
              }
              actionTitle={activeTab === 'ACTIVE' ? '+ Create Application' : undefined}
              onAction={activeTab === 'ACTIVE' ? () => router.push('/(app)/water/new') : undefined}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
  },
  activeTab: {
    backgroundColor: Colors.primary[50],
    borderWidth: 1,
    borderColor: Colors.primary[300],
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[600],
  },
  activeTabText: {
    color: Colors.primary[700],
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  appId: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  beneficiaryName: {
    fontSize: 13,
    color: Colors.neutral[600],
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral[50],
    padding: 10,
    borderRadius: 8,
    gap: 12,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.neutral[500],
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral[800],
    fontVariant: ['tabular-nums'],
  },
  remarksText: {
    fontSize: 12,
    color: Colors.neutral[500],
    fontStyle: 'italic',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: Colors.neutral[100],
    paddingTop: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: Colors.neutral[400],
  },
});
