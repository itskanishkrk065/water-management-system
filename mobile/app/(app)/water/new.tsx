import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { Colors } from '../../../src/constants/colors';
import { BeneficiaryRepository } from '../../../src/repositories/BeneficiaryRepository';
import { LandRepository } from '../../../src/repositories/LandRepository';
import { WaterRepository } from '../../../src/repositories/WaterRepository';
import { Beneficiary, LandHolding, RateTariff } from '../../../src/types/domain';
import { calculateWaterQuota } from '../../../src/services/calculationService';
import {
  ArrowLeft,
  User,
  Layers,
  Droplets,
  Lock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';

const beneficiaryRepo = new BeneficiaryRepository();
const landRepo = new LandRepository();
const waterRepo = new WaterRepository();

export default function NewWaterApplicationScreen() {
  const router = useRouter();
  const { beneficiaryId } = useLocalSearchParams<{ beneficiaryId?: string }>();

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState(beneficiaryId || '');
  const [holdings, setHoldings] = useState<LandHolding[]>([]);
  const [selectedHoldingId, setSelectedHoldingId] = useState('');
  const [tariff, setTariff] = useState<RateTariff | null>(null);

  const [requiredLitres, setRequiredLitres] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load beneficiaries
  useEffect(() => {
    async function loadData() {
      const bens = await beneficiaryRepo.getAll();
      setBeneficiaries(bens);

      const defaultTariff = await waterRepo.getActiveTariff('prj-csii');
      setTariff(defaultTariff);

      if (beneficiaryId) {
        setSelectedBeneficiaryId(beneficiaryId);
      } else if (bens.length > 0) {
        setSelectedBeneficiaryId(bens[0].beneficiary_id);
      }
    }
    loadData();
  }, [beneficiaryId]);

  // Load holdings for selected beneficiary
  useEffect(() => {
    async function loadHoldings() {
      if (!selectedBeneficiaryId) return;
      const hList = await landRepo.getByBeneficiaryId(selectedBeneficiaryId);
      setHoldings(hList);

      // Auto-select first eligible holding
      const firstEligible = hList.find((h) => !h.has_active_allotment && h.status === 'ACTIVE');
      if (firstEligible) {
        setSelectedHoldingId(firstEligible.holding_id);
        const quota = tariff
          ? calculateWaterQuota(tariff.litres_per_acre, firstEligible.declared_total_area)
          : firstEligible.declared_total_area * 5000;
        setRequiredLitres(String(quota));
      } else {
        setSelectedHoldingId('');
        setRequiredLitres('');
      }
    }
    loadHoldings();
  }, [selectedBeneficiaryId, tariff]);

  const selectedHolding = holdings.find((h) => h.holding_id === selectedHoldingId);
  const calculatedAllocation =
    selectedHolding && tariff
      ? calculateWaterQuota(tariff.litres_per_acre, selectedHolding.declared_total_area)
      : 0;

  const handleSubmit = async () => {
    if (!selectedBeneficiaryId) {
      Alert.alert('Selection Error', 'Please select a beneficiary.');
      return;
    }
    if (!selectedHoldingId) {
      Alert.alert('Selection Error', 'Please select an eligible land holding.');
      return;
    }
    if (!requiredLitres || parseFloat(requiredLitres) <= 0) {
      Alert.alert('Input Error', 'Please enter required litres.');
      return;
    }

    setSubmitting(true);
    try {
      await waterRepo.createApplication({
        beneficiary_id: selectedBeneficiaryId,
        holding_id: selectedHoldingId,
        project_id: selectedHolding?.project_id || 'prj-csii',
        required_litres: parseFloat(requiredLitres),
        remarks: remarks || undefined,
      });

      Alert.alert('Application Submitted', 'Water application saved to device and queued for sync.', [
        {
          text: 'View Applications',
          onPress: () => router.replace('/(app)/water'),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Failed to Submit', err.message || 'Error creating water application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={Colors.neutral[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Water Application</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Step 1: Beneficiary Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>1. Select Beneficiary</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillList}>
            {beneficiaries.map((b) => {
              const isSelected = b.beneficiary_id === selectedBeneficiaryId;
              return (
                <TouchableOpacity
                  key={b.beneficiary_id}
                  style={[styles.benPill, isSelected && styles.benPillSelected]}
                  onPress={() => setSelectedBeneficiaryId(b.beneficiary_id)}
                >
                  <Text style={[styles.benPillText, isSelected && styles.benPillTextSelected]}>
                    {b.name} ({b.phone_number.slice(-4)})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Step 2: Eligible Land Holdings Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>2. Select Eligible Land Holding</Text>
          <Text style={styles.sectionSubtext}>
            Holdings with active approved allotments are locked and ineligible for reapplication.
          </Text>

          {holdings.length === 0 ? (
            <View style={styles.emptyHoldings}>
              <Text style={styles.emptyHoldingsText}>
                No land holdings registered for this beneficiary.
              </Text>
            </View>
          ) : (
            holdings.map((h, idx) => {
              const isLocked = h.has_active_allotment;
              const isSelected = h.holding_id === selectedHoldingId;

              return (
                <TouchableOpacity
                  key={h.holding_id}
                  disabled={isLocked}
                  style={[
                    styles.holdingSelectCard,
                    isSelected && styles.holdingCardSelected,
                    isLocked && styles.holdingCardLocked,
                  ]}
                  onPress={() => {
                    setSelectedHoldingId(h.holding_id);
                    if (tariff) {
                      const quota = calculateWaterQuota(
                        tariff.litres_per_acre,
                        h.declared_total_area
                      );
                      setRequiredLitres(String(quota));
                    }
                  }}
                >
                  <View style={styles.holdingTop}>
                    <View style={styles.holdingLeft}>
                      {isLocked ? (
                        <Lock size={16} color={Colors.accent.amber} />
                      ) : isSelected ? (
                        <CheckCircle2 size={16} color={Colors.primary[600]} />
                      ) : (
                        <Layers size={16} color={Colors.neutral[400]} />
                      )}
                      <Text style={[styles.holdingName, isLocked && styles.holdingNameLocked]}>
                        Holding #{idx + 1} ({h.declared_total_area.toFixed(2)} Acres)
                      </Text>
                    </View>

                    {isLocked ? (
                      <View style={styles.lockedTag}>
                        <Text style={styles.lockedTagText}>🔒 Already Allotted</Text>
                      </View>
                    ) : (
                      <View style={styles.availableTag}>
                        <Text style={styles.availableTagText}>✓ Available</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.parcelsBreakdown}>
                    Parcels:{' '}
                    {h.parcels?.map((p) => `${p.survey_number}/${p.subdivision_number}`).join(', ') ||
                      'None'}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Step 3: Calculation & Litres Entry */}
        {selectedHolding && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>3. Water Quota & Calculation</Text>

            <View style={styles.calcCard}>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Land Area:</Text>
                <Text style={styles.calcValue}>
                  {selectedHolding.declared_total_area.toFixed(2)} Acres
                </Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Applicable Tariff Rate:</Text>
                <Text style={styles.calcValue}>
                  {tariff?.litres_per_acre.toLocaleString() || '5,000'} L / Acre
                </Text>
              </View>
              <View style={[styles.calcRow, styles.calcRowTotal]}>
                <Text style={styles.calcLabelTotal}>Calculated Quota:</Text>
                <Text style={styles.calcValueTotal}>
                  {calculatedAllocation.toLocaleString()} Litres
                </Text>
              </View>
            </View>

            <Input
              label="Required Litres"
              placeholder="e.g. 25000"
              keyboardType="number-pad"
              value={requiredLitres}
              onChangeText={setRequiredLitres}
              required
              leftIcon={<Droplets size={18} color={Colors.accent.emerald} />}
            />

            <Input
              label="Remarks / Justification"
              placeholder="e.g. Drip irrigation for organic orchard"
              value={remarks}
              onChangeText={setRemarks}
            />

            <Button
              title="Submit Water Application"
              onPress={handleSubmit}
              loading={submitting}
              size="large"
              style={styles.submitBtn}
            />
          </View>
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
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  sectionSubtext: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginBottom: 12,
  },
  pillList: {
    flexDirection: 'row',
    marginTop: 8,
  },
  benPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.neutral[100],
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  benPillSelected: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[600],
  },
  benPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  benPillTextSelected: {
    color: '#FFFFFF',
  },
  emptyHoldings: {
    padding: 16,
    alignItems: 'center',
  },
  emptyHoldingsText: {
    fontSize: 13,
    color: Colors.neutral[400],
  },
  holdingSelectCard: {
    backgroundColor: Colors.neutral[50],
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
  },
  holdingCardSelected: {
    borderColor: Colors.primary[600],
    backgroundColor: Colors.primary[50] + '40',
  },
  holdingCardLocked: {
    opacity: 0.6,
    backgroundColor: Colors.neutral[100],
  },
  holdingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  holdingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  holdingName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  holdingNameLocked: {
    color: Colors.neutral[500],
  },
  lockedTag: {
    backgroundColor: Colors.accent.amber + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lockedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent.amber,
  },
  availableTag: {
    backgroundColor: Colors.status.successBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  availableTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.status.successText,
  },
  parcelsBreakdown: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginLeft: 24,
  },
  calcCard: {
    backgroundColor: Colors.primary[50],
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calcLabel: {
    fontSize: 13,
    color: Colors.neutral[600],
  },
  calcValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[800],
    fontVariant: ['tabular-nums'],
  },
  calcRowTotal: {
    borderTopWidth: 1,
    borderColor: Colors.primary[200],
    paddingTop: 6,
    marginTop: 4,
  },
  calcLabelTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary[900],
  },
  calcValueTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary[700],
    fontVariant: ['tabular-nums'],
  },
  submitBtn: {
    marginTop: 8,
  },
});
