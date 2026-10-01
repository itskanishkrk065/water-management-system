import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { ListItem } from '../../../src/components/ListItem';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { useToast } from '../../../src/components/Toast';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { BeneficiaryRepository } from '../../../src/repositories/BeneficiaryRepository';
import { LandRepository } from '../../../src/repositories/LandRepository';
import { WaterRepository } from '../../../src/repositories/WaterRepository';
import { Beneficiary, LandHolding, RateTariff } from '../../../src/types/domain';
import { calculateWaterQuota } from '../../../src/services/calculationService';
import { Feather } from '../../../src/components/Icon';

const beneficiaryRepo = new BeneficiaryRepository();
const landRepo = new LandRepository();
const waterRepo = new WaterRepository();

export default function NewWaterApplicationScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { beneficiaryId } = useLocalSearchParams<{ beneficiaryId?: string }>();

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedBen, setSelectedBen] = useState<Beneficiary | null>(null);
  const [showBenPicker, setShowBenPicker] = useState(false);

  const [holdings, setHoldings] = useState<LandHolding[]>([]);
  const [selectedHoldingId, setSelectedHoldingId] = useState('');
  const [tariff, setTariff] = useState<RateTariff | null>(null);

  const [requiredLitres, setRequiredLitres] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const bens = await beneficiaryRepo.getAll();
      setBeneficiaries(bens);

      const defaultTariff = await waterRepo.getActiveTariff('prj-csii');
      setTariff(defaultTariff);

      if (beneficiaryId) {
        const matching = bens.find((b) => b.beneficiary_id === beneficiaryId);
        if (matching) setSelectedBen(matching);
      } else if (bens.length > 0) {
        setSelectedBen(bens[0]);
      }
    }
    loadData();
  }, [beneficiaryId]);

  useEffect(() => {
    async function loadHoldings() {
      if (!selectedBen) return;
      const hList = await landRepo.getByBeneficiaryId(selectedBen.beneficiary_id);
      setHoldings(hList);

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
  }, [selectedBen, tariff]);

  const selectedHolding = holdings.find((h) => h.holding_id === selectedHoldingId);
  const calculatedAllocation =
    selectedHolding && tariff
      ? calculateWaterQuota(tariff.litres_per_acre, selectedHolding.declared_total_area)
      : 0;

  const handleSubmit = async () => {
    if (!selectedBen) {
      showToast({ message: 'Please select a beneficiary', type: 'warning' });
      return;
    }
    if (!selectedHoldingId) {
      showToast({ message: 'Please select an eligible land holding', type: 'warning' });
      return;
    }
    if (!requiredLitres || parseFloat(requiredLitres) <= 0) {
      showToast({ message: 'Please enter required water quantity', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await waterRepo.createApplication({
        beneficiary_id: selectedBen.beneficiary_id,
        holding_id: selectedHoldingId,
        project_id: selectedHolding?.project_id || 'prj-csii',
        required_litres: parseFloat(requiredLitres),
        remarks: remarks || undefined,
      });

      showToast({ message: '✓ Water application recorded and queued for sync', type: 'success' });
      router.replace('/(app)/water');
    } catch (err: any) {
      showToast({ message: err.message || 'Submission failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header title="New Water Application" subtitle="Quota requirement submission" showBack />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Step 1: Beneficiary Selector */}
        <View style={styles.card}>
          <Text style={styles.sectionHeaderTitle}>1. Target Beneficiary</Text>
          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setShowBenPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.selectorLeft}>
              <Feather name="user" size={16} color={colors.primary} />
              <View>
                <Text style={styles.selectorTitle}>{selectedBen?.name || 'Select Beneficiary'}</Text>
                <Text style={styles.selectorSub}>
                  {selectedBen?.phone_number || 'Tap to choose farmer'}
                </Text>
              </View>
            </View>
            <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Step 2: Eligible Land Holding Selector */}
        <View style={styles.card}>
          <Text style={styles.sectionHeaderTitle}>2. Select Eligible Land Holding</Text>
          <Text style={styles.sectionSubtitle}>
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
                  activeOpacity={0.7}
                >
                  <View style={styles.holdingTop}>
                    <View style={styles.holdingLeft}>
                      <Feather
                        name={isLocked ? 'lock' : isSelected ? 'check-circle' : 'layers'}
                        size={16}
                        color={isLocked ? colors.warning : isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text style={[styles.holdingName, isLocked && styles.holdingNameLocked]}>
                        Holding #{idx + 1} ({h.declared_total_area.toFixed(2)} Acres)
                      </Text>
                    </View>

                    <StatusBadge
                      status={isLocked ? 'ACTIVE' : 'DRAFT'}
                      label={isLocked ? '🔒 Allotted' : '✓ Available'}
                      size="sm"
                    />
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

        {/* Step 3: Quota Calculation & Required Litres Entry */}
        {selectedHolding && (
          <View style={styles.card}>
            <Text style={styles.sectionHeaderTitle}>3. Water Quota & Calculation</Text>

            <View style={styles.calcCard}>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Land Area:</Text>
                <Text style={styles.calcValue}>{selectedHolding.declared_total_area.toFixed(2)} Acres</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Tariff Rate:</Text>
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
              icon={<Feather name="droplet" size={16} color={colors.primary} />}
            />

            <Input
              label="Remarks / Irrigation Justification"
              placeholder="e.g. Drip irrigation for organic coconut grove"
              value={remarks}
              onChangeText={setRemarks}
            />

            <Button
              title="Submit Water Application"
              onPress={handleSubmit}
              loading={submitting}
              size="lg"
              fullWidth
              style={{ marginTop: 8 }}
            />
          </View>
        )}
      </ScrollView>

      {/* Beneficiary Picker Bottom Sheet */}
      <BottomSheet
        visible={showBenPicker}
        onClose={() => setShowBenPicker(false)}
        title="Select Beneficiary"
        subtitle="Directory farmers"
      >
        {beneficiaries.map((b) => (
          <ListItem
            key={b.beneficiary_id}
            title={b.name}
            subtitle={`${b.phone_number} • ${b.village_name || 'Village'}`}
            avatarName={b.name}
            onPress={() => {
              setSelectedBen(b);
              setShowBenPicker(false);
            }}
          />
        ))}
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
  sectionHeaderTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  selectorTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  selectorSub: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    marginTop: 1,
  },
  emptyHoldings: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyHoldingsText: {
    fontSize: typography.fontSize.caption,
    color: colors.textMuted,
  },
  holdingSelectCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  holdingCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  holdingCardLocked: {
    opacity: 0.6,
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
    gap: spacing.sm,
  },
  holdingName: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  holdingNameLocked: {
    color: colors.textSecondary,
  },
  parcelsBreakdown: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    marginLeft: 24,
  },
  calcCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calcLabel: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  calcValue: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  calcRowTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryBorder,
    paddingTop: 8,
    marginTop: 4,
  },
  calcLabelTotal: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '700',
    color: colors.primary,
  },
  calcValueTotal: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '800',
    color: colors.primary,
  },
});
