import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { useToast } from '../../../src/components/Toast';
import { colors, spacing, borderRadius, typography, shadows } from '../../../src/constants/theme';
import { DraftRepository } from '../../../src/repositories/DraftRepository';
import { RegistrationDraft } from '../../../src/types/domain';
import { Feather } from '../../../src/components/Icon';

const draftRepo = new DraftRepository();

export default function DraftsScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [drafts, setDrafts] = useState<RegistrationDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDrafts = async () => {
    try {
      const data = await draftRepo.getAll();
      setDrafts(data);
    } catch (err) {
      console.error('Error loading drafts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDrafts();
    }, [])
  );

  const handleDeleteDraft = async (draft: RegistrationDraft) => {
    try {
      await draftRepo.deleteDraft(draft.draft_id);
      showToast({ message: 'Registration draft discarded', type: 'info' });
      loadDrafts();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to delete draft', type: 'error' });
    }
  };

  const handleResumeDraft = (draft: RegistrationDraft) => {
    router.push('/(app)/new-registration');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Header
        title="Registration Drafts"
        subtitle={`${drafts.length} saved offline sessions`}
        showBack
      />

      <FlatList
        data={drafts}
        keyExtractor={(item) => item.draft_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDrafts} colors={[colors.primary]} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={styles.draftName}>{item.name || 'Unnamed Farmer Draft'}</Text>
                <Text style={styles.phoneText}>{item.phone_number}</Text>
              </View>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step {item.step} of 6</Text>
              </View>
            </View>

            <Text style={styles.updatedText}>
              Last saved: {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Device SQLite
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => handleDeleteDraft(item)}
                style={styles.deleteBtn}
                activeOpacity={0.7}
              >
                <Feather name="trash-2" size={14} color={colors.danger} />
                <Text style={styles.deleteBtnText}>Discard</Text>
              </TouchableOpacity>

              <Button
                title="Continue Registration"
                size="sm"
                variant="primary"
                onPress={() => handleResumeDraft(item)}
                icon={<Feather name="arrow-right" size={14} color="#FFFFFF" />}
                iconPosition="right"
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<Feather name="file-text" size={32} color={colors.primary} />}
              title="No Saved Drafts"
              description="You have no in-progress registrations saved locally on this device."
              actionTitle="+ New Registration"
              onAction={() => router.push('/(app)/new-registration')}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  listContent: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  draftName: {
    fontSize: typography.fontSize.bodySecondary,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  phoneText: {
    fontSize: typography.fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stepBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.md,
  },
  stepBadgeText: {
    fontSize: typography.fontSize.micro,
    fontWeight: '700',
    color: colors.primary,
  },
  updatedText: {
    fontSize: typography.fontSize.micro,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: spacing.sm,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  deleteBtnText: {
    fontSize: typography.fontSize.tiny,
    color: colors.danger,
    fontWeight: '600',
  },
});
