import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';
import { MetricCard } from '../../../src/components/MetricCard';
import { Colors } from '../../../src/constants/colors';
import { BeneficiaryRepository } from '../../../src/repositories/BeneficiaryRepository';
import { WaterRepository } from '../../../src/repositories/WaterRepository';
import { BillingRepository } from '../../../src/repositories/BillingRepository';
import { Beneficiary, WaterApplication, DevelopmentBill } from '../../../src/types/domain';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Layers,
  Droplets,
  CreditCard,
  Plus,
  CheckCircle,
  Clock,
} from 'lucide-react-native';

const beneficiaryRepo = new BeneficiaryRepository();
const waterRepo = new WaterRepository();
const billingRepo = new BillingRepository();

export default function BeneficiaryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [waterApps, setWaterApps] = useState<WaterApplication[]>([]);
  const [bills, setBills] = useState<DevelopmentBill[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!id) return;
    try {
      const ben = await beneficiaryRepo.getById(id);
      const apps = await waterRepo.getByBeneficiaryId(id);
      const devBills = await billingRepo.getByBeneficiaryId(id);

      setBeneficiary(ben);
      setWaterApps(apps);
      setBills(devBills);
    } catch (err) {
      console.error('Error loading beneficiary details:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  if (!beneficiary && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Beneficiary Not Found</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Colors.neutral[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {beneficiary?.name || 'Beneficiary'}
        </Text>
        {beneficiary && <StatusBadge status={beneficiary.sync_status} size="small" />}
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileTop}>
            <View>
              <Text style={styles.profileName}>{beneficiary?.name}</Text>
              <Text style={styles.profileId}>ID: {beneficiary?.beneficiary_id}</Text>
            </View>
          </View>

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Phone size={15} color={Colors.neutral[400]} />
              <Text style={styles.infoText}>{beneficiary?.phone_number}</Text>
            </View>
            {beneficiary?.email && (
              <View style={styles.infoRow}>
                <Mail size={15} color={Colors.neutral[400]} />
                <Text style={styles.infoText}>{beneficiary.email}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <MapPin size={15} color={Colors.neutral[400]} />
              <Text style={styles.infoText}>
                {beneficiary?.address_line1 ? `${beneficiary.address_line1}, ` : ''}
                {beneficiary?.village_name}, {beneficiary?.block_name},{' '}
                {beneficiary?.district_name} - {beneficiary?.pincode}
              </Text>
            </View>
          </View>
        </View>

        {/* Land Holdings Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Layers size={18} color={Colors.primary[600]} />
            <Text style={styles.sectionTitle}>Land Holdings & Survey Parcels</Text>
          </View>
          <Text style={styles.sectionBadge}>
            Total: {beneficiary?.total_land_acres.toFixed(2)} ac
          </Text>
        </View>

        {beneficiary?.land_holdings?.map((holding, idx) => (
          <View key={holding.holding_id} style={styles.holdingCard}>
            <View style={styles.holdingHeader}>
              <View>
                <Text style={styles.holdingTitle}>Holding #{idx + 1}</Text>
                <Text style={styles.holdingArea}>{holding.declared_total_area.toFixed(2)} Acres</Text>
              </View>
              {holding.has_active_allotment ? (
                <View style={styles.lockedPill}>
                  <Text style={styles.lockedText}>🔒 Water Allotted</Text>
                </View>
              ) : (
                <View style={styles.availablePill}>
                  <Text style={styles.availableText}>✓ Available for Water</Text>
                </View>
              )}
            </View>

            {/* Parcels List */}
            <View style={styles.parcelsContainer}>
              <Text style={styles.parcelsLabel}>Survey / Subdivision Breakdown:</Text>
              {holding.parcels?.map((p) => (
                <View key={p.parcel_id} style={styles.parcelRow}>
                  <Text style={styles.parcelCode}>
                    Survey {p.survey_number} / Subdiv {p.subdivision_number}
                  </Text>
                  <Text style={styles.parcelArea}>{p.area.toFixed(2)} ac</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Water Applications Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Droplets size={18} color={Colors.accent.emerald} />
            <Text style={styles.sectionTitle}>Water Applications</Text>
          </View>
          <Button
            title="+ Apply"
            size="small"
            variant="outline"
            onPress={() => router.push({ pathname: '/(app)/water/new', params: { beneficiaryId: beneficiary?.beneficiary_id } })}
          />
        </View>

        {waterApps.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>No water applications created yet.</Text>
          </View>
        ) : (
          waterApps.map((app) => (
            <View key={app.application_id} style={styles.card}>
              <View style={styles.appHeader}>
                <View>
                  <Text style={styles.appId}>App #{app.application_id}</Text>
                  <Text style={styles.appDate}>
                    Applied: {new Date(app.application_date).toLocaleDateString()}
                  </Text>
                </View>
                <StatusBadge status={app.status} size="small" />
              </View>

              <View style={styles.appGrid}>
                <View style={styles.appStat}>
                  <Text style={styles.statLabel}>Required Water</Text>
                  <Text style={styles.statValue}>
                    {app.required_litres.toLocaleString()} L
                  </Text>
                </View>
                <View style={styles.appStat}>
                  <Text style={styles.statLabel}>Calculated Quota</Text>
                  <Text style={styles.statValue}>
                    {app.calculated_litres.toLocaleString()} L
                  </Text>
                </View>
              </View>

              {app.allotment && (
                <View style={styles.allotmentBanner}>
                  <CheckCircle size={14} color={Colors.status.successText} />
                  <Text style={styles.allotmentText}>
                    Approved Allotment: {app.allotment.approved_litres.toLocaleString()} L
                  </Text>
                </View>
              )}
            </View>
          ))
        )}

        {/* Development Bills & 5-Stage Installments */}
        {bills.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <CreditCard size={18} color={Colors.secondary[600]} />
                <Text style={styles.sectionTitle}>Development Bills & Installments</Text>
              </View>
            </View>

            {bills.map((bill) => (
              <View key={bill.bill_id} style={styles.card}>
                <View style={styles.billHeader}>
                  <View>
                    <Text style={styles.billId}>Bill #{bill.bill_id}</Text>
                    <Text style={styles.billAmount}>
                      Total: ₹{bill.total_amount.toLocaleString()}
                    </Text>
                  </View>
                  <StatusBadge status={bill.status} size="small" />
                </View>

                {/* 5-Stage Installment Progress */}
                <View style={styles.installmentsList}>
                  <Text style={styles.installmentHeaderLabel}>
                    5-Stage Installment Distribution (100%):
                  </Text>
                  {bill.installments?.map((inst) => (
                    <View key={inst.installment_id} style={styles.instRow}>
                      <View style={styles.instLeft}>
                        <Text style={styles.instStage}>
                          Stage {inst.installment_number} ({inst.percentage}%):
                        </Text>
                        <Text style={styles.instMilestone}>{inst.milestone_name}</Text>
                      </View>
                      <View style={styles.instRight}>
                        <Text style={styles.instAmount}>₹{inst.amount_due.toLocaleString()}</Text>
                        <StatusBadge status={inst.status} size="small" />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral[900],
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
  profileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.neutral[900],
  },
  profileId: {
    fontSize: 12,
    color: Colors.neutral[400],
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  infoList: {
    gap: 8,
    borderTopWidth: 1,
    borderColor: Colors.neutral[100],
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: Colors.neutral[700],
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral[800],
  },
  sectionBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary[700],
    fontVariant: ['tabular-nums'],
  },
  holdingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  holdingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  holdingArea: {
    fontSize: 13,
    color: Colors.primary[700],
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  lockedPill: {
    backgroundColor: Colors.accent.amber + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  lockedText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent.amber,
  },
  availablePill: {
    backgroundColor: Colors.status.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  availableText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.status.successText,
  },
  parcelsContainer: {
    borderTopWidth: 1,
    borderColor: Colors.neutral[100],
    paddingTop: 8,
    gap: 4,
  },
  parcelsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.neutral[400],
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  parcelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.neutral[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  parcelCode: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[800],
  },
  parcelArea: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[700],
    fontVariant: ['tabular-nums'],
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  emptyCardText: {
    fontSize: 13,
    color: Colors.neutral[400],
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  appId: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  appDate: {
    fontSize: 12,
    color: Colors.neutral[400],
  },
  appGrid: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.neutral[50],
    padding: 10,
    borderRadius: 8,
  },
  appStat: {
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
  allotmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.status.successBg,
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
  },
  allotmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.status.successText,
    fontVariant: ['tabular-nums'],
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  billId: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  billAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.secondary[600],
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  installmentsList: {
    borderTopWidth: 1,
    borderColor: Colors.neutral[100],
    paddingTop: 10,
    gap: 6,
  },
  installmentHeaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.neutral[500],
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  instRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
    padding: 8,
    borderRadius: 6,
  },
  instLeft: {
    flex: 1,
    marginRight: 8,
  },
  instStage: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.neutral[800],
  },
  instMilestone: {
    fontSize: 11,
    color: Colors.neutral[500],
  },
  instRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  instAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.neutral[900],
    fontVariant: ['tabular-nums'],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.status.dangerText,
    marginBottom: 16,
  },
});
