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
import { useRouter } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { ListItem } from '../../../src/components/ListItem';
import { useToast } from '../../../src/components/Toast';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { BeneficiaryRepository } from '../../../src/repositories/BeneficiaryRepository';
import { ExtensionRepository } from '../../../src/repositories/ExtensionRepository';
import { WaterRepository } from '../../../src/repositories/WaterRepository';
import { Beneficiary, RateTariff } from '../../../src/types/domain';
import { Feather } from '../../../src/components/Icon';

const beneficiaryRepo = new BeneficiaryRepository();
const extRepo = new ExtensionRepository();
const waterRepo = new WaterRepository();

export default function NewExtensionScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selectedBen, setSelectedBen] = useState<Beneficiary | null>(null);
  const [showBenPicker, setShowBenPicker] = useState(false);
  const [tariff, setTariff] = useState<RateTariff | null>(null);

  const [additionalArea, setAdditionalArea] = useState('2.00');
  const [additionalLitres, setAdditionalLitres] = useState('10000');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const bens = await beneficiaryRepo.getAll();
      const eligibleBens = bens.filter((b) => (b.allotments_count || 0) > 0);
      const list = eligibleBens.length > 0 ? eligibleBens : bens;
      setBeneficiaries(list);
      if (list.length > 0) {
        setSelectedBen(list[0]);
      }

      const t = await waterRepo.getActiveTariff('prj-csii');
      setTariff(t);
    }
    loadData();
  }, []);

  const devRate = tariff?.development_cost_per_litre || 12.50;
  const estimatedCost = Math.round((parseFloat(additionalLitres) || 0) * devRate * 100) / 100;

  const handleSubmit = async () => {
    if (!selectedBen) {
      showToast({ message: 'Please select a beneficiary', type: 'warning' });
      return;
    }
    if (!additionalArea || !additionalLitres) {
      showToast({ message: 'Please enter additional area and litres', type: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await extRepo.createRequest({
        beneficiary_id: selectedBen.beneficiary_id,
        original_allotment_id: 'alt-101',
        requested_additional_area: parseFloat(additionalArea),
        requested_additional_litres: parseFloat(additionalLitres),
        remarks: remarks || undefined,
      });

      showToast({ message: '✓ Water extension request queued for review', type: 'success' });
      router.replace('/(app)/extensions');
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to submit request', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header title="New Extension Request" subtitle="Quota and acreage expansion" showBack />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Beneficiary Selector */}
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
                  {selectedBen?.phone_number || 'Tap to choose farmer with active allotment'}
                </Text>
              </View>
            </View>
            <Feather name="chevron-down" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Extension Parameters */}
        <View style={styles.card}>
          <Text style={styles.sectionHeaderTitle}>2. Expansion Parameters</Text>

          <Input
            label="Additional Land Area (Acres)"
            placeholder="e.g. 2.00"
            keyboardType="decimal-pad"
            value={additionalArea}
            onChangeText={(val) => {
              setAdditionalArea(val);
              const calculatedLitres = (parseFloat(val) || 0) * (tariff?.litres_per_acre || 5000);
              setAdditionalLitres(String(calculatedLitres));
            }}
          />

          <Input
            label="Additional Water Demand (Litres)"
            placeholder="e.g. 10000"
            keyboardType="number-pad"
            value={additionalLitres}
            onChangeText={setAdditionalLitres}
            icon={<Feather name="droplet" size={16} color={colors.primary} />}
          />

          {/* Cost Estimation Summary */}
          <View style={styles.calcCard}>
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Development Rate Snapshot:</Text>
              <Text style={styles.calcVal}>₹{devRate.toFixed(2)} / Litre</Text>
            </View>
            <View style={[styles.calcRow, styles.calcRowTotal]}>
              <Text style={styles.calcLabelTotal}>Estimated Extension Cost:</Text>
              <Text style={styles.calcValTotal}>₹{estimatedCost.toLocaleString()}</Text>
            </View>
          </View>

          <Input
            label="Justification / Engineering Remarks"
            placeholder="e.g. North parcel boundary expansion"
            value={remarks}
            onChangeText={setRemarks}
          />

          <Button
            title="Submit Extension Request"
            loading={submitting}
            onPress={handleSubmit}
            size="lg"
            fullWidth
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>

      {/* Beneficiary Picker Bottom Sheet */}
      <BottomSheet
        visible={showBenPicker}
        onClose={() => setShowBenPicker(false)}
        title="Select Beneficiary"
        subtitle="Farmers with active water allotments"
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
  calcVal: {
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
  calcValTotal: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '800',
    color: colors.primary,
  },
});
