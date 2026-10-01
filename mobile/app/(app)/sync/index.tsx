import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { Colors } from '../../../src/constants/colors';
import { SyncRepository } from '../../../src/repositories/SyncRepository';
import { SyncQueueItem, SyncSummary } from '../../../src/types/sync';
import { RefreshCw, CheckCircle2, Clock, AlertTriangle, Play } from 'lucide-react-native';

const syncRepo = new SyncRepository();

export default function SyncScreen() {
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
      Alert.alert(
        'Synchronization Complete',
        `Processed ${result.processed} records. ${result.successCount} local records synced successfully.`
      );
      loadSyncData();
    } catch (err: any) {
      Alert.alert('Sync Error', err.message || 'Failed to complete synchronization.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Pending Sync"
        subtitle={`${summary?.pending || 0} local mutations waiting for upload`}
      />

      {/* Sync Control Banner */}
      <View style={styles.controlBanner}>
        <View style={styles.bannerInfo}>
          <View style={styles.bannerRow}>
            <Text style={styles.bannerCount}>{summary?.pending || 0}</Text>
            <Text style={styles.bannerCountLabel}>Records Pending</Text>
          </View>
          <Text style={styles.bannerSubtext}>
            Offline queue ready for transmission
          </Text>
        </View>

        <Button
          title="Sync Now"
          onPress={handleSyncNow}
          loading={syncing}
          disabled={!summary || summary.pending === 0}
          icon={<RefreshCw size={16} color="#FFFFFF" />}
          size="medium"
          variant="primary"
        />
      </View>

      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadSyncData} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.entityInfo}>
                <Text style={styles.entityType}>{item.entity_type.replace('_', ' ')}</Text>
                <Text style={styles.entityId}>ID: {item.entity_id}</Text>
              </View>
              <StatusBadge status={item.status === 'PENDING' ? 'PENDING_SYNC' : item.status} size="small" />
            </View>

            <Text style={styles.payloadSummary} numberOfLines={2}>
              Payload: {item.payload}
            </Text>

            <View style={styles.cardFooter}>
              <View style={styles.timeRow}>
                <Clock size={12} color={Colors.neutral[400]} />
                <Text style={styles.timeText}>
                  Saved {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Waiting for connection
                </Text>
              </View>

              {item.status === 'FAILED' && (
                <TouchableOpacity
                  onPress={async () => {
                    await syncRepo.retryItem(item.id);
                    loadSyncData();
                  }}
                  style={styles.retryBtn}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<CheckCircle2 size={36} color={Colors.status.successText} />}
            title="All Local Data Synced"
            description="Your device SQLite database is completely up to date with no pending sync queue items."
          />
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
  controlBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  bannerInfo: {
    flex: 1,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  bannerCount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.accent.amber,
    fontVariant: ['tabular-nums'],
  },
  bannerCountLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutral[800],
  },
  bannerSubtext: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: Colors.neutral[50],
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  entityInfo: {
    flex: 1,
  },
  entityType: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  entityId: {
    fontSize: 12,
    color: Colors.neutral[400],
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  payloadSummary: {
    fontSize: 12,
    color: Colors.neutral[600],
    backgroundColor: Colors.neutral[50],
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: Colors.neutral[500],
  },
  retryBtn: {
    backgroundColor: Colors.status.dangerBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  retryText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.status.dangerText,
  },
});
