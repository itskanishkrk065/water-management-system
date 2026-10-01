import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { ListItem } from '../../../src/components/ListItem';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { useToast } from '../../../src/components/Toast';
import { colors, spacing, borderRadius, typography, shadows, layout } from '../../../src/constants/theme';
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
import { District, Block, Panchayat, Village, ProjectScheme, RateTariff } from '../../../src/types/domain';
import { Feather } from '../../../src/components/Icon';

const beneficiaryRepo = new BeneficiaryRepository();
const landRepo = new LandRepository();
const waterRepo = new WaterRepository();
const locationRepo = new LocationRepository();
const draftRepo = new DraftRepository();

const STEPS = [
  { step: 1, title: 'Phone Lookup', sub: 'Verify if farmer exists' },
  { step: 2, title: 'Personal Details', sub: 'Identity and postal address' },
  { step: 3, title: 'Location', sub: 'District, Panchayat, Village' },
  { step: 4, title: 'Land & Parcels', sub: 'Survey numbers and acreage' },
  { step: 5, title: 'Water Quota', sub: 'Calculate allocation demand' },
  { step: 6, title: 'Review & Submit', sub: 'Final verification' },
];

interface ParcelFormState {
  surveyNumber: string;
  subdivisionNumber: string;
  area: string;
  error?: string;
}

interface HoldingFormState {
  declaredArea: string;
  projectId: string;
  parcels: ParcelFormState[];
}

export default function NewRegistrationScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Master data
  const [districts, setDistricts] = useState<District[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [panchayats, setPanchayats] = useState<Panchayat[]>([]);
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
  const [address2, setAddress2] = useState('');
  const [pincode, setPincode] = useState('641402');
  const [direction, setDirection] = useState<'NORTH' | 'SOUTH' | 'EAST' | 'WEST'>('NORTH');
  const [description, setDescription] = useState('');

  // Step 3: Location (LGD Hierarchy)
  const [selectedDistrict, setSelectedDistrict] = useState('dist-cbe');
  const [selectedBlock, setSelectedBlock] = useState('blk-pol-s');
  const [selectedPanchayat, setSelectedPanchayat] = useState('pan-anm');
  const [selectedVillage, setSelectedVillage] = useState('vil-anm');
  const [selectedProject, setSelectedProject] = useState('prj-csii');

  // Location Picker Bottom Sheet States
  const [showLocationSheet, setShowLocationSheet] = useState<'DISTRICT' | 'PANCHAYAT' | 'VILLAGE' | 'SCHEME' | null>(null);

  // Step 4: Land & Survey Parcels
  const [holdings, setHoldings] = useState<HoldingFormState[]>([
    {
      declaredArea: '5.00',
      projectId: 'prj-csii',
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

        const pans = await locationRepo.getPanchayatsByDistrict('dist-cbe');
        setPanchayats(pans);

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

  const handlePanchayatSelect = async (panId: string) => {
    setSelectedPanchayat(panId);
    setShowLocationSheet(null);
    const vils = await locationRepo.getVillagesByBlock(selectedBlock);
    setVillages(vils);
    if (vils.length > 0) {
      setSelectedVillage(vils[0].village_id);
    }
  };

  const persistCurrentDraft = async (stepNum: number) => {
    if (!phoneNumber) return;
    try {
      await draftRepo.saveDraft({
        phone_number: phoneNumber,
        step: stepNum,
        name,
        email,
        address_line1: address1,
        address_line2: address2,
        district_id: selectedDistrict,
        block_id: selectedBlock,
        panchayat_id: selectedPanchayat,
        village_id: selectedVillage,
        pincode,
        location_direction: direction,
        location_description: description,
        holdings_json: JSON.stringify(holdings),
        water_required_litres: Number(waterRequiredLitres) || 0,
        project_id: selectedProject,
      });
    } catch (err) {
      console.error('Error auto-saving draft:', err);
    }
  };

  const handlePhoneLookup = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setPhoneError('Please enter a valid 10-digit phone number');
      return;
    }
    setPhoneError('');

    const existing = await beneficiaryRepo.findByPhone(phoneNumber);
    if (existing) {
      showToast({
        message: `Farmer "${existing.name}" is already registered. Opening dossier...`,
        type: 'info',
      });
      router.push(`/(app)/beneficiaries/${existing.beneficiary_id}`);
      return;
    }

    const draft = await draftRepo.findByPhone(phoneNumber);
    if (draft) {
      setName(draft.name || '');
      setEmail(draft.email || '');
      setAddress1(draft.address_line1 || '');
      setAddress2(draft.address_line2 || '');
      setPincode(draft.pincode || '641402');
      if (draft.holdings_json) {
        try {
          setHoldings(JSON.parse(draft.holdings_json));
        } catch (_) {}
      }
      if (draft.water_required_litres) {
        setWaterRequiredLitres(String(draft.water_required_litres));
      }
      showToast({ message: 'Loaded existing draft for this number', type: 'info' });
    }

    await persistCurrentDraft(2);
    setCurrentStep(2);
  };

  const totalLandAcres = holdings.reduce(
    (sum, h) => sum + (parseFloat(h.declaredArea) || 0),
    0
  );

  const calculatedQuota = activeTariff
    ? calculateWaterQuota(activeTariff.litres_per_acre, totalLandAcres)
    : totalLandAcres * 5000;

  const handleParcelChange = (
    holdingIdx: number,
    parcelIdx: number,
    field: 'surveyNumber' | 'subdivisionNumber' | 'area',
    value: string
  ) => {
    const updatedHoldings = [...holdings];
    const holding = updatedHoldings[holdingIdx];
    const parcel = { ...holding.parcels[parcelIdx], [field]: value };

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
      parcel.error = `Duplicate parcel: Survey ${parcel.surveyNumber} / Sub ${parcel.subdivisionNumber} already exists in this holding!`;
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
      showToast({ message: 'Holdings must contain at least 1 parcel', type: 'warning' });
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
        projectId: selectedProject,
        parcels: [{ surveyNumber: '', subdivisionNumber: '', area: '1.00' }],
      },
    ]);
  };

  const validateLandAndParcels = () => {
    for (let hIdx = 0; hIdx < holdings.length; hIdx++) {
      const h = holdings[hIdx];
      const declared = parseFloat(h.declaredArea) || 0;
      if (declared <= 0) {
        showToast({ message: `Holding #${hIdx + 1} declared area must be > 0`, type: 'warning' });
        return false;
      }

      for (const p of h.parcels) {
        if (!p.surveyNumber.trim() || !p.subdivisionNumber.trim()) {
          showToast({ message: 'Survey # and Subdivision # are required for all parcels', type: 'warning' });
          return false;
        }
        if (p.error) {
          showToast({ message: p.error, type: 'error' });
          return false;
        }
      }

      const recon = reconcileHoldingArea(
        declared,
        h.parcels.map((p) => parseFloat(p.area) || 0)
      );
      if (!recon.isMatch) {
        showToast({
          message: `Holding #${hIdx + 1} mismatch: Declared ${declared} ac vs Parcels ${recon.parcelTotal} ac`,
          type: 'error',
        });
        return false;
      }
    }
    return true;
  };

  const handleFinalSave = async () => {
    setSaving(true);
    try {
      // 1. Create Beneficiary
      const newBeneficiary = await beneficiaryRepo.create({
        name,
        phone_number: phoneNumber,
        email: email || undefined,
        address_line1: address1 || undefined,
        address_line2: address2 || undefined,
        district_id: selectedDistrict,
        block_id: selectedBlock,
        panchayat_id: selectedPanchayat,
        village_id: selectedVillage,
        pincode,
        location_direction: direction,
        location_description: description || undefined,
        total_land_acres: totalLandAcres,
      });

      // 2. Create Land Holdings & Parcels
      let firstHoldingId = '';
      for (const h of holdings) {
        const createdHolding = await landRepo.createHolding({
          beneficiary_id: newBeneficiary.beneficiary_id,
          project_id: h.projectId || selectedProject,
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
          remarks: 'Registered via offline mobile wizard',
        });
      }

      // 4. Delete draft
      await draftRepo.deleteDraft(`draft-${phoneNumber}`);

      showToast({
        message: `✓ Beneficiary "${name}" registered successfully`,
        type: 'success',
      });
      router.replace(`/(app)/beneficiaries/${newBeneficiary.beneficiary_id}`);
    } catch (err: any) {
      console.error('Error saving registration:', err);
      showToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const getPanchayatName = () => {
    const p = panchayats.find((item) => item.panchayat_id === selectedPanchayat);
    return p?.panchayat_name || 'Anaimalai Town Panchayat';
  };

  const getVillageName = () => {
    const v = villages.find((item) => item.village_id === selectedVillage);
    return v?.village_name || 'Anaimalai';
  };

  const getProjectName = () => {
    const prj = projects.find((p) => p.project_id === selectedProject);
    return prj?.project_name || 'CSII-2026 Irrigation Scheme';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="New Registration"
        subtitle={`Step ${currentStep} of 6: ${STEPS[currentStep - 1].title}`}
        showBack={currentStep > 1}
        onBack={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
      />

      {/* Modern Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${(currentStep / 6) * 100}%` }]} />
        </View>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressStepCount}>Step {currentStep} of 6</Text>
          <Text style={styles.progressStepName}>{STEPS[currentStep - 1].title}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* STEP 1: Phone Lookup */}
          {currentStep === 1 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHero}>
                <View style={styles.stepHeroIcon}>
                  <Feather name="phone-call" size={24} color={colors.primary} />
                </View>
                <Text style={styles.stepTitle}>Farmer Phone Lookup</Text>
                <Text style={styles.stepSubtitle}>
                  Enter the 10-digit mobile number to check existing records or restore incomplete drafts.
                </Text>
              </View>

              <View style={styles.formCard}>
                <Input
                  label="Primary Mobile Number"
                  placeholder="e.g. 9876543210"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phoneNumber}
                  onChangeText={(text) => {
                    setPhoneNumber(text);
                    setPhoneError('');
                  }}
                  error={phoneError}
                  icon={<Feather name="phone" size={16} color={colors.textSecondary} />}
                />
              </View>
            </View>
          )}

          {/* STEP 2: Personal Details */}
          {currentStep === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHero}>
                <View style={styles.stepHeroIcon}>
                  <Feather name="user" size={24} color={colors.primary} />
                </View>
                <Text style={styles.stepTitle}>Personal Details & Address</Text>
                <Text style={styles.stepSubtitle}>
                  Enter beneficiary identity, postal address, and farm boundary notes.
                </Text>
              </View>

              <View style={styles.formCard}>
                <Input
                  label="Full Legal Name"
                  placeholder="e.g. Kanishk Ravikumar"
                  value={name}
                  onChangeText={setName}
                  icon={<Feather name="user" size={16} color={colors.textSecondary} />}
                />

                <Input
                  label="Email Address (Optional)"
                  placeholder="e.g. farmer@example.com"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  icon={<Feather name="mail" size={16} color={colors.textSecondary} />}
                />

                <Input
                  label="Address Line 1 (Street / Farm Name)"
                  placeholder="e.g. 42 Green Valley Coconut Grove"
                  value={address1}
                  onChangeText={setAddress1}
                />

                <Input
                  label="Address Line 2 (Area / Landmark)"
                  placeholder="e.g. Near TNEB Substation"
                  value={address2}
                  onChangeText={setAddress2}
                />

                <Input
                  label="PIN Code"
                  placeholder="641402"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={pincode}
                  onChangeText={setPincode}
                />

                <Text style={styles.fieldLabel}>Farm Boundary Direction</Text>
                <View style={styles.directionRow}>
                  {(['NORTH', 'SOUTH', 'EAST', 'WEST'] as const).map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dirChip, direction === d && styles.dirChipActive]}
                      onPress={() => setDirection(d)}
                    >
                      <Text style={[styles.dirChipText, direction === d && styles.dirChipTextActive]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Input
                  label="Location Description / Notes"
                  placeholder="e.g. Bordering canal junction north of milestone 14"
                  value={description}
                  onChangeText={setDescription}
                  style={{ marginTop: 12 }}
                />
              </View>
            </View>
          )}

          {/* STEP 3: Location Hierarchy */}
          {currentStep === 3 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHero}>
                <View style={styles.stepHeroIcon}>
                  <Feather name="map-pin" size={24} color={colors.primary} />
                </View>
                <Text style={styles.stepTitle}>Location & Jurisdiction</Text>
                <Text style={styles.stepSubtitle}>
                  Select administrative jurisdiction (District $\rightarrow$ Panchayat $\rightarrow$ Village)
                </Text>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.fieldLabel}>District</Text>
                <View style={styles.readonlySelector}>
                  <Text style={styles.selectorValueText}>Coimbatore (Dist Code: 3312)</Text>
                  <Feather name="check" size={16} color={colors.success} />
                </View>

                <Text style={styles.fieldLabel}>Panchayat (LGD Block)</Text>
                <TouchableOpacity
                  style={styles.actionSelector}
                  onPress={() => setShowLocationSheet('PANCHAYAT')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectorValueText}>{getPanchayatName()}</Text>
                  <Feather name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>Village (LGD Code)</Text>
                <TouchableOpacity
                  style={styles.actionSelector}
                  onPress={() => setShowLocationSheet('VILLAGE')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectorValueText}>{getVillageName()}</Text>
                  <Feather name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>Project Scheme</Text>
                <TouchableOpacity
                  style={styles.actionSelector}
                  onPress={() => setShowLocationSheet('SCHEME')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectorValueText}>{getProjectName()}</Text>
                  <Feather name="chevron-down" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 4: Land Holdings & Parcels */}
          {currentStep === 4 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHero}>
                <View style={styles.stepHeroIcon}>
                  <Feather name="layers" size={24} color={colors.primary} />
                </View>
                <Text style={styles.stepTitle}>Land Holdings & Survey Parcels</Text>
                <Text style={styles.stepSubtitle}>
                  Enter declared holding acreage and exact survey/subdivision parcels with decimal reconciliation.
                </Text>
              </View>

              {holdings.map((h, hIdx) => {
                const declared = parseFloat(h.declaredArea) || 0;
                const recon = reconcileHoldingArea(
                  declared,
                  h.parcels.map((p) => parseFloat(p.area) || 0)
                );

                return (
                  <View key={hIdx} style={styles.formCard}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.holdingHeaderTitle}>Holding #{hIdx + 1}</Text>
                      {holdings.length > 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            const upd = [...holdings];
                            upd.splice(hIdx, 1);
                            setHoldings(upd);
                          }}
                        >
                          <Feather name="trash-2" size={16} color={colors.danger} />
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
                    />

                    <Text style={styles.parcelsHeaderLabel}>Survey & Subdivision Parcels</Text>

                    {h.parcels.map((p, pIdx) => (
                      <View key={pIdx} style={styles.parcelCard}>
                        <View style={styles.parcelCardHeader}>
                          <Text style={styles.parcelCardIndex}>Parcel #{pIdx + 1}</Text>
                          <TouchableOpacity onPress={() => removeParcel(hIdx, pIdx)}>
                            <Feather name="x" size={16} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.parcelRowInputs}>
                          <Input
                            label="Survey #"
                            placeholder="101"
                            value={p.surveyNumber}
                            onChangeText={(val) => handleParcelChange(hIdx, pIdx, 'surveyNumber', val)}
                            containerStyle={{ flex: 1 }}
                          />
                          <Input
                            label="Subdivision #"
                            placeholder="1A"
                            value={p.subdivisionNumber}
                            onChangeText={(val) => handleParcelChange(hIdx, pIdx, 'subdivisionNumber', val)}
                            containerStyle={{ flex: 1 }}
                          />
                          <Input
                            label="Area (Ac)"
                            placeholder="2.50"
                            keyboardType="decimal-pad"
                            value={p.area}
                            onChangeText={(val) => handleParcelChange(hIdx, pIdx, 'area', val)}
                            containerStyle={{ flex: 1 }}
                          />
                        </View>

                        {p.error && (
                          <View style={styles.parcelErrorRow}>
                            <Feather name="alert-triangle" size={12} color={colors.danger} />
                            <Text style={styles.parcelErrorText}>{p.error}</Text>
                          </View>
                        )}
                      </View>
                    ))}

                    <Button
                      title="+ Add Parcel"
                      variant="secondary"
                      size="sm"
                      onPress={() => addParcel(hIdx)}
                      style={{ marginTop: 8 }}
                    />

                    {/* Area Reconciliation Banner */}
                    <View
                      style={[
                        styles.reconBanner,
                        recon.isMatch ? styles.reconMatch : styles.reconMismatch,
                      ]}
                    >
                      <View style={styles.reconSummaryRow}>
                        <Text style={styles.reconText}>Declared: {declared.toFixed(2)} ac</Text>
                        <Text style={styles.reconText}>Parcels: {recon.parcelTotal.toFixed(2)} ac</Text>
                      </View>
                      <Text
                        style={[
                          styles.reconStatusText,
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
                style={{ marginTop: 4, marginBottom: 12 }}
              />
            </View>
          )}

          {/* STEP 5: Water Quota */}
          {currentStep === 5 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHero}>
                <View style={styles.stepHeroIcon}>
                  <Feather name="droplet" size={24} color={colors.primary} />
                </View>
                <Text style={styles.stepTitle}>Water Requirement & Quota</Text>
                <Text style={styles.stepSubtitle}>
                  Calculated based on declared holding area and applicable project scheme tariff.
                </Text>
              </View>

              <View style={styles.formCard}>
                <View style={styles.calcSummaryCard}>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Total Declared Land:</Text>
                    <Text style={styles.calcValue}>{totalLandAcres.toFixed(2)} Acres</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Tariff Scheme:</Text>
                    <Text style={styles.calcValue}>{getProjectName()}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Rate Tariff:</Text>
                    <Text style={styles.calcValue}>
                      {activeTariff ? `${activeTariff.litres_per_acre.toLocaleString()} L / Acre` : '5,000 L / Acre'}
                    </Text>
                  </View>
                  <View style={[styles.calcRow, styles.calcRowTotal]}>
                    <Text style={styles.calcTotalLabel}>Calculated Quota:</Text>
                    <Text style={styles.calcTotalValue}>{calculatedQuota.toLocaleString()} L</Text>
                  </View>
                </View>

                <Input
                  label="Required Water Quantity (Litres)"
                  placeholder="25000"
                  keyboardType="numeric"
                  value={waterRequiredLitres}
                  onChangeText={setWaterRequiredLitres}
                  hint="Farmer requested requirement (max approved during administrative review)"
                  style={{ marginTop: 12 }}
                />
              </View>
            </View>
          )}

          {/* STEP 6: Review & Submit */}
          {currentStep === 6 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHero}>
                <View style={styles.stepHeroIcon}>
                  <Feather name="check-circle" size={24} color={colors.success} />
                </View>
                <Text style={styles.stepTitle}>Review & Save Offline</Text>
                <Text style={styles.stepSubtitle}>
                  Verify beneficiary details before saving to encrypted local SQLite.
                </Text>
              </View>

              <View style={styles.formCard}>
                <ListItem title="Beneficiary Name" subtitle={name} showChevron={false} />
                <ListItem title="Phone Number" subtitle={phoneNumber} showChevron={false} />
                <ListItem
                  title="Jurisdiction"
                  subtitle={`Coimbatore • ${getPanchayatName()} • ${getVillageName()}`}
                  showChevron={false}
                />
                <ListItem
                  title="Land Holdings"
                  subtitle={`${holdings.length} Holdings • ${totalLandAcres.toFixed(2)} Total Acres`}
                  showChevron={false}
                />
                <ListItem
                  title="Water Demand"
                  subtitle={`Required: ${Number(waterRequiredLitres).toLocaleString()} L (Calc: ${calculatedQuota.toLocaleString()} L)`}
                  showChevron={false}
                  borderBottom={false}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Bottom Actions */}
      <View style={styles.stickyFooter}>
        {currentStep === 1 && (
          <Button
            title="Continue to Personal Details"
            onPress={handlePhoneLookup}
            fullWidth
            size="lg"
          />
        )}

        {currentStep === 2 && (
          <View style={styles.footerBtnRow}>
            <Button
              title="Back"
              variant="secondary"
              onPress={() => setCurrentStep(1)}
              style={{ flex: 1 }}
            />
            <Button
              title="Next: Location"
              onPress={async () => {
                if (!name.trim()) {
                  showToast({ message: 'Please enter farmer legal name', type: 'warning' });
                  return;
                }
                await persistCurrentDraft(3);
                setCurrentStep(3);
              }}
              style={{ flex: 1.5 }}
            />
          </View>
        )}

        {currentStep === 3 && (
          <View style={styles.footerBtnRow}>
            <Button
              title="Back"
              variant="secondary"
              onPress={() => setCurrentStep(2)}
              style={{ flex: 1 }}
            />
            <Button
              title="Next: Land & Parcels"
              onPress={async () => {
                await persistCurrentDraft(4);
                setCurrentStep(4);
              }}
              style={{ flex: 1.5 }}
            />
          </View>
        )}

        {currentStep === 4 && (
          <View style={styles.footerBtnRow}>
            <Button
              title="Back"
              variant="secondary"
              onPress={() => setCurrentStep(3)}
              style={{ flex: 1 }}
            />
            <Button
              title="Next: Water Quota"
              onPress={async () => {
                if (validateLandAndParcels()) {
                  await persistCurrentDraft(5);
                  setCurrentStep(5);
                }
              }}
              style={{ flex: 1.5 }}
            />
          </View>
        )}

        {currentStep === 5 && (
          <View style={styles.footerBtnRow}>
            <Button
              title="Back"
              variant="secondary"
              onPress={() => setCurrentStep(4)}
              style={{ flex: 1 }}
            />
            <Button
              title="Review & Verify"
              onPress={async () => {
                await persistCurrentDraft(6);
                setCurrentStep(6);
              }}
              style={{ flex: 1.5 }}
            />
          </View>
        )}

        {currentStep === 6 && (
          <View style={styles.footerBtnRow}>
            <Button
              title="Back"
              variant="secondary"
              onPress={() => setCurrentStep(5)}
              style={{ flex: 1 }}
            />
            <Button
              title="Save Registration Offline"
              loading={saving}
              onPress={handleFinalSave}
              style={{ flex: 2 }}
            />
          </View>
        )}
      </View>

      {/* Location Picker Bottom Sheets */}
      <BottomSheet
        visible={showLocationSheet === 'PANCHAYAT'}
        onClose={() => setShowLocationSheet(null)}
        title="Select Panchayat"
        subtitle="Coimbatore District"
      >
        {panchayats.map((p) => (
          <ListItem
            key={p.panchayat_id}
            title={p.panchayat_name || p.name || 'Panchayat'}
            subtitle={`LGD Block Code: ${p.block_code || ''}`}
            onPress={() => handlePanchayatSelect(p.panchayat_id)}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={showLocationSheet === 'VILLAGE'}
        onClose={() => setShowLocationSheet(null)}
        title="Select Village"
        subtitle="LGD Village Master"
      >
        {villages.map((v) => (
          <ListItem
            key={v.village_id}
            title={v.village_name || v.name || 'Village'}
            subtitle={`LGD Village Code: ${v.village_code || ''}`}
            onPress={() => {
              setSelectedVillage(v.village_id);
              setShowLocationSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet
        visible={showLocationSheet === 'SCHEME'}
        onClose={() => setShowLocationSheet(null)}
        title="Select Project Scheme"
        subtitle="Irrigation Master Schemes"
      >
        {projects.map((p) => (
          <ListItem
            key={p.project_id}
            title={p.project_name}
            subtitle={p.description || 'Active irrigation project'}
            onPress={() => {
              setSelectedProject(p.project_id);
              setShowLocationSheet(null);
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressStepCount: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
    color: colors.primary,
    fontFamily: typography.fontFamily.bold,
  },
  progressStepName: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  stepContainer: {
    gap: spacing.md,
  },
  stepHero: {
    marginBottom: spacing.xs,
  },
  stepHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stepTitle: {
    fontSize: typography.fontSize.heading,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  stepSubtitle: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  holdingHeaderTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fieldLabel: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontFamily: typography.fontFamily.medium,
  },
  directionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dirChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  dirChipText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dirChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  readonlySelector: {
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
  actionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1.2,
    borderColor: colors.border,
  },
  selectorValueText: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  parcelsHeaderLabel: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  parcelCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  parcelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  parcelCardIndex: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  parcelRowInputs: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  parcelErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  parcelErrorText: {
    fontSize: typography.fontSize.micro,
    color: colors.danger,
    fontWeight: '600',
  },
  reconBanner: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    borderWidth: 1,
  },
  reconMatch: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
  },
  reconMismatch: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.dangerBorder,
  },
  reconSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reconText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  reconStatusText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
    marginTop: 4,
  },
  reconStatusMatch: {
    color: colors.success,
  },
  reconStatusMismatch: {
    color: colors.danger,
  },
  calcSummaryCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
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
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  calcTotalLabel: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  calcTotalValue: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '800',
    color: colors.primary,
  },
  stickyFooter: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.sheet,
  },
  footerBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
