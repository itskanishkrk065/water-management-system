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
import { Input } from '../../../src/components/Input';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { EmptyState } from '../../../src/components/EmptyState';
import { Colors } from '../../../src/constants/colors';
import { BeneficiaryRepository } from '../../../src/repositories/BeneficiaryRepository';
import { Beneficiary } from '../../../src/types/domain';
import { Search, MapPin, Phone, Layers, ChevronRight, UserPlus } from 'lucide-react-native';

const beneficiaryRepo = new BeneficiaryRepository();

export default function BeneficiariesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (query: string = searchQuery) => {
    try {
      const data = await beneficiaryRepo.search(query);
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
    }, [searchQuery])
  );

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    loadData(text);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(searchQuery);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="Beneficiaries"
        subtitle={`${beneficiaries.length} records in local database`}
      />

      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Input
            label=""
            placeholder="Search by Name, Phone, Survey # or App ID..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            leftIcon={<Search size={18} color={Colors.neutral[400]} />}
            containerStyle={styles.searchInput}
          />
        </View>

        <FlatList
          data={beneficiaries}
          keyExtractor={(item) => item.beneficiary_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(`/(app)/beneficiaries/${item.beneficiary_id}`)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.nameContainer}>
                  <Text style={styles.name}>{item.name}</Text>
                  <View style={styles.phoneRow}>
                    <Phone size={13} color={Colors.neutral[400]} />
                    <Text style={styles.phoneText}>{item.phone_number}</Text>
                  </View>
                </View>
                <StatusBadge status={item.sync_status} size="small" />
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <MapPin size={13} color={Colors.neutral[400]} />
                  <Text style={styles.detailText}>
                    {item.village_name || 'Village'}, {item.block_name || 'Block'}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Layers size={13} color={Colors.primary[600]} />
                  <Text style={styles.landText}>
                    {item.total_land_acres.toFixed(2)} acres ({item.holdings_count || 0} holdings)
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.metaText}>
                  Apps: {item.applications_count || 0} • Allotments: {item.allotments_count || 0}
                </Text>
                <ChevronRight size={16} color={Colors.neutral[400]} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon={<Search size={32} color={Colors.primary[600]} />}
                title="No Beneficiaries Found"
                description={
                  searchQuery
                    ? `No matching records found for "${searchQuery}". Try a different name, phone or survey number.`
                    : 'No beneficiaries registered on this device yet.'
                }
                actionTitle="+ Register Beneficiary"
                onAction={() => router.push('/(app)/new-registration')}
              />
            ) : null
          }
        />
      </View>
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  searchInput: {
    marginBottom: 10,
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
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  phoneText: {
    fontSize: 13,
    color: Colors.neutral[500],
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  detailsRow: {
    flexDirection: 'column',
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.neutral[100],
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: Colors.neutral[600],
  },
  landText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary[700],
    fontVariant: ['tabular-nums'],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  metaText: {
    fontSize: 11,
    color: Colors.neutral[400],
  },
});
