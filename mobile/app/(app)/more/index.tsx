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
import { ListItem } from '../../../src/components/ListItem';
import { Avatar } from '../../../src/components/Avatar';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { BottomSheet } from '../../../src/components/BottomSheet';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { useAuth } from '../../../src/auth/AuthContext';
import { useToast } from '../../../src/components/Toast';
import { Feather } from '../../../src/components/Icon';
import { ProjectRepository } from '../../../src/repositories/ProjectRepository';
import { RateRepository } from '../../../src/repositories/RateRepository';
import { ProjectScheme, RateTariff } from '../../../src/types/domain';

const projectRepo = new ProjectRepository();
const rateRepo = new RateRepository();

export default function MoreScreen() {
  const router = useRouter();
  const { user, isAdmin, switchRole, logout } = useAuth();
  const { showToast } = useToast();

  // Project Schemes State
  const [showProjectsSheet, setShowProjectsSheet] = useState(false);
  const [projectsList, setProjectsList] = useState<(ProjectScheme & { holdings_count?: number; apps_count?: number })[]>([]);
  const [newProjectCode, setNewProjectCode] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  // Rate Tariffs State
  const [showRatesSheet, setShowRatesSheet] = useState(false);
  const [activeRates, setActiveRates] = useState<RateTariff[]>([]);
  const [selectedProjectIdForRate, setSelectedProjectIdForRate] = useState('');
  const [newLitresPerAcre, setNewLitresPerAcre] = useState('5000');
  const [newDevCost, setNewDevCost] = useState('15.00');
  const [newRunCost, setNewRunCost] = useState('1.50');
  const [rateEffectiveDate, setRateEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingRate, setSavingRate] = useState(false);

  const loadMasterData = async () => {
    try {
      const [projs, rates] = await Promise.all([
        projectRepo.getAll(),
        rateRepo.getAllActiveRates(),
      ]);
      setProjectsList(projs);
      setActiveRates(rates);
      if (projs.length > 0 && !selectedProjectIdForRate) {
        setSelectedProjectIdForRate(projs[0].project_id);
      }
    } catch (err) {
      console.error('Error loading master data:', err);
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  const handleRoleToggle = async () => {
    const nextRole = isAdmin ? 'FIELD_OFFICER' : 'ADMIN';
    await switchRole(nextRole);
    showToast({
      message: `Switched profile to ${nextRole === 'ADMIN' ? 'Admin' : 'Field Officer'}`,
      type: 'success',
    });
  };

  const handleSignOut = async () => {
    await logout();
    showToast({ message: 'Signed out of device', type: 'info' });
    router.replace('/(auth)/login');
  };

  // Create Project Scheme
  const handleCreateProject = async () => {
    if (!newProjectCode.trim() || !newProjectName.trim()) {
      showToast({ message: 'Code and Name are required', type: 'warning' });
      return;
    }

    setSavingProject(true);
    try {
      await projectRepo.create({
        project_code: newProjectCode.trim().toUpperCase(),
        project_name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
        created_by: user?.name || 'ADMIN',
      });
      showToast({ message: '✓ Project scheme created', type: 'success' });
      setNewProjectCode('');
      setNewProjectName('');
      setNewProjectDesc('');
      await loadMasterData();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to create project', type: 'error' });
    } finally {
      setSavingProject(false);
    }
  };

  // Toggle Project Status
  const handleToggleProject = async (projectId: string) => {
    try {
      const updated = await projectRepo.toggleStatus(projectId, user?.name);
      showToast({ message: `Project is now ${updated.status}`, type: 'info' });
      await loadMasterData();
    } catch (err: any) {
      showToast({ message: err.message || 'Toggle failed', type: 'error' });
    }
  };

  // Create New Versioned Rate Tariff
  const handleCreateRateVersion = async () => {
    if (!selectedProjectIdForRate) {
      showToast({ message: 'Select a project scheme', type: 'warning' });
      return;
    }

    setSavingRate(true);
    try {
      await rateRepo.createNewVersion({
        project_id: selectedProjectIdForRate,
        litres_per_acre: parseFloat(newLitresPerAcre) || 5000,
        development_cost_per_litre: parseFloat(newDevCost) || 15.00,
        running_cost_per_litre: parseFloat(newRunCost) || 1.50,
        effective_from: rateEffectiveDate || new Date().toISOString().split('T')[0],
        reason: 'Versioned tariff revision via mobile admin console',
        created_by: user?.name || 'ADMIN',
      });

      showToast({ message: '✓ New versioned rate tariff published', type: 'success' });
      await loadMasterData();
    } catch (err: any) {
      showToast({ message: err.message || 'Rate creation failed', type: 'error' });
    } finally {
      setSavingRate(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header title="More Operations" subtitle="Tools, billing, & settings" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Avatar name={user?.name || 'WaterGrid User'} size={56} />
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>{user?.name || 'Field Officer'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'field@watergrid.local'}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>
                {user?.role === 'ADMIN' ? 'Administrator' : 'Field Operations Officer'}
              </Text>
            </View>
          </View>
        </View>

        {/* Modules & Operations */}
        <SectionHeader title="Operational Modules" />
        <View style={styles.groupCard}>
          <ListItem
            title="5-Stage Development Billing"
            subtitle="Installment milestones & payment receipts"
            icon={<Feather name="credit-card" size={18} color={colors.primary} />}
            onPress={() => router.push('/(app)/billing')}
          />
          <ListItem
            title="Distribution Infrastructure"
            subtitle="Line tracking, valves, & commissioning"
            icon={<Feather name="activity" size={18} color={colors.secondary} />}
            onPress={() => router.push('/(app)/infrastructure')}
          />
          <ListItem
            title="Water Quota Extensions"
            subtitle="Request additional litres & calculate tariffs"
            icon={<Feather name="git-pull-request" size={18} color={colors.accent.indigo} />}
            onPress={() => router.push('/(app)/extensions')}
          />
          <ListItem
            title="Analytics & Executive Reports"
            subtitle="Collections, demand quotas, & village coverage"
            icon={<Feather name="bar-chart-2" size={18} color={colors.accent.emerald} />}
            onPress={() => router.push('/(app)/reports')}
            borderBottom={false}
          />
        </View>

        {/* Admin Master Data Section */}
        {isAdmin && (
          <>
            <SectionHeader title="Master Data Configuration" />
            <View style={styles.groupCard}>
              <ListItem
                title={`Project Schemes (${projectsList.length})`}
                subtitle="Manage irrigation schemes, quotas & active status"
                icon={<Feather name="layers" size={18} color={colors.primary} />}
                onPress={() => setShowProjectsSheet(true)}
              />
              <ListItem
                title={`Rate Tariffs (${activeRates.length} Active)`}
                subtitle="Configure litres/acre, development & running rates"
                icon={<Feather name="sliders" size={18} color={colors.secondary} />}
                onPress={() => setShowRatesSheet(true)}
                borderBottom={false}
              />
            </View>
          </>
        )}

        {/* Sync & System */}
        <SectionHeader title="Device & Synchronization" />
        <View style={styles.groupCard}>
          <ListItem
            title="Offline Sync Center"
            subtitle="Pending queue, sync history, & retry failed ops"
            icon={<Feather name="refresh-cw" size={18} color={colors.warning} />}
            onPress={() => router.push('/(app)/sync')}
          />
          <ListItem
            title="Registration Drafts"
            subtitle="Incomplete offline onboarding sessions"
            icon={<Feather name="file-text" size={18} color={colors.textSecondary} />}
            onPress={() => router.push('/(app)/drafts')}
          />
          <ListItem
            title="Developer & Diagnostics Portal"
            subtitle="SQLite schema inspector, audit logs, & clean state"
            icon={<Feather name="terminal" size={18} color={colors.textPrimary} />}
            onPress={() => router.push('/(app)/developer')}
            borderBottom={false}
          />
        </View>

        {/* Profile Switching & Logout */}
        <SectionHeader title="Session Management" />
        <View style={styles.groupCard}>
          <ListItem
            title={`Switch to ${isAdmin ? 'Field Officer' : 'Admin'} Mode`}
            subtitle="Toggle mobile RBAC context"
            icon={<Feather name="repeat" size={18} color={colors.primary} />}
            onPress={handleRoleToggle}
          />
          <ListItem
            title="Sign Out"
            subtitle="Lock offline session on this device"
            icon={<Feather name="log-out" size={18} color={colors.danger} />}
            onPress={handleSignOut}
            borderBottom={false}
          />
        </View>

        <View style={styles.appFooter}>
          <Text style={styles.versionText}>WaterGrid Mobile Client • v1.0.0-offline</Text>
          <Text style={styles.buildText}>SQLite Hermes Engine • Device Local Storage</Text>
        </View>
      </ScrollView>

      {/* Project Schemes Master Sheet */}
      <BottomSheet
        visible={showProjectsSheet}
        onClose={() => setShowProjectsSheet(false)}
        title="Project Schemes Master"
        subtitle="Manage and register irrigation schemes"
      >
        <Text style={styles.modalSubheading}>Existing Schemes:</Text>
        {projectsList.map((p) => (
          <View key={p.project_id} style={styles.masterItemCard}>
            <View style={styles.masterItemHeader}>
              <View>
                <Text style={styles.masterItemTitle}>{p.project_name} ({p.project_code})</Text>
                <Text style={styles.masterItemMeta}>{p.holdings_count || 0} Holdings • {p.apps_count || 0} Water Apps</Text>
              </View>
              <StatusBadge status={p.status} />
            </View>
            <Button
              title={p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              variant="subtle"
              size="sm"
              onPress={() => handleToggleProject(p.project_id)}
              style={{ marginTop: spacing.xs, alignSelf: 'flex-end' }}
            />
          </View>
        ))}

        <Text style={[styles.modalSubheading, { marginTop: spacing.lg }]}>+ Register New Scheme:</Text>
        <Input label="Scheme Code" value={newProjectCode} onChangeText={setNewProjectCode} placeholder="e.g. PRJ-KAVERI" />
        <Input label="Scheme Name" value={newProjectName} onChangeText={setNewProjectName} placeholder="e.g. Kaveri Basin Expansion" />
        <Input label="Description (optional)" value={newProjectDesc} onChangeText={setNewProjectDesc} placeholder="Scheme objectives..." />
        <Button
          title="Create Scheme"
          onPress={handleCreateProject}
          loading={savingProject}
          fullWidth
          style={{ marginTop: spacing.sm }}
        />
      </BottomSheet>

      {/* Rate Tariffs & Versioning Sheet */}
      <BottomSheet
        visible={showRatesSheet}
        onClose={() => setShowRatesSheet(false)}
        title="Rate Tariffs & Versioned Pricing"
        subtitle="Configure litres/acre and infrastructure development rates"
      >
        <Text style={styles.modalSubheading}>Active Tariffs:</Text>
        {activeRates.map((r) => (
          <View key={r.rate_id} style={styles.masterItemCard}>
            <Text style={styles.masterItemTitle}>{r.project_name || 'Project Tariff'}</Text>
            <View style={styles.rateGrid}>
              <View style={styles.rateTile}>
                <Text style={styles.rateTileLabel}>Litres/Acre</Text>
                <Text style={styles.rateTileVal}>{r.litres_per_acre.toLocaleString()} L</Text>
              </View>
              <View style={styles.rateTile}>
                <Text style={styles.rateTileLabel}>Dev Cost/Litre</Text>
                <Text style={styles.rateTileVal}>₹{r.development_cost_per_litre}</Text>
              </View>
              <View style={styles.rateTile}>
                <Text style={styles.rateTileLabel}>Running Cost/Litre</Text>
                <Text style={styles.rateTileVal}>₹{r.running_cost_per_litre}</Text>
              </View>
            </View>
          </View>
        ))}

        <Text style={[styles.modalSubheading, { marginTop: spacing.lg }]}>+ Publish New Versioned Tariff:</Text>
        <Text style={styles.fieldLabel}>Target Scheme</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
          {projectsList.map((p) => (
            <TouchableOpacity
              key={p.project_id}
              style={[styles.pill, selectedProjectIdForRate === p.project_id && styles.pillActive]}
              onPress={() => setSelectedProjectIdForRate(p.project_id)}
            >
              <Text style={[styles.pillText, selectedProjectIdForRate === p.project_id && styles.pillTextActive]}>
                {p.project_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Input label="Litres / Acre" value={newLitresPerAcre} onChangeText={setNewLitresPerAcre} keyboardType="numeric" />
        <Input label="Development Cost (₹ / Litre)" value={newDevCost} onChangeText={setNewDevCost} keyboardType="decimal-pad" />
        <Input label="Running Cost (₹ / Litre)" value={newRunCost} onChangeText={setNewRunCost} keyboardType="decimal-pad" />
        <Input label="Effective Date (YYYY-MM-DD)" value={rateEffectiveDate} onChangeText={setRateEffectiveDate} placeholder="2026-10-01" />

        <Button
          title="Publish Tariff Version"
          onPress={handleCreateRateVersion}
          loading={savingRate}
          fullWidth
          style={{ marginTop: spacing.sm }}
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  profileDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  profileName: {
    fontSize: typography.fontSize.heading,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.bold,
  },
  profileEmail: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
  },
  rolePillText: {
    fontSize: typography.fontSize.tiny,
    color: colors.primary,
    fontWeight: '600',
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  appFooter: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  versionText: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  buildText: {
    fontSize: typography.fontSize.tiny,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalSubheading: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  masterItemCard: {
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  masterItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  masterItemTitle: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  masterItemMeta: {
    fontSize: typography.fontSize.micro,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rateGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  rateTile: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  rateTileLabel: {
    fontSize: typography.fontSize.micro,
    color: colors.textSecondary,
  },
  rateTileVal: {
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: typography.fontSize.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  pillsRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    marginRight: spacing.xs,
  },
  pillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pillText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pillTextActive: {
    color: colors.primary,
  },
});
