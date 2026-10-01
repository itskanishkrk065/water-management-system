import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { Avatar } from '../../../src/components/Avatar';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';
import { Tabs, TabItem } from '../../../src/components/Tabs';
import { MetricGroup, MetricItem } from '../../../src/components/MetricGroup';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { ListItem } from '../../../src/components/ListItem';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { EmptyState } from '../../../src/components/EmptyState';
import { useToast } from '../../../src/components/Toast';
import { useAuth } from '../../../src/auth/AuthContext';
import { colors, spacing, borderRadius, typography, shadows, layout } from '../../../src/constants/theme';
import { BeneficiaryRepository } from '../../../src/repositories/BeneficiaryRepository';
import { LandRepository, CreateParcelInput } from '../../../src/repositories/LandRepository';
import { WaterRepository } from '../../../src/repositories/WaterRepository';
import { BillingRepository } from '../../../src/repositories/BillingRepository';
import { InfrastructureRepository } from '../../../src/repositories/InfrastructureRepository';
import { ExtensionRepository } from '../../../src/repositories/ExtensionRepository';
import { DocumentRepository } from '../../../src/repositories/DocumentRepository';
import { ProjectRepository } from '../../../src/repositories/ProjectRepository';
import { AuditRepository } from '../../../src/repositories/AuditRepository';
import {
  Beneficiary,
  LandHolding,
  WaterApplication,
  PaymentMode,
  DocumentCategory,
  ProjectScheme,
  Payment,
} from '../../../src/types/domain';
import { LocalAuditEvent } from '../../../src/types/audit';
import { Feather } from '../../../src/components/Icon';

const beneficiaryRepo = new BeneficiaryRepository();
const landRepo = new LandRepository();
const waterRepo = new WaterRepository();
const billingRepo = new BillingRepository();
const extRepo = new ExtensionRepository();
const docRepo = new DocumentRepository();
const projectRepo = new ProjectRepository();
const auditRepo = new AuditRepository();

export default function BeneficiaryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('OVERVIEW');
  const [waterSubTab, setWaterSubTab] = useState<'CURRENT' | 'HISTORY'>('CURRENT');
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [projects, setProjects] = useState<ProjectScheme[]>([]);
  const [auditLogs, setAuditLogs] = useState<LocalAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Edit Profile Sheet State
  const [showEditProfileSheet, setShowEditProfileSheet] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress1, setEditAddress1] = useState('');
  const [editAddress2, setEditAddress2] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editDirection, setEditDirection] = useState<'NORTH' | 'SOUTH' | 'EAST' | 'WEST'>('NORTH');
  const [savingProfile, setSavingProfile] = useState(false);

  // 2. Add Land Holding & Parcels Sheet State
  const [showAddHoldingSheet, setShowAddHoldingSheet] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [declaredArea, setDeclaredArea] = useState('');
  const [holdingParcels, setHoldingParcels] = useState<CreateParcelInput[]>([
    { survey_number: '', subdivision_number: '1', area: 0 },
  ]);
  const [savingHolding, setSavingHolding] = useState(false);

  // 3. Add Parcel to Existing Holding Sheet State
  const [showAddParcelSheet, setShowAddParcelSheet] = useState(false);
  const [targetHoldingId, setTargetHoldingId] = useState('');
  const [newSurveyNumber, setNewSurveyNumber] = useState('');
  const [newSubdivision, setNewSubdivision] = useState('');
  const [newParcelArea, setNewParcelArea] = useState('');
  const [savingParcel, setSavingParcel] = useState(false);

  // 4. Request Water Application Sheet State
  const [showWaterAppSheet, setShowWaterAppSheet] = useState(false);
  const [waterHoldingId, setWaterHoldingId] = useState('');
  const [requiredLitres, setRequiredLitres] = useState('5000');
  const [waterRemarks, setWaterRemarks] = useState('');
  const [savingWaterApp, setSavingWaterApp] = useState(false);

  // 5. Request Extension Sheet State
  const [showExtensionSheet, setShowExtensionSheet] = useState(false);
  const [extAllotmentId, setExtAllotmentId] = useState('');
  const [extArea, setExtArea] = useState('1.0');
  const [extLitres, setExtLitres] = useState('1000');
  const [extRemarks, setExtRemarks] = useState('');
  const [savingExtension, setSavingExtension] = useState(false);

  // 6. Record Payment Sheet State
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedInstId, setSelectedInstId] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // 7. View Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // 8. Document Sheet State
  const [showDocSheet, setShowDocSheet] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('LAND_RECORD');
  const [docFileName, setDocFileName] = useState('');
  const [submittingDoc, setSubmittingDoc] = useState(false);

  // 9. Deactivation / Reactivation Obligations State
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [obligations, setObligations] = useState<any | null>(null);
  const [submittingStatus, setSubmittingStatus] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      const [ben, activeProjects, logs] = await Promise.all([
        beneficiaryRepo.getById(id),
        projectRepo.getActive(),
        auditRepo.getByEntityId('BENEFICIARY', id),
      ]);

      setBeneficiary(ben);
      setProjects(activeProjects);
      setAuditLogs(logs);

      if (activeProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(activeProjects[0].project_id);
      }

      if (ben?.land_holdings && ben.land_holdings.length > 0 && !waterHoldingId) {
        setWaterHoldingId(ben.land_holdings[0].holding_id);
        setTargetHoldingId(ben.land_holdings[0].holding_id);
      }

      if (ben?.water_allotments && ben.water_allotments.length > 0 && !extAllotmentId) {
        setExtAllotmentId(ben.water_allotments[0].allotment_id);
      }

      if (ben?.development_bills && ben.development_bills.length > 0) {
        setSelectedBillId(ben.development_bills[0].bill_id);
        if (ben.development_bills[0].installments?.length > 0) {
          const pendingInst = ben.development_bills[0].installments.find((i) => i.pending_amount > 0);
          setSelectedInstId(pendingInst ? pendingInst.installment_id : null);
          setPaymentAmount(pendingInst ? String(pendingInst.pending_amount) : '');
        }
      }
    } catch (err) {
      console.error('Error loading beneficiary dossier:', err);
      showToast({ message: 'Failed to load beneficiary dossier', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  // Open Edit Profile
  const handleOpenEditProfile = () => {
    if (!beneficiary) return;
    setEditName(beneficiary.name);
    setEditPhone(beneficiary.phone_number);
    setEditEmail(beneficiary.email || '');
    setEditAddress1(beneficiary.address_line1 || '');
    setEditAddress2(beneficiary.address_line2 || '');
    setEditPincode(beneficiary.pincode || '');
    setEditDirection(beneficiary.location_direction || 'NORTH');
    setShowEditProfileSheet(true);
  };

  // Save Edit Profile
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      showToast({ message: 'Beneficiary name is required', type: 'warning' });
      return;
    }
    if (!beneficiary) return;

    setSavingProfile(true);
    try {
      await beneficiaryRepo.update({
        beneficiary_id: beneficiary.beneficiary_id,
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        address_line1: editAddress1.trim() || undefined,
        address_line2: editAddress2.trim() || undefined,
        pincode: editPincode.trim() || undefined,
        location_direction: editDirection,
        updated_by: user?.name || 'FIELD_OFFICER',
      });

      showToast({ message: '✓ Profile updated successfully', type: 'success' });
      setShowEditProfileSheet(false);
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to update profile', type: 'error' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Open Deactivate / Reactivate
  const handleOpenStatusSheet = async () => {
    if (!beneficiary) return;
    try {
      const summary = await beneficiaryRepo.getObligationsSummary(beneficiary.beneficiary_id);
      setObligations(summary);
      setStatusReason('');
      setShowStatusSheet(true);
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to check obligations', type: 'error' });
    }
  };

  // Submit Status Change (Deactivate / Reactivate)
  const handleToggleStatus = async () => {
    if (!beneficiary) return;
    if (!statusReason.trim()) {
      showToast({ message: 'Please provide a reason for status change', type: 'warning' });
      return;
    }

    setSubmittingStatus(true);
    try {
      if (beneficiary.status === 'ACTIVE') {
        await beneficiaryRepo.deactivate(beneficiary.beneficiary_id, statusReason.trim(), user?.name);
        showToast({ message: 'Beneficiary marked as INACTIVE', type: 'info' });
      } else {
        await beneficiaryRepo.reactivate(beneficiary.beneficiary_id, statusReason.trim(), user?.name);
        showToast({ message: 'Beneficiary REACTIVATED successfully', type: 'success' });
      }
      setShowStatusSheet(false);
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Status mutation failed', type: 'error' });
    } finally {
      setSubmittingStatus(false);
    }
  };

  // Add Land Holding with Parcels
  const handleAddHolding = async () => {
    if (!declaredArea || parseFloat(declaredArea) <= 0) {
      showToast({ message: 'Please enter a valid declared total area', type: 'warning' });
      return;
    }
    if (!selectedProjectId) {
      showToast({ message: 'Please select a project scheme', type: 'warning' });
      return;
    }
    if (!beneficiary) return;

    // Validate parcels
    const validParcels = holdingParcels.filter((p) => p.survey_number.trim() && p.area > 0);
    if (validParcels.length === 0) {
      showToast({ message: 'Please add at least one survey parcel with survey number and area', type: 'warning' });
      return;
    }

    const parcelSum = validParcels.reduce((sum, p) => sum + Number(p.area), 0);
    if (Math.abs(parcelSum - parseFloat(declaredArea)) > 0.001) {
      showToast({
        message: `Sum of parcels (${parcelSum} ac) must equal declared area (${declaredArea} ac)`,
        type: 'warning',
      });
      return;
    }

    setSavingHolding(true);
    try {
      await landRepo.createHolding({
        beneficiary_id: beneficiary.beneficiary_id,
        project_id: selectedProjectId,
        declared_total_area: parseFloat(declaredArea),
        parcels: validParcels,
        created_by: user?.name || 'FIELD_OFFICER',
      });

      showToast({ message: '✓ Land holding and survey parcels registered', type: 'success' });
      setShowAddHoldingSheet(false);
      setDeclaredArea('');
      setHoldingParcels([{ survey_number: '', subdivision_number: '1', area: 0 }]);
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to add land holding', type: 'error' });
    } finally {
      setSavingHolding(false);
    }
  };

  // Add Parcel to Existing Holding
  const handleAddParcel = async () => {
    if (!newSurveyNumber.trim()) {
      showToast({ message: 'Please enter survey number', type: 'warning' });
      return;
    }
    if (!newParcelArea || parseFloat(newParcelArea) <= 0) {
      showToast({ message: 'Please enter parcel area', type: 'warning' });
      return;
    }
    if (!targetHoldingId) {
      showToast({ message: 'Select a land holding', type: 'warning' });
      return;
    }

    setSavingParcel(true);
    try {
      await landRepo.addParcel(
        targetHoldingId,
        {
          survey_number: newSurveyNumber.trim(),
          subdivision_number: newSubdivision.trim() || '1',
          area: parseFloat(newParcelArea),
        },
        user?.name || 'FIELD_OFFICER'
      );

      showToast({ message: '✓ Survey parcel attached to holding', type: 'success' });
      setShowAddParcelSheet(false);
      setNewSurveyNumber('');
      setNewSubdivision('');
      setNewParcelArea('');
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to add parcel', type: 'error' });
    } finally {
      setSavingParcel(false);
    }
  };

  // Request Water Application
  const handleRequestWater = async () => {
    if (!waterHoldingId) {
      showToast({ message: 'Select an eligible land holding', type: 'warning' });
      return;
    }
    if (!requiredLitres || parseFloat(requiredLitres) <= 0) {
      showToast({ message: 'Enter requested water litres', type: 'warning' });
      return;
    }
    if (!beneficiary) return;

    const holding = beneficiary.land_holdings?.find((h) => h.holding_id === waterHoldingId);
    if (!holding) return;

    setSavingWaterApp(true);
    try {
      await waterRepo.createApplication({
        beneficiary_id: beneficiary.beneficiary_id,
        holding_id: waterHoldingId,
        project_id: holding.project_id,
        required_litres: parseFloat(requiredLitres),
        remarks: waterRemarks || undefined,
        created_by: user?.name || 'FIELD_OFFICER',
      });

      showToast({ message: '✓ Water application submitted for review', type: 'success' });
      setShowWaterAppSheet(false);
      setWaterRemarks('');
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to submit water application', type: 'error' });
    } finally {
      setSavingWaterApp(false);
    }
  };

  // Request Extension
  const handleRequestExtension = async () => {
    if (!extAllotmentId) {
      showToast({ message: 'Select active water allotment', type: 'warning' });
      return;
    }
    if (!beneficiary) return;

    setSavingExtension(true);
    try {
      await extRepo.createRequest({
        beneficiary_id: beneficiary.beneficiary_id,
        original_allotment_id: extAllotmentId,
        requested_additional_area: parseFloat(extArea) || 1.0,
        requested_additional_litres: parseFloat(extLitres) || 1000,
        remarks: extRemarks || undefined,
        created_by: user?.name || 'FIELD_OFFICER',
      });

      showToast({ message: '✓ Extension request submitted', type: 'success' });
      setShowExtensionSheet(false);
      setExtRemarks('');
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to submit extension', type: 'error' });
    } finally {
      setSavingExtension(false);
    }
  };

  // Record Payment
  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      showToast({ message: 'Please enter a valid payment amount', type: 'warning' });
      return;
    }
    if (!beneficiary) return;

    setSubmittingPayment(true);
    try {
      const payment = await billingRepo.recordPayment({
        beneficiary_id: beneficiary.beneficiary_id,
        bill_id: selectedBillId || undefined,
        installment_id: selectedInstId || undefined,
        amount: parseFloat(paymentAmount),
        payment_mode: paymentMode,
        payment_reference: paymentRef || undefined,
        remarks: `Recorded via mobile offline client for ${beneficiary.name}`,
        recorded_by: user?.name || 'FIELD_OFFICER',
      });

      showToast({ message: '✓ Payment recorded locally', type: 'success' });
      setShowPaymentSheet(false);
      setPaymentAmount('');
      setPaymentRef('');
      await loadData();

      // Show receipt immediately
      const receiptData = await billingRepo.getReceipt(payment.payment_id);
      if (receiptData) {
        setSelectedReceipt(receiptData);
        setShowReceiptModal(true);
      }
    } catch (err: any) {
      showToast({ message: err.message || 'Payment failed', type: 'error' });
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Attach Document
  const handleAddDocument = async () => {
    if (!docTitle.trim()) {
      showToast({ message: 'Please enter document title', type: 'warning' });
      return;
    }
    if (!beneficiary) return;

    setSubmittingDoc(true);
    try {
      await docRepo.addDocument({
        beneficiary_id: beneficiary.beneficiary_id,
        category: docCategory,
        title: docTitle.trim(),
        file_name: docFileName.trim() || `${docTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`,
        file_size_bytes: 245000,
        storage_path: `documents/${beneficiary.beneficiary_id}/${Date.now()}.pdf`,
      });

      showToast({ message: '✓ Document record attached', type: 'success' });
      setShowDocSheet(false);
      setDocTitle('');
      setDocFileName('');
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to attach document', type: 'error' });
    } finally {
      setSubmittingDoc(false);
    }
  };

  // View Receipt
  const handleOpenReceipt = async (paymentId: string) => {
    const data = await billingRepo.getReceipt(paymentId);
    if (data) {
      setSelectedReceipt(data);
      setShowReceiptModal(true);
    }
  };

  // Share Receipt
  const handleShareReceipt = async () => {
    if (!selectedReceipt) return;
    try {
      await Share.share({
        message: `WaterGrid Payment Receipt\nReceipt #: ${selectedReceipt.payment.receipt_number}\nBeneficiary: ${selectedReceipt.beneficiaryName}\nAmount Paid: ₹${selectedReceipt.payment.amount}\nMode: ${selectedReceipt.payment.payment_mode}\nDate: ${new Date(selectedReceipt.payment.payment_date).toLocaleDateString()}`,
      });
    } catch (err) {
      console.error('Receipt share error:', err);
    }
  };

  if (loading || !beneficiary) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
        <Header title="Beneficiary Dossier" showBack onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading complete dossier...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate Metrics
  const totalLand = beneficiary.land_holdings?.reduce((sum, h) => sum + (h.declared_total_area || 0), 0) || 0;
  const totalWaterAllotted = beneficiary.water_allotments?.reduce((sum, a) => sum + (a.approved_litres || 0), 0) || 0;
  let totalBillAmount = 0;
  let totalPaidAmount = 0;
  let totalPendingAmount = 0;

  beneficiary.development_bills?.forEach((b) => {
    totalBillAmount += b.total_amount || 0;
    totalPaidAmount += b.amount_paid || 0;
    totalPendingAmount += b.pending_amount || 0;
  });

  const overviewMetrics: MetricItem[] = [
    {
      id: 'm1',
      label: 'Approved Water',
      value: `${totalWaterAllotted.toLocaleString()} L`,
      subvalue: `${beneficiary.water_allotments?.length || 0} Allotment(s)`,
      color: colors.primary,
    },
    {
      id: 'm2',
      label: 'Total Registered Land',
      value: `${totalLand.toFixed(2)} ac`,
      subvalue: `${beneficiary.land_holdings?.length || 0} Holding(s)`,
      color: colors.secondary,
    },
    {
      id: 'm3',
      label: 'Collected Amount',
      value: `₹${totalPaidAmount.toLocaleString()}`,
      subvalue: 'Paid to date',
      color: colors.success,
    },
    {
      id: 'm4',
      label: 'Outstanding Balance',
      value: `₹${totalPendingAmount.toLocaleString()}`,
      subvalue: 'Pending balance',
      color: totalPendingAmount > 0 ? colors.warning : colors.success,
    },
  ];

  const tabs: TabItem[] = [
    { key: 'OVERVIEW', label: 'Overview', icon: 'user' },
    { key: 'LAND', label: `Land (${beneficiary.land_holdings?.length || 0})`, icon: 'map-pin' },
    { key: 'WATER', label: `Water (${beneficiary.water_applications?.length || 0})`, icon: 'droplets' },
    { key: 'BILLING', label: `Billing (₹${totalPendingAmount.toLocaleString()})`, icon: 'credit-card' },
    { key: 'PAYMENTS', label: `Payments (${beneficiary.payments?.length || 0})`, icon: 'check-circle' },
    { key: 'INFRASTRUCTURE', label: `Infrastructure (${beneficiary.infrastructure?.length || 0})`, icon: 'activity' },
    { key: 'EXTENSIONS', label: `Extensions (${beneficiary.extensions?.length || 0})`, icon: 'git-pull-request' },
    { key: 'DOCUMENTS', label: `Documents (${beneficiary.documents?.length || 0})`, icon: 'file-text' },
    { key: 'HISTORY', label: 'Audit Trail', icon: 'clock' },
  ];

  const currentWaterApps = beneficiary.water_applications?.filter(
    (a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW' || a.status === 'DRAFT' || a.status === 'APPROVED'
  ) || [];
  const historyWaterApps = beneficiary.water_applications?.filter(
    (a) => a.status === 'REJECTED' || a.status === 'CANCELLED' || a.status === 'VOIDED'
  ) || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title={beneficiary.name}
        subtitle={`ID: ${beneficiary.beneficiary_id.slice(0, 12)} • ${beneficiary.village_name || 'Village'}`}
        showBack
        onBack={() => router.back()}
        rightAction={{
          icon: 'edit',
          onPress: handleOpenEditProfile,
          accessibilityLabel: 'Edit Profile',
        }}
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile Card Header */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <Avatar name={beneficiary.name} size={54} />
            <View style={styles.profileInfo}>
              <View style={styles.profileTitleRow}>
                <Text style={styles.profileName}>{beneficiary.name}</Text>
                <StatusBadge status={beneficiary.status} />
              </View>
              <Text style={styles.profilePhone}>{beneficiary.phone_number}</Text>
              <Text style={styles.profileLocation}>
                {beneficiary.village_name || 'Village'}, {beneficiary.panchayat_name || 'Panchayat'}, {beneficiary.district_name || 'Coimbatore'}
              </Text>
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.profileActions}>
            <Button
              title="Edit Profile"
              variant="outline"
              size="sm"
              icon={<Feather name="edit" size={14} color={colors.primary} />}
              onPress={handleOpenEditProfile}
            />
            <Button
              title="Record Payment"
              variant="secondary"
              size="sm"
              icon={<Feather name="credit-card" size={14} color={colors.surface} />}
              onPress={() => setShowPaymentSheet(true)}
            />
            <Button
              title={beneficiary.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
              variant="subtle"
              size="sm"
              onPress={handleOpenStatusSheet}
            />
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabWrapper}>
          <Tabs items={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        </View>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <View style={styles.tabContent}>
            <SectionHeader title="Operational Metrics" />
            <MetricGroup items={overviewMetrics} columns={2} />

            <SectionHeader title="Location & Address" />
            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>District</Text>
                <Text style={styles.detailValue}>{beneficiary.district_name || 'Coimbatore'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Block / Taluk</Text>
                <Text style={styles.detailValue}>{beneficiary.block_name || 'Block'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Panchayat</Text>
                <Text style={styles.detailValue}>{beneficiary.panchayat_name || 'Panchayat'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Village (LGD)</Text>
                <Text style={styles.detailValue}>{beneficiary.village_name || 'Village'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address Line 1</Text>
                <Text style={styles.detailValue}>{beneficiary.address_line1 || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pincode</Text>
                <Text style={styles.detailValue}>{beneficiary.pincode || '—'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* TAB 2: LAND HOLDINGS & PARCELS */}
        {activeTab === 'LAND' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title={`Land Holdings (${beneficiary.land_holdings?.length || 0})`} />
              <Button
                title="+ Add Holding"
                variant="primary"
                size="sm"
                onPress={() => setShowAddHoldingSheet(true)}
              />
            </View>

            {beneficiary.land_holdings && beneficiary.land_holdings.length > 0 ? (
              beneficiary.land_holdings.map((h, idx) => (
                <View key={h.holding_id} style={styles.holdingCard}>
                  <View style={styles.holdingHeader}>
                    <View>
                      <Text style={styles.holdingTitle}>Holding #{idx + 1} • {h.project_name || 'Scheme'}</Text>
                      <Text style={styles.holdingMeta}>Declared: {h.declared_total_area} acres • ID: {h.holding_id.slice(0, 8)}</Text>
                    </View>
                    <StatusBadge status={h.status} />
                  </View>

                  <View style={styles.parcelListContainer}>
                    <Text style={styles.parcelListHeader}>Survey & SF Subdivision Parcels:</Text>
                    {h.parcels && h.parcels.length > 0 ? (
                      h.parcels.map((p) => (
                        <View key={p.parcel_id} style={styles.parcelRow}>
                          <View style={styles.parcelIcon}>
                            <Feather name="map-pin" size={14} color={colors.primary} />
                          </View>
                          <View style={styles.parcelInfo}>
                            <Text style={styles.parcelText}>
                              Survey SF <Text style={styles.parcelEmph}>{p.survey_number}</Text> / Subdiv <Text style={styles.parcelEmph}>{p.subdivision_number}</Text>
                            </Text>
                            <Text style={styles.parcelArea}>{p.area} acres</Text>
                          </View>
                          <StatusBadge status={p.status} />
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noParcelText}>No survey parcels added yet.</Text>
                    )}
                  </View>

                  <View style={styles.holdingActionRow}>
                    <Button
                      title="+ Add Parcel"
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        setTargetHoldingId(h.holding_id);
                        setShowAddParcelSheet(true);
                      }}
                    />
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                icon={<Feather name="map-pin" size={32} color={colors.textSecondary} />}
                title="No Land Holdings"
                description="This beneficiary does not have any registered land holdings."
                actionTitle="Add Land Holding"
                onAction={() => setShowAddHoldingSheet(true)}
              />
            )}
          </View>
        )}

        {/* TAB 3: WATER APPLICATIONS & ALLOTMENTS */}
        {activeTab === 'WATER' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="Water Allocations & Quotas" />
              <Button
                title="+ Apply Water"
                variant="primary"
                size="sm"
                onPress={() => setShowWaterAppSheet(true)}
              />
            </View>

            {/* Sub-tab: Current vs History */}
            <View style={styles.subTabRow}>
              <TouchableOpacity
                style={[styles.subTabPill, waterSubTab === 'CURRENT' && styles.subTabPillActive]}
                onPress={() => setWaterSubTab('CURRENT')}
              >
                <Text style={[styles.subTabText, waterSubTab === 'CURRENT' && styles.subTabTextActive]}>
                  Current ({currentWaterApps.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTabPill, waterSubTab === 'HISTORY' && styles.subTabPillActive]}
                onPress={() => setWaterSubTab('HISTORY')}
              >
                <Text style={[styles.subTabText, waterSubTab === 'HISTORY' && styles.subTabTextActive]}>
                  History ({historyWaterApps.length})
                </Text>
              </TouchableOpacity>
            </View>

            {waterSubTab === 'CURRENT' ? (
              currentWaterApps.length > 0 ? (
                currentWaterApps.map((a) => (
                  <View key={a.application_id} style={styles.waterCard}>
                    <View style={styles.waterCardHeader}>
                      <View>
                        <Text style={styles.waterTitle}>Application #{a.application_id.slice(-6)}</Text>
                        <Text style={styles.waterDate}>{new Date(a.created_at).toLocaleDateString()}</Text>
                      </View>
                      <StatusBadge status={a.status} />
                    </View>

                    {/* Breakdown Hierarchy */}
                    <View style={styles.waterQuotaBox}>
                      <View style={styles.quotaCol}>
                        <Text style={styles.quotaLabel}>Required</Text>
                        <Text style={styles.quotaValPrimary}>{a.required_litres.toLocaleString()} L</Text>
                      </View>
                      <View style={styles.quotaDivider} />
                      <View style={styles.quotaCol}>
                        <Text style={styles.quotaLabel}>Calculated</Text>
                        <Text style={styles.quotaValSecondary}>{a.calculated_litres?.toLocaleString() || '—'} L</Text>
                      </View>
                      <View style={styles.quotaDivider} />
                      <View style={styles.quotaCol}>
                        <Text style={styles.quotaLabel}>Allotted</Text>
                        <Text style={styles.quotaValApproved}>
                          {a.allotment ? `${a.allotment.approved_litres.toLocaleString()} L` : 'Pending'}
                        </Text>
                      </View>
                    </View>

                    {isAdmin && a.status === 'SUBMITTED' && (
                      <View style={styles.adminActionRow}>
                        <Button
                          title="Approve Quota"
                          variant="primary"
                          size="sm"
                          onPress={() => router.push(`/(app)/water`)}
                        />
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <EmptyState
                  icon={<Feather name="droplets" size={32} color={colors.primary} />}
                  title="No Active Water Applications"
                  description="Submit a water application to calculate quota and generate development billing."
                  actionTitle="Submit Application"
                  onAction={() => setShowWaterAppSheet(true)}
                />
              )
            ) : (
              historyWaterApps.length > 0 ? (
                historyWaterApps.map((a) => (
                  <View key={a.application_id} style={styles.waterCard}>
                    <View style={styles.waterCardHeader}>
                      <View>
                        <Text style={styles.waterTitle}>Historical App #{a.application_id.slice(-6)}</Text>
                        <Text style={styles.waterDate}>{new Date(a.updated_at || a.created_at).toLocaleDateString()}</Text>
                      </View>
                      <StatusBadge status={a.status} />
                    </View>
                    <Text style={styles.waterRemarks}>Remarks: {a.remarks || 'No remarks recorded'}</Text>
                  </View>
                ))
              ) : (
                <EmptyState
                  icon={<Feather name="clock" size={32} color={colors.textSecondary} />}
                  title="No Application History"
                  description="No rejected or cancelled historical water applications found."
                />
              )
            )}
          </View>
        )}

        {/* TAB 4: BILLING & 5-STAGE MILESTONES */}
        {activeTab === 'BILLING' && (
          <View style={styles.tabContent}>
            <SectionHeader title="Development Milestones & Installments" />
            {beneficiary.development_bills && beneficiary.development_bills.length > 0 ? (
              beneficiary.development_bills.map((bill) => (
                <View key={bill.bill_id} style={styles.billContainer}>
                  <View style={styles.billSummaryHeader}>
                    <View>
                      <Text style={styles.billTitle}>Development Bill #{bill.bill_id.slice(-6)}</Text>
                      <Text style={styles.billMeta}>Total: ₹{bill.total_amount.toLocaleString()} • Paid: ₹{bill.amount_paid.toLocaleString()}</Text>
                    </View>
                    <StatusBadge status={bill.status} />
                  </View>

                  <View style={styles.installmentsList}>
                    {bill.installments?.map((inst) => (
                      <View key={inst.installment_id} style={styles.installmentRow}>
                        <View style={styles.instNumberPill}>
                          <Text style={styles.instNumberText}>0{inst.installment_number}</Text>
                        </View>
                        <View style={styles.instDetails}>
                          <Text style={styles.instName}>{inst.milestone_name || `Milestone ${inst.installment_number}`}</Text>
                          <Text style={styles.instAmount}>
                            {inst.percentage}% • ₹{inst.amount_due.toLocaleString()} (Pending: ₹{inst.pending_amount.toLocaleString()})
                          </Text>
                        </View>
                        <StatusBadge status={inst.status} />
                      </View>
                    ))}
                  </View>

                  {bill.pending_amount > 0 && (
                    <Button
                      title="Record Payment for Bill"
                      variant="primary"
                      size="sm"
                      style={{ marginTop: spacing.md }}
                      onPress={() => {
                        setSelectedBillId(bill.bill_id);
                        setShowPaymentSheet(true);
                      }}
                    />
                  )}
                </View>
              ))
            ) : (
              <EmptyState
                icon={<Feather name="credit-card" size={32} color={colors.textSecondary} />}
                title="No Billing Records"
                description="Development bills are automatically generated upon water application approval."
              />
            )}
          </View>
        )}

        {/* TAB 5: PAYMENTS & RECEIPTS */}
        {activeTab === 'PAYMENTS' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title={`Payment Receipts (${beneficiary.payments?.length || 0})`} />
              <Button
                title="+ New Payment"
                variant="primary"
                size="sm"
                onPress={() => setShowPaymentSheet(true)}
              />
            </View>

            {beneficiary.payments && beneficiary.payments.length > 0 ? (
              beneficiary.payments.map((p) => (
                <TouchableOpacity
                  key={p.payment_id}
                  style={styles.paymentCard}
                  onPress={() => handleOpenReceipt(p.payment_id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentLeft}>
                    <View style={styles.paymentIconCircle}>
                      <Feather name="check" size={16} color={colors.success} />
                    </View>
                    <View>
                      <Text style={styles.paymentAmount}>₹{p.amount.toLocaleString()}</Text>
                      <Text style={styles.paymentReceipt}>Receipt #{p.receipt_number} • {p.payment_mode}</Text>
                      <Text style={styles.paymentDate}>{new Date(p.payment_date).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  <View style={styles.paymentRight}>
                    <StatusBadge status={p.status} />
                    <Text style={styles.viewReceiptLink}>View Receipt →</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <EmptyState
                icon={<Feather name="file-text" size={32} color={colors.textSecondary} />}
                title="No Payments Recorded"
                description="Collect installment dues and issue digital offline receipts."
                actionTitle="Record Payment"
                onAction={() => setShowPaymentSheet(true)}
              />
            )}
          </View>
        )}

        {/* TAB 6: INFRASTRUCTURE */}
        {activeTab === 'INFRASTRUCTURE' && (
          <View style={styles.tabContent}>
            <SectionHeader title="Pipeline Distribution Lines" />
            {beneficiary.infrastructure && beneficiary.infrastructure.length > 0 ? (
              beneficiary.infrastructure.map((inf) => (
                <View key={inf.infrastructure_id} style={styles.infraCard}>
                  <View style={styles.infraHeader}>
                    <View>
                      <Text style={styles.infraTitle}>Infrastructure Line #{inf.infrastructure_id.slice(-6)}</Text>
                      <Text style={styles.infraMeta}>Allotment: #{inf.allotment_id.slice(-6)}</Text>
                    </View>
                    <StatusBadge status={inf.status} />
                  </View>
                  <Text style={styles.infraRemarks}>{inf.remarks || 'Standard distribution network'}</Text>
                </View>
              ))
            ) : (
              <EmptyState
                icon={<Feather name="activity" size={32} color={colors.secondary} />}
                title="No Infrastructure Records"
                description="Infrastructure distribution lines are tracked once allotments are approved."
              />
            )}
          </View>
        )}

        {/* TAB 7: EXTENSIONS */}
        {activeTab === 'EXTENSIONS' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="Water Quota Extensions" />
              <Button
                title="+ Request Extension"
                variant="primary"
                size="sm"
                onPress={() => setShowExtensionSheet(true)}
              />
            </View>

            {beneficiary.extensions && beneficiary.extensions.length > 0 ? (
              beneficiary.extensions.map((ext) => (
                <View key={ext.extension_id} style={styles.extCard}>
                  <View style={styles.extHeader}>
                    <View>
                      <Text style={styles.extTitle}>Extension #{ext.extension_id.slice(-6)}</Text>
                      <Text style={styles.extMeta}>Requested: {ext.requested_additional_litres} L ({ext.requested_additional_area} ac)</Text>
                    </View>
                    <StatusBadge status={ext.status} />
                  </View>
                  {ext.extension_cost ? (
                    <Text style={styles.extCost}>Extension Cost: ₹{ext.extension_cost.toLocaleString()}</Text>
                  ) : null}
                </View>
              ))
            ) : (
              <EmptyState
                icon={<Feather name="git-pull-request" size={32} color={colors.accent.indigo} />}
                title="No Extensions Requested"
                description="Beneficiaries can request additional water allocations for expanding land."
                actionTitle="Request Extension"
                onAction={() => setShowExtensionSheet(true)}
              />
            )}
          </View>
        )}

        {/* TAB 8: DOCUMENTS */}
        {activeTab === 'DOCUMENTS' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeaderRow}>
              <SectionHeader title="Attached Documents" />
              <Button
                title="+ Attach Doc"
                variant="primary"
                size="sm"
                onPress={() => setShowDocSheet(true)}
              />
            </View>

            {beneficiary.documents && beneficiary.documents.length > 0 ? (
              beneficiary.documents.map((doc) => (
                <ListItem
                  key={doc.document_id}
                  title={doc.title}
                  subtitle={`${doc.category} • ${doc.file_name}`}
                  meta={new Date(doc.created_at).toLocaleDateString()}
                  icon={<Feather name="file-text" size={18} color={colors.primary} />}
                  onPress={() => showToast({ message: `Opening ${doc.file_name}`, type: 'info' })}
                />
              ))
            ) : (
              <EmptyState
                icon={<Feather name="file-text" size={32} color={colors.textSecondary} />}
                title="No Documents Attached"
                description="Attach Aadhaar, Patta, Chitta, or Survey maps to this profile."
                actionTitle="Attach Document"
                onAction={() => setShowDocSheet(true)}
              />
            )}
          </View>
        )}

        {/* TAB 9: AUDIT HISTORY */}
        {activeTab === 'HISTORY' && (
          <View style={styles.tabContent}>
            <SectionHeader title="Local Audit Trail" />
            {auditLogs.length > 0 ? (
              auditLogs.map((log) => (
                <View key={log.audit_id} style={styles.auditRow}>
                  <View style={styles.auditDot} />
                  <View style={styles.auditInfo}>
                    <Text style={styles.auditAction}>{log.action} by {log.user_id}</Text>
                    <Text style={styles.auditDate}>{new Date(log.timestamp).toLocaleString()}</Text>
                    {log.details_json ? (
                      <Text style={styles.auditDetails}>{log.details_json}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                icon={<Feather name="clock" size={32} color={colors.textSecondary} />}
                title="No Audit History"
                description="All operational mutations for this beneficiary will appear here."
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* 1. Edit Profile Sheet */}
      <BottomSheet
        visible={showEditProfileSheet}
        onClose={() => setShowEditProfileSheet(false)}
        title="Edit Beneficiary Profile"
        subtitle="Update contact and location details"
      >
        <Input label="Full Name" value={editName} onChangeText={setEditName} />
        <Input label="Phone Number" value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
        <Input label="Email Address" value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" />
        <Input label="Address Line 1" value={editAddress1} onChangeText={setEditAddress1} />
        <Input label="Address Line 2" value={editAddress2} onChangeText={setEditAddress2} />
        <Input label="Pincode" value={editPincode} onChangeText={setEditPincode} keyboardType="number-pad" />
        <Button
          title="Save Profile Updates"
          onPress={handleSaveProfile}
          loading={savingProfile}
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      </BottomSheet>

      {/* 2. Add Land Holding & Parcels Sheet */}
      <BottomSheet
        visible={showAddHoldingSheet}
        onClose={() => setShowAddHoldingSheet(false)}
        title="Add Land Holding"
        subtitle="Register survey parcels with area validation"
      >
        <Text style={styles.sheetLabel}>Project Scheme</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectPillsRow}>
          {projects.map((p) => (
            <TouchableOpacity
              key={p.project_id}
              style={[styles.projectPill, selectedProjectId === p.project_id && styles.projectPillActive]}
              onPress={() => setSelectedProjectId(p.project_id)}
            >
              <Text style={[styles.projectPillText, selectedProjectId === p.project_id && styles.projectPillTextActive]}>
                {p.project_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Input
          label="Declared Total Area (acres)"
          value={declaredArea}
          onChangeText={setDeclaredArea}
          keyboardType="decimal-pad"
          placeholder="e.g. 5.50"
        />

        <Text style={styles.sheetLabel}>Survey Parcels:</Text>
        {holdingParcels.map((p, idx) => (
          <View key={idx} style={styles.parcelInputRow}>
            <Input
              label={`SF No. #${idx + 1}`}
              value={p.survey_number}
              onChangeText={(val) => {
                const updated = [...holdingParcels];
                updated[idx].survey_number = val;
                setHoldingParcels(updated);
              }}
              containerStyle={{ flex: 1, marginRight: 6 }}
              placeholder="e.g. 124"
            />
            <Input
              label="Subdiv"
              value={p.subdivision_number}
              onChangeText={(val) => {
                const updated = [...holdingParcels];
                updated[idx].subdivision_number = val;
                setHoldingParcels(updated);
              }}
              containerStyle={{ width: 60, marginRight: 6 }}
              placeholder="1"
            />
            <Input
              label="Acres"
              value={p.area ? String(p.area) : ''}
              onChangeText={(val) => {
                const updated = [...holdingParcels];
                updated[idx].area = parseFloat(val) || 0;
                setHoldingParcels(updated);
              }}
              keyboardType="decimal-pad"
              containerStyle={{ width: 80 }}
              placeholder="0.0"
            />
          </View>
        ))}

        <Button
          title="+ Add Another Parcel Row"
          variant="outline"
          size="sm"
          onPress={() =>
            setHoldingParcels([...holdingParcels, { survey_number: '', subdivision_number: '1', area: 0 }])
          }
          style={{ marginBottom: spacing.md }}
        />

        <Button
          title="Save Land Holding"
          onPress={handleAddHolding}
          loading={savingHolding}
          fullWidth
        />
      </BottomSheet>

      {/* 3. Add Parcel to Existing Holding Sheet */}
      <BottomSheet
        visible={showAddParcelSheet}
        onClose={() => setShowAddParcelSheet(false)}
        title="Attach Survey Parcel"
        subtitle="Add a parcel to this holding"
      >
        <Input label="Survey / SF Number" value={newSurveyNumber} onChangeText={setNewSurveyNumber} placeholder="e.g. 182" />
        <Input label="Subdivision" value={newSubdivision} onChangeText={setNewSubdivision} placeholder="e.g. 2A" />
        <Input label="Parcel Area (acres)" value={newParcelArea} onChangeText={setNewParcelArea} keyboardType="decimal-pad" placeholder="e.g. 1.25" />
        <Button
          title="Attach Parcel"
          onPress={handleAddParcel}
          loading={savingParcel}
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      </BottomSheet>

      {/* 4. Request Water Application Sheet */}
      <BottomSheet
        visible={showWaterAppSheet}
        onClose={() => setShowWaterAppSheet(false)}
        title="Apply for Water Quota"
        subtitle="Request irrigation quota for registered land"
      >
        <Text style={styles.sheetLabel}>Select Land Holding</Text>
        {beneficiary.land_holdings?.map((h) => (
          <TouchableOpacity
            key={h.holding_id}
            style={[styles.holdingSelectOption, waterHoldingId === h.holding_id && styles.holdingSelectActive]}
            onPress={() => setWaterHoldingId(h.holding_id)}
          >
            <Text style={styles.holdingSelectText}>{h.project_name || 'Scheme'} • {h.declared_total_area} acres</Text>
          </TouchableOpacity>
        ))}

        <Input
          label="Requested Water (Litres)"
          value={requiredLitres}
          onChangeText={setRequiredLitres}
          keyboardType="number-pad"
        />
        <Input
          label="Remarks (optional)"
          value={waterRemarks}
          onChangeText={setWaterRemarks}
          placeholder="Crop type, seasonal requirement, etc."
        />
        <Button
          title="Submit Application"
          onPress={handleRequestWater}
          loading={savingWaterApp}
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      </BottomSheet>

      {/* 5. Request Extension Sheet */}
      <BottomSheet
        visible={showExtensionSheet}
        onClose={() => setShowExtensionSheet(false)}
        title="Request Quota Extension"
        subtitle="Expand existing water allocation"
      >
        <Input
          label="Additional Area (acres)"
          value={extArea}
          onChangeText={setExtArea}
          keyboardType="decimal-pad"
        />
        <Input
          label="Requested Additional Litres"
          value={extLitres}
          onChangeText={setExtLitres}
          keyboardType="number-pad"
        />
        <Input
          label="Reason for Extension"
          value={extRemarks}
          onChangeText={setExtRemarks}
          placeholder="e.g. Additional acreage brought under drip irrigation"
        />
        <Button
          title="Submit Extension Request"
          onPress={handleRequestExtension}
          loading={savingExtension}
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      </BottomSheet>

      {/* 6. Record Payment Sheet */}
      <BottomSheet
        visible={showPaymentSheet}
        onClose={() => setShowPaymentSheet(false)}
        title="Record Payment"
        subtitle="Collect installment dues and issue instant receipt"
      >
        <Input
          label="Payment Amount (₹)"
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          keyboardType="decimal-pad"
          placeholder="e.g. 5000"
        />

        <Text style={styles.sheetLabel}>Payment Mode</Text>
        <View style={styles.modeRow}>
          {(['CASH', 'UPI', 'NEFT', 'CHEQUE'] as PaymentMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.modePill, paymentMode === mode && styles.modePillActive]}
              onPress={() => setPaymentMode(mode)}
            >
              <Text style={[styles.modeText, paymentMode === mode && styles.modeTextActive]}>
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Transaction Reference / Cheque #"
          value={paymentRef}
          onChangeText={setPaymentRef}
          placeholder="e.g. UPI-984718294719"
        />

        <Button
          title="Confirm Payment & Issue Receipt"
          onPress={handleRecordPayment}
          loading={submittingPayment}
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      </BottomSheet>

      {/* 7. View Receipt Modal */}
      <BottomSheet
        visible={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        title="Payment Receipt"
        subtitle="Official WaterGrid Transaction Voucher"
      >
        {selectedReceipt && (
          <View style={styles.receiptContainer}>
            <View style={styles.receiptHeader}>
              <Feather name="check-circle" size={36} color={colors.success} />
              <Text style={styles.receiptSuccessText}>Payment Confirmed</Text>
              <Text style={styles.receiptNumber}>Receipt #: {selectedReceipt.payment.receipt_number}</Text>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Beneficiary</Text>
              <Text style={styles.receiptVal}>{selectedReceipt.beneficiaryName}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Phone</Text>
              <Text style={styles.receiptVal}>{selectedReceipt.beneficiaryPhone}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Village</Text>
              <Text style={styles.receiptVal}>{selectedReceipt.villageName}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Amount Paid</Text>
              <Text style={styles.receiptValBold}>₹{selectedReceipt.payment.amount.toLocaleString()}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Payment Mode</Text>
              <Text style={styles.receiptVal}>{selectedReceipt.payment.payment_mode}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Date & Time</Text>
              <Text style={styles.receiptVal}>{new Date(selectedReceipt.payment.payment_date).toLocaleString()}</Text>
            </View>

            <View style={styles.receiptActionsRow}>
              <Button
                title="Share Receipt"
                variant="outline"
                size="sm"
                icon={<Feather name="share-2" size={16} color={colors.primary} />}
                onPress={handleShareReceipt}
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Close"
                variant="primary"
                size="sm"
                onPress={() => setShowReceiptModal(false)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </BottomSheet>

      {/* 8. Attach Document Sheet */}
      <BottomSheet
        visible={showDocSheet}
        onClose={() => setShowDocSheet(false)}
        title="Attach Document"
        subtitle="Store official land/identity certificates locally"
      >
        <Input label="Document Title" value={docTitle} onChangeText={setDocTitle} placeholder="e.g. Patta Passbook Copy" />
        <Text style={styles.sheetLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectPillsRow}>
          {(['LAND_RECORD', 'PATTA', 'CHITTA', 'ID_PROOF', 'NOC', 'OTHER'] as DocumentCategory[]).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.projectPill, docCategory === cat && styles.projectPillActive]}
              onPress={() => setDocCategory(cat)}
            >
              <Text style={[styles.projectPillText, docCategory === cat && styles.projectPillTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Input label="File Name (simulated)" value={docFileName} onChangeText={setDocFileName} placeholder="patta_doc_scan.pdf" />
        <Button
          title="Attach Document Record"
          onPress={handleAddDocument}
          loading={submittingDoc}
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      </BottomSheet>

      {/* 9. Deactivate / Reactivate Status Sheet */}
      <BottomSheet
        visible={showStatusSheet}
        onClose={() => setShowStatusSheet(false)}
        title={beneficiary.status === 'ACTIVE' ? 'Deactivate Beneficiary' : 'Reactivate Beneficiary'}
        subtitle="Manage administrative operational status"
      >
        {obligations?.hasObligations && beneficiary.status === 'ACTIVE' && (
          <View style={styles.warningBox}>
            <Feather name="alert-triangle" size={18} color={colors.warning} />
            <Text style={styles.warningBoxText}>{obligations.warningMessage}</Text>
          </View>
        )}

        <Input
          label="Reason for status change"
          value={statusReason}
          onChangeText={setStatusReason}
          placeholder="e.g. Land sale / transferred ownership / seasonal closure"
        />

        <Button
          title={beneficiary.status === 'ACTIVE' ? 'Confirm Deactivation' : 'Confirm Reactivation'}
          variant={beneficiary.status === 'ACTIVE' ? 'destructive' : 'primary'}
          onPress={handleToggleStatus}
          loading={submittingStatus}
          fullWidth
          style={{ marginTop: spacing.md }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: typography.fontSize.body,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.medium,
  },
  profileCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  profileName: {
    fontSize: typography.fontSize.heading,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  profilePhone: {
    fontSize: typography.fontSize.body,
    color: colors.primary,
    fontFamily: typography.fontFamily.medium,
  },
  profileLocation: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontFamily: typography.fontFamily.regular,
  },
  profileActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tabWrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabContent: {
    padding: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  detailLabel: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.regular,
  },
  detailValue: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.medium,
  },
  holdingCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
    paddingBottom: spacing.sm,
  },
  holdingTitle: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  holdingMeta: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  parcelListContainer: {
    marginTop: spacing.sm,
  },
  parcelListHeader: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  parcelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: 4,
  },
  parcelIcon: {
    marginRight: spacing.sm,
  },
  parcelInfo: {
    flex: 1,
  },
  parcelText: {
    fontSize: typography.fontSize.caption,
    color: colors.textPrimary,
  },
  parcelEmph: {
    fontWeight: '700',
    color: colors.primary,
  },
  parcelArea: {
    fontSize: typography.fontSize.micro,
    color: colors.textSecondary,
  },
  noParcelText: {
    fontSize: typography.fontSize.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  holdingActionRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.md,
  },
  subTabPill: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  subTabPillActive: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  subTabText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  subTabTextActive: {
    color: colors.primary,
  },
  waterCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  waterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  waterTitle: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  waterDate: {
    fontSize: typography.fontSize.tiny,
    color: colors.textSecondary,
  },
  waterQuotaBox: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  quotaCol: {
    flex: 1,
    alignItems: 'center',
  },
  quotaDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  quotaLabel: {
    fontSize: typography.fontSize.micro,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  quotaValPrimary: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  quotaValSecondary: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  quotaValApproved: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.success,
  },
  waterRemarks: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  adminActionRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  billContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  billSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  billTitle: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  billMeta: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  installmentsList: {
    marginTop: spacing.sm,
  },
  installmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  instNumberPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  instNumberText: {
    fontSize: typography.fontSize.tiny,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  instDetails: {
    flex: 1,
  },
  instName: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  instAmount: {
    fontSize: typography.fontSize.micro,
    color: colors.textSecondary,
  },
  paymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  paymentAmount: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  paymentReceipt: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  paymentDate: {
    fontSize: typography.fontSize.micro,
    color: colors.textMuted,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  viewReceiptLink: {
    fontSize: typography.fontSize.micro,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
  },
  infraCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  infraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infraTitle: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infraMeta: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  infraRemarks: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  extCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  extHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  extTitle: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  extMeta: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  extCost: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.accent.indigo,
    marginTop: spacing.xs,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  auditDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  auditInfo: {
    flex: 1,
  },
  auditAction: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  auditDate: {
    fontSize: typography.fontSize.micro,
    color: colors.textSecondary,
    marginTop: 2,
  },
  auditDetails: {
    fontSize: typography.fontSize.micro,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: typography.fontFamily.mono,
  },
  sheetLabel: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  projectPillsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  projectPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    marginRight: spacing.xs,
  },
  projectPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  projectPillText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  projectPillTextActive: {
    color: colors.primary,
  },
  parcelInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  holdingSelectOption: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    marginBottom: spacing.xs,
  },
  holdingSelectActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  holdingSelectText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  modePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  modePillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  modeText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeTextActive: {
    color: colors.primary,
  },
  receiptContainer: {
    padding: spacing.sm,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  receiptSuccessText: {
    fontSize: typography.fontSize.heading,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  receiptNumber: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  receiptLabel: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
  },
  receiptVal: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  receiptValBold: {
    fontSize: typography.fontSize.subheading,
    fontWeight: '700',
    color: colors.success,
  },
  receiptActionsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  warningBoxText: {
    flex: 1,
    fontSize: typography.fontSize.caption,
    color: colors.warning,
    fontWeight: '500',
  },
});
