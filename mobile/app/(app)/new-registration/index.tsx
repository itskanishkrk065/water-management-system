import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { Stepper, StepItem } from '../../../src/components/Stepper';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { Colors } from '../../../src/constants/colors';
import { BeneficiaryRepository } from '../../../src/repositories/BeneficiaryRepository';
import { LandRepository } from '../../../src/repositories/LandRepository';
import { WaterRepository } from '../../../src/repositories/WaterRepository';
import { LocationRepository } from '../../../src/repositories/LocationRepository';
import { DraftRepository } from '../../../src/repositories/DraftRepository';
import {
  reconcileHoldingArea,
  checkParcelDuplicateInMemory,
  calculateWaterQuota,
} from '../../../src/services/calculationService';
import { District, Block, Village, ProjectScheme, RateTariff } from '../../../src/types/domain';
import {
  Phone,
  User,
  MapPin,
  Layers,
  Droplets,
  CheckCircle,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react-native';

const beneficiaryRepo = new BeneficiaryRepository();
const landRepo = new LandRepository();
const waterRepo = new WaterRepository();
const locationRepo = new LocationRepository();
const draftRepo = new DraftRepository();

const STEPS: StepItem[] = [
  { title: 'Phone Lookup' },
  { title: 'Personal Info' },
  { title: 'Location' },
  { title: 'Land & Parcels' },
  { title: 'Water Quota' },
  { title: 'Review & Save' },
];

interface ParcelFormState {
  surveyNumber: string;
  subdivisionNumber: string;
  area: string;
  error?: string;
}

interface HoldingFormState {
  declaredArea: string;
  parcels: ParcelFormState[];
}

export default function NewRegistrationScreen() {
  const router = useRouter();

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Master data
  const [districts, setDistricts] = useState<District[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [projects, setProjects] = useState<ProjectScheme[]>([]);
  const [activeTariff, setActiveTariff] = useState<RateTariff | null>(null);

  // Step 1: Phone
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Step 2: Personal
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address1, setAddress1] = useState('');
  const [pincode, setPincode] = useState('642104');

  // Step 3: Location
  const [selectedDistrict, setSelectedDistrict] = useState('dist-cbe');
  const [selectedBlock, setSelectedBlock] = useState('blk-pol-s');
  const [selectedVillage, setSelectedVillage] = useState('vil-anm');
  const [selectedProject, setSelectedProject] = useState('prj-csii');

  // Step 4: Land & Survey Parcels
  const [holdings, setHoldings] = useState<HoldingFormState[]>([
    {
      declaredArea: '5.00',
      parcels: [
        { surveyNumber: '101', subdivisionNumber: '1A', area: '2.50' },
        { surveyNumber: '101', subdivisionNumber: '1B', area: '2.50' },
      ],
    },
  ]);

  // Step 5: Water Requirement
  const [waterRequiredLitres, setWaterRequiredLitres] = useState('25000');

  // Load locations and project schemes
  useEffect(() => {
    async function loadMasterData() {
      try {
        const dists = await locationRepo.getDistricts();
        setDistricts(dists);

        const blks = await locationRepo.getBlocksByDistrict('dist-cbe');
        setBlocks(blks);

        const vils = await locationRepo.getVillagesByBlock('blk-pol-s');
        setVillages(vils);

        const projs = await locationRepo.getProjects();
        setProjects(projs);

        if (projs.length > 0) {
          const tariff = await waterRepo.getActiveTariff(projs[0].project_id);
          setActiveTariff(tariff);
        }
      } catch (err) {
        console.error('Error loading master data:', err);
      }
    }
    loadMasterData();
  }, []);

  // Progressive Draft Saving Helper
  const persistCurrentDraft = async (stepNum: number) => {
    if (!phoneNumber) return;
    try {
      await draftRepo.saveDraft({
        phone_number: phoneNumber,
        step: stepNum,
        name,
        email,
        address_line1: address1,
        district_id: selectedDistrict,
        block_id: selectedBlock,
        village_id: selectedVillage,
        pincode,
        holdings_json: JSON.stringify(holdings),
        water_required_litres: Number(waterRequiredLitres) || 0,
        project_id: selectedProject,
      });
    } catch (err) {
      console.error('Error auto-saving draft:', err);
    }
  };

  // Step 1: Phone validation and check
  const handlePhoneLookup = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setPhoneError('Please enter a valid 10-digit mobile number');
      return;
    }
    setPhoneError('');

    // Check if beneficiary already exists
    const existing = await beneficiaryRepo.findByPhone(phoneNumber);
    if (existing) {
      Alert.alert(
        'Beneficiary Found',
        `A beneficiary named "${existing.name}" is already registered with this phone number.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Beneficiary',
            onPress: () => router.push(`/(app)/beneficiaries/${existing.beneficiary_id}`),
          },
        ]
      );
      return;
    }

    // Check if draft exists
    const draft = await draftRepo.findByPhone(phoneNumber);
    if (draft) {
      setName(draft.name || '');
      setEmail(draft.email || '');
      setAddress1(draft.address_line1 || '');
      setPincode(draft.pincode || '642104');
      if (draft.holdings_json) {
        try {
          setHoldings(JSON.parse(draft.holdings_json));
        } catch (_) {}
      }
      if (draft.water_required_litres) {
        setWaterRequiredLitres(String(draft.water_required_litres));
      }
    }

    await persistCurrentDraft(2);
    setCurrentStep(2);
  };

  // Total declared acres across all holdings
  const totalLandAcres = holdings.reduce(
    (sum, h) => sum + (parseFloat(h.declaredArea) || 0),
    0
  );

  // Quota calculation
  const calculatedQuota = activeTariff
    ? calculateWaterQuota(activeTariff.litres_per_acre, totalLandAcres)
    : totalLandAcres * 5000;

  // Real-time parcel modification with immediate composite uniqueness check
  const handleParcelChange = (
    holdingIdx: number,
    parcelIdx: number,
    field: 'surveyNumber' | 'subdivisionNumber' | 'area',
    value: string
  ) => {
    const updatedHoldings = [...holdings];
    const holding = updatedHoldings[holdingIdx];
    const parcel = { ...holding.parcels[parcelIdx], [field]: value };

    // Check duplicate survey + subdivision combination
    const isDuplicate = checkParcelDuplicateInMemory(
      holding.parcels.map((p, idx) => {
        const item = idx === parcelIdx ? parcel : p;
        return { survey_number: item.surveyNumber, subdivision_number: item.subdivisionNumber };
      }),
      parcel.surveyNumber,
      parcel.subdivisionNumber,
      parcelIdx
    );

    if (isDuplicate && parcel.surveyNumber && parcel.subdivisionNumber) {
      parcel.error = `Duplicate parcel: ${parcel.surveyNumber}/${parcel.subdivisionNumber} already exists in this holding!`;
    } else {
      parcel.error = undefined;
    }

    holding.parcels[parcelIdx] = parcel;
    setHoldings(updatedHoldings);
  };

  const addParcel = (holdingIdx: number) => {
    const updated = [...holdings];
    updated[holdingIdx].parcels.push({
      surveyNumber: '',
      subdivisionNumber: '',
      area: '',
    });
    setHoldings(updated);
  };

  const removeParcel = (holdingIdx: number, parcelIdx: number) => {
    const updated = [...holdings];
    if (updated[holdingIdx].parcels.length <= 1) {
      Alert.alert('Holdings must contain at least 1 parcel');
      return;
    }
    updated[holdingIdx].parcels.splice(parcelIdx, 1);
    setHoldings(updated);
  };

  const addHolding = () => {
    setHoldings([
      ...holdings,
      {
        declaredArea: '1.00',
        parcels: [{ surveyNumber: '', subdivisionNumber: '', area: '1.00' }],
      },
    ]);
  };

  // Step 4 Validation
  const validateLandAndParcels = () => {
    for (let hIdx = 0; hIdx < holdings.length; hIdx++) {
      const h = holdings[hIdx];
      const declared = parseFloat(h.declaredArea) || 0;
      if (declared <= 0) {
        Alert.alert('Validation Error', `Holding #${hIdx + 1} declared area must be greater than 0.`);
        return false;
      }

      // Check errors on parcels
      for (const p of h.parcels) {
        if (!p.surveyNumber.trim() || !p.subdivisionNumber.trim()) {
          Alert.alert(
            'Validation Error',
            `Every parcel must have both a Survey Number and Subdivision Number.`
          );
          return false;
        }
        if (p.error) {
          Alert.alert('Duplicate Parcel', p.error);
          return false;
        }
      }

      // Check reconciliation
      const recon = reconcileHoldingArea(
        declared,
        h.parcels.map((p) => parseFloat(p.area) || 0)
      );
      if (!recon.isMatch) {
        Alert.alert(
          'Area Mismatch',
          `Holding #${hIdx + 1}: Declared area (${declared} ac) must exactly match the sum of parcels (${recon.parcelTotal} ac).`
        );
        return false;
      }
    }
    return true;
  };

  // Final Submit & Atomic Save
  const handleFinalSave = async () => {
    setSaving(true);
    try {
      // 1. Create Beneficiary
      const newBeneficiary = await beneficiaryRepo.create({
        name,
        phone_number: phoneNumber,
        email: email || undefined,
        address_line1: address1 || undefined,
        district_id: selectedDistrict,
        block_id: selectedBlock,
        village_id: selectedVillage,
        pincode,
        total_land_acres: totalLandAcres,
      });

      // 2. Create Land Holdings & Parcels
      let firstHoldingId = '';
      for (const h of holdings) {
        const createdHolding = await landRepo.createHolding({
          beneficiary_id: newBeneficiary.beneficiary_id,
          project_id: selectedProject,
          declared_total_area: parseFloat(h.declaredArea),
          parcels: h.parcels.map((p) => ({
            survey_number: p.surveyNumber.trim(),
            subdivision_number: p.subdivisionNumber.trim(),
            area: parseFloat(p.area),
          })),
        });
        if (!firstHoldingId) {
          firstHoldingId = createdHolding.holding_id;
        }
      }

      // 3. Create Water Application
      if (firstHoldingId && Number(waterRequiredLitres) > 0) {
        await waterRepo.createApplication({
          beneficiary_id: newBeneficiary.beneficiary_id,
          holding_id: firstHoldingId,
          project_id: selectedProject,
          required_litres: parseFloat(waterRequiredLitres),
          remarks: 'Registered via Field Officer Mobile App',
        });
      }

      // 4. Delete temporary draft
      await draftRepo.deleteDraft(`draft-${phoneNumber}`);

      Alert.alert(
        'Registration Complete',
        `Beneficiary "${name}" and land records have been saved to the device and queued for sync.`,
        [
          {
            text: 'View Beneficiary Dossier',
            onPress: () => router.replace(`/(app)/beneficiaries/${newBeneficiary.beneficiary_id}`),
          },
        ]
      );
    } catch (err: any) {
      console.error('Error saving registration:', err);
      Alert.alert('Save Failed', err.message || 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="New Registration"
        subtitle={`Step ${currentStep} of 6: ${STEPS[currentStep - 1].title}`}
      />

      <Stepper
        steps={STEPS}
        currentStep={currentStep}
        onSelectStep={(step) => {
          if (step < currentStep) setCurrentStep(step);
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          {/* STEP 1: Phone Lookup */}
          {currentStep === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepHeader}>Beneficiary Phone Lookup</Text>
              <Text style={styles.stepSubtext}>
                Check if the farmer is already registered or has a pending registration draft.
              </Text>

              <Input
                label="Primary Phone Number"
                placeholder="e.g. 9876543210"
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={(text) => {
                  setPhoneNumber(text);
                  setPhoneError('');
                }}
                error={phoneError}
                required
                leftIcon={<Phone size={18} color={Colors.neutral[400]} />}
              />

              <Button
                title="Continue to Personal Details"
                onPress={handlePhoneLookup}
                size="large"
                style={styles.nextBtn}
              />
            </View>
          )}

          {/* STEP 2: Personal Details */}
          {currentStep === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepHeader}>Personal Details</Text>
              <Text style={styles.stepSubtext}>Enter farmer identity and postal address.</Text>

              <Input
                label="Full Name"
                placeholder="e.g. Kanishk Ravikumar"
                value={name}
                onChangeText={setName}
                required
                leftIcon={<User size={18} color={Colors.neutral[400]} />}
              />

              <Input
                label="Email Address (Optional)"
                placeholder="e.g. farmer@example.com"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />

              <Input
                label="Street Address / House No"
                placeholder="e.g. 42 Green Valley Road"
                value={address1}
                onChangeText={setAddress1}
              />

              <Input
                label="PIN Code"
                placeholder="642104"
                keyboardType="number-pad"
                maxLength={6}
                value={pincode}
                onChangeText={setPincode}
                required
              />

              <View style={styles.btnRow}>
                <Button
                  title="Back"
                  variant="outline"
                  onPress={() => setCurrentStep(1)}
                  style={styles.halfBtn}
                />
                <Button
                  title="Next: Location"
                  onPress={async () => {
                    if (!name.trim()) {
                      Alert.alert('Name Required', 'Please enter the beneficiary name.');
                      return;
                    }
                    await persistCurrentDraft(3);
                    setCurrentStep(3);
                  }}
                  style={styles.halfBtn}
                />
              </View>
            </View>
          )}

          {/* STEP 3: Location (LGD Hierarchy) */}
          {currentStep === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepHeader}>Location & Jurisdiction</Text>
              <Text style={styles.stepSubtext}>
                Select the administrative jurisdiction and project scheme.
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.groupLabel}>District</Text>
                <View style={styles.dropdownPicker}>
                  <Text style={styles.pickerValue}>Coimbatore (CBE)</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.groupLabel}>Block / Taluk</Text>
                <View style={styles.dropdownPicker}>
                  <Text style={styles.pickerValue}>Pollachi South</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.groupLabel}>Village</Text>
                <View style={styles.dropdownPicker}>
                  <Text style={styles.pickerValue}>Anaimalai</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.groupLabel}>Project Scheme</Text>
                <View style={styles.dropdownPicker}>
                  <Text style={styles.pickerValue}>
                    Coimbatore South Irrigation Initiative (CSII-2026)
                  </Text>
                </View>
              </View>

              <View style={styles.btnRow}>
                <Button
                  title="Back"
                  variant="outline"
                  onPress={() => setCurrentStep(2)}
                  style={styles.halfBtn}
                />
                <Button
                  title="Next: Land"
                  onPress={async () => {
                    await persistCurrentDraft(4);
                    setCurrentStep(4);
                  }}
                  style={styles.halfBtn}
                />
              </View>
            </View>
          )}

          {/* STEP 4: Land Holdings & Survey Parcels */}
          {currentStep === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepHeader}>Land Holdings & Survey Parcels</Text>
              <Text style={styles.stepSubtext}>
                Enter declared acreage and exact survey/subdivision parcels with live reconciliation.
              </Text>

              {holdings.map((h, hIdx) => {
                const declared = parseFloat(h.declaredArea) || 0;
                const recon = reconcileHoldingArea(
                  declared,
                  h.parcels.map((p) => parseFloat(p.area) || 0)
                );

                return (
                  <View key={hIdx} style={styles.holdingBlock}>
                    <View style={styles.holdingHeader}>
                      <Text style={styles.holdingLabel}>Holding #{hIdx + 1}</Text>
                      {holdings.length > 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            const upd = [...holdings];
                            upd.splice(hIdx, 1);
                            setHoldings(upd);
                          }}
                        >
                          <Trash2 size={16} color={Colors.status.dangerText} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Input
                      label="Declared Total Area (Acres)"
                      placeholder="e.g. 5.00"
                      keyboardType="decimal-pad"
                      value={h.declaredArea}
                      onChangeText={(val) => {
                        const upd = [...holdings];
                        upd[hIdx].declaredArea = val;
                        setHoldings(upd);
                      }}
                      required
                    />

                    {/* Parcels List */}
                    <Text style={styles.parcelsSectionTitle}>Survey & Subdivision Parcels</Text>

                    {h.parcels.map((p, pIdx) => (
                      <View key={pIdx} style={styles.parcelFormCard}>
                        <View style={styles.parcelTopRow}>
                          <Text style={styles.parcelCardNumber}>Parcel #{pIdx + 1}</Text>
                          <TouchableOpacity onPress={() => removeParcel(hIdx, pIdx)}>
                            <Trash2 size={14} color={Colors.neutral[400]} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.parcelInputRow}>
                          <Input
                            label="Survey #"
                            placeholder="101"
                            value={p.surveyNumber}
                            onChangeText={(val) =>
                              handleParcelChange(hIdx, pIdx, 'surveyNumber', val)
                            }
                            containerStyle={styles.parcelThirdInput}
                            required
                          />
                          <Input
                            label="Subdivision #"
                            placeholder="1A"
                            value={p.subdivisionNumber}
                            onChangeText={(val) =>
                              handleParcelChange(hIdx, pIdx, 'subdivisionNumber', val)
                            }
                            containerStyle={styles.parcelThirdInput}
                            required
                          />
                          <Input
                            label="Area (Acres)"
                            placeholder="2.50"
                            keyboardType="decimal-pad"
                            value={p.area}
                            onChangeText={(val) => handleParcelChange(hIdx, pIdx, 'area', val)}
                            containerStyle={styles.parcelThirdInput}
                            required
                          />
                        </View>

                        {p.error && (
                          <View style={styles.parcelErrorRow}>
                            <AlertCircle size={13} color={Colors.status.dangerText} />
                            <Text style={styles.parcelErrorText}>{p.error}</Text>
                          </View>
                        )}
                      </View>
                    ))}

                    <Button
                      title="+ Add Another Parcel"
                      variant="outline"
                      size="small"
                      onPress={() => addParcel(hIdx)}
                      style={styles.addParcelBtn}
                    />

                    {/* Live Area Reconciliation Banner */}
                    <View
                      style={[
                        styles.reconBanner,
                        recon.isMatch ? styles.reconBannerMatch : styles.reconBannerMismatch,
                      ]}
                    >
                      <View style={styles.reconRow}>
                        <Text style={styles.reconLabel}>Declared: {declared.toFixed(2)} ac</Text>
                        <Text style={styles.reconLabel}>
                          Parcels: {recon.parcelTotal.toFixed(2)} ac
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.reconStatus,
                          recon.isMatch ? styles.reconStatusMatch : styles.reconStatusMismatch,
                        ]}
                      >
                        {recon.statusText}
                      </Text>
                    </View>
                  </View>
                );
              })}

              <Button
                title="+ Add Another Land Holding"
                variant="outline"
                onPress={addHolding}
                style={styles.addHoldingBtn}
              />

              <View style={styles.btnRow}>
                <Button
                  title="Back"
                  variant="outline"
                  onPress={() => setCurrentStep(3)}
                  style={styles.halfBtn}
                />
                <Button
                  title="Next: Water"
                  onPress={async () => {
                    if (validateLandAndParcels()) {
                      await persistCurrentDraft(5);
                      setCurrentStep(5);
                    }
                  }}
                  style={styles.halfBtn}
                />
              </View>
            </View>
          )}

          {/* STEP 5: Water Requirement */}
          {currentStep === 5 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepHeader}>Water Requirement Calculation</Text>
              <Text style={styles.stepSubtext}>
                Quota calculated dynamically from land area and active tariff rate.
              </Text>

              {/* Calculation Breakdown Card */}
              <View style={styles.calcCard}>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Total Declared Land:</Text>
                  <Text style={styles.calcValue}>{totalLandAcres.toFixed(2)} Acres</Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Applicable Tariff Allocation:</Text>
                  <Text style={styles.calcValue}>
                    {activeTariff?.litres_per_acre.toLocaleString() || '5,000'} L / Acre
                  </Text>
                </View>
                <View style={[styles.calcRow, styles.calcRowTotal]}>
                  <Text style={styles.calcLabelTotal}>Calculated Allocation:</Text>
                  <Text style={styles.calcValueTotal}>
                    {calculatedQuota.toLocaleString()} Litres
                  </Text>
                </View>
              </View>

              <Input
                label="Required Water (Litres)"
                placeholder="e.g. 25000"
                keyboardType="number-pad"
                value={waterRequiredLitres}
                onChangeText={setWaterRequiredLitres}
                required
                leftIcon={<Droplets size={18} color={Colors.accent.emerald} />}
                helper="Approved water allotment is subject to review and verification."
              />

              <View style={styles.btnRow}>
                <Button
                  title="Back"
                  variant="outline"
                  onPress={() => setCurrentStep(4)}
                  style={styles.halfBtn}
                />
                <Button
                  title="Next: Review"
                  onPress={async () => {
                    await persistCurrentDraft(6);
                    setCurrentStep(6);
                  }}
                  style={styles.halfBtn}
                />
              </View>
            </View>
          )}

          {/* STEP 6: Review & Final Save */}
          {currentStep === 6 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepHeader}>Review & Local Save</Text>
              <Text style={styles.stepSubtext}>
                Verify all registration details before committing to device SQLite.
              </Text>

              <View style={styles.reviewCard}>
                <Text style={styles.reviewSectionTitle}>Beneficiary Identity</Text>
                <Text style={styles.reviewLine}>Name: {name}</Text>
                <Text style={styles.reviewLine}>Phone: {phoneNumber}</Text>
                <Text style={styles.reviewLine}>
                  Location: Pollachi South, Coimbatore - {pincode}
                </Text>

                <Text style={[styles.reviewSectionTitle, { marginTop: 12 }]}>
                  Land & Parcels Summary
                </Text>
                <Text style={styles.reviewLine}>
                  Total Land: {totalLandAcres.toFixed(2)} Acres ({holdings.length} Holdings)
                </Text>
                {holdings.map((h, idx) => (
                  <Text key={idx} style={styles.reviewSubline}>
                    • Holding #{idx + 1}: {h.declaredArea} ac (
                    {h.parcels.map((p) => `${p.surveyNumber}/${p.subdivisionNumber}`).join(', ')})
                  </Text>
                ))}

                <Text style={[styles.reviewSectionTitle, { marginTop: 12 }]}>
                  Water Application
                </Text>
                <Text style={styles.reviewLine}>
                  Required: {Number(waterRequiredLitres).toLocaleString()} Litres
                </Text>
                <Text style={styles.reviewLine}>
                  Calculated Quota: {calculatedQuota.toLocaleString()} Litres
                </Text>
              </View>

              <Button
                title="Complete & Save to Device"
                onPress={handleFinalSave}
                loading={saving}
                size="large"
                icon={<CheckCircle size={18} color="#FFFFFF" />}
                style={styles.saveBtn}
              />

              <Button
                title="Back to Edit"
                variant="outline"
                onPress={() => setCurrentStep(5)}
                style={styles.backBtn}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.neutral[50],
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  stepContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  stepHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  stepSubtext: {
    fontSize: 13,
    color: Colors.neutral[500],
    marginBottom: 16,
    lineHeight: 18,
  },
  nextBtn: {
    marginTop: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  halfBtn: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 14,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 6,
  },
  dropdownPicker: {
    backgroundColor: Colors.neutral[50],
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerValue: {
    fontSize: 14,
    color: Colors.neutral[800],
    fontWeight: '500',
  },
  holdingBlock: {
    backgroundColor: Colors.neutral[50],
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  holdingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  parcelsSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.neutral[600],
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  parcelFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  parcelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  parcelCardNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.neutral[400],
    textTransform: 'uppercase',
  },
  parcelInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  parcelThirdInput: {
    flex: 1,
    marginBottom: 0,
  },
  parcelErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: '#FFF5F5',
    padding: 6,
    borderRadius: 6,
  },
  parcelErrorText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.status.dangerText,
    flex: 1,
  },
  addParcelBtn: {
    marginVertical: 8,
  },
  reconBanner: {
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
  },
  reconBannerMatch: {
    backgroundColor: Colors.status.successBg,
    borderColor: Colors.status.successBorder,
  },
  reconBannerMismatch: {
    backgroundColor: Colors.status.warningBg,
    borderColor: Colors.status.warningBorder,
  },
  reconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reconLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutral[700],
    fontVariant: ['tabular-nums'],
  },
  reconStatus: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  reconStatusMatch: {
    color: Colors.status.successText,
  },
  reconStatusMismatch: {
    color: Colors.status.warningText,
  },
  addHoldingBtn: {
    marginBottom: 16,
  },
  calcCard: {
    backgroundColor: Colors.primary[50],
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
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
    paddingTop: 8,
    marginTop: 4,
  },
  calcLabelTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary[900],
  },
  calcValueTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary[700],
    fontVariant: ['tabular-nums'],
  },
  reviewCard: {
    backgroundColor: Colors.neutral[50],
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  reviewSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.neutral[900],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reviewLine: {
    fontSize: 13,
    color: Colors.neutral[700],
    marginBottom: 2,
  },
  reviewSubline: {
    fontSize: 12,
    color: Colors.neutral[600],
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
  },
  saveBtn: {
    marginBottom: 8,
  },
  backBtn: {
    marginTop: 4,
  },
});
