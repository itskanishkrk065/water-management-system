import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { Input } from '../../../src/components/Input';
import { ListItem } from '../../../src/components/ListItem';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { EmptyState } from '../../../src/components/EmptyState';
import { ListSkeleton } from '../../../src/components/Skeleton';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { Button } from '../../../src/components/Button';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { BeneficiaryRepository } from '../../../src/repositories/BeneficiaryRepository';
import { Beneficiary } from '../../../src/types/domain';
import { Feather } from '../../../src/components/Icon';

const beneficiaryRepo = new BeneficiaryRepository();

export default function BeneficiariesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter bottom sheet state
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  const loadData = async (query: string = searchQuery) => {
    try {
      let data = await beneficiaryRepo.search(query);
      if (selectedStatusFilter !== 'ALL') {
        data = data.filter((b) => (b.sync_status || 'LOCAL_ONLY') === selectedStatusFilter);
      }
      setBeneficiaries(data);
    } catch (err) {
      console.error('Error loading beneficiaries:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(searchQuery);
    }, [searchQuery, selectedStatusFilter])
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    loadData(text);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(searchQuery);
  };

  const statusFilterOptions = [
    { label: 'All Statuses', value: 'ALL' },
    { label: 'Synced', value: 'SYNCED' },
    { label: 'Pending Sync', value: 'PENDING_SYNC' },
    { label: 'Local Only', value: 'LOCAL_ONLY' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="Beneficiary Directory"
        subtitle={`${beneficiaries.length} records available offline`}
        rightAction={{
          icon: 'filter',
          onPress: () => setFilterSheetVisible(true),
          accessibilityLabel: 'Filter beneficiaries',
        }}
      />

      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchBarWrapper}>
          <Input
            placeholder="Search by name, phone, survey #, or app ID..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            onClear={() => handleSearchChange('')}
            showClearButton={!!searchQuery}
            icon={<Feather name="search" size={16} color={colors.textSecondary} />}
            containerStyle={styles.searchInputContainer}
          />
        </View>

        {/* Active Filter Pill */}
        {selectedStatusFilter !== 'ALL' && (
          <View style={styles.activeFilterBar}>
            <Text style={styles.activeFilterLabel}>
              Filter: <Text style={{ fontWeight: '700' }}>{selectedStatusFilter}</Text>
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedStatusFilter('ALL')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x-circle" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Beneficiaries List */}
        {loading ? (
          <ListSkeleton rows={6} />
        ) : (
          <FlatList
            data={beneficiaries}
            keyExtractor={(item) => item.beneficiary_id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
              />
            }
            contentContainerStyle={styles.listContainer}
            renderItem={({ item, index }) => (
              <ListItem
                title={item.name}
                subtitle={`${item.phone_number} • ${item.village_name || 'Village'}, ${item.block_name || 'Panchayat'}`}
                meta={`${item.total_land_acres.toFixed(2)} acres • ${item.holdings_count || 0} holdings • ${item.applications_count || 0} apps`}
                avatarName={item.name}
                rightElement={
                  <StatusBadge
                    status={item.sync_status || 'LOCAL_ONLY'}
                    size="sm"
                  />
                }
                onPress={() => router.push(`/(app)/beneficiaries/${item.beneficiary_id}`)}
                borderBottom={index < beneficiaries.length - 1}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon={<Feather name="users" size={32} color={colors.primary} />}
                title="No Beneficiaries Found"
                description={
                  searchQuery
                    ? `No matching records found for "${searchQuery}". Try a different name, phone, or survey number.`
                    : 'No beneficiaries registered in this offline database yet.'
                }
                actionTitle="+ New Registration"
                onAction={() => router.push('/(app)/new-registration')}
              />
            }
          />
        )}
      </View>

      {/* Filter Bottom Sheet */}
      <BottomSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        title="Filter Beneficiaries"
        subtitle="Filter by synchronization status"
      >
        <View style={styles.filterSheetContent}>
          <Text style={styles.filterSectionTitle}>Sync Status</Text>
          <View style={styles.filterOptionsGrid}>
            {statusFilterOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.filterChip,
                  selectedStatusFilter === opt.value && styles.filterChipActive,
                ]}
                onPress={() => setSelectedStatusFilter(opt.value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedStatusFilter === opt.value && styles.filterChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.filterActionButtons}>
            <Button
              title="Reset Filters"
              variant="secondary"
              onPress={() => {
                setSelectedStatusFilter('ALL');
                setFilterSheetVisible(false);
              }}
              style={{ flex: 1 }}
            />
            <Button
              title="Apply Filters"
              variant="primary"
              onPress={() => setFilterSheetVisible(false)}
              style={{ flex: 1 }}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBarWrapper: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchInputContainer: {
    marginBottom: 0,
  },
  activeFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.primaryBorder,
  },
  activeFilterLabel: {
    fontSize: typography.fontSize.tiny,
    color: colors.primary,
  },
  listContainer: {
    backgroundColor: colors.surface,
    paddingBottom: spacing.xxxl,
  },
  filterSheetContent: {
    paddingBottom: spacing.lg,
  },
  filterSectionTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    fontFamily: typography.fontFamily.bold,
  },
  filterOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  filterChipText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  filterActionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
