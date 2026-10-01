import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header } from '../../../src/components/Header';
import { Button } from '../../../src/components/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { Colors } from '../../../src/constants/colors';
import { DraftRepository } from '../../../src/repositories/DraftRepository';
import { RegistrationDraft } from '../../../src/types/domain';
import { FileText, Phone, Trash2, ArrowRight, UserPlus } from 'lucide-react-native';

const draftRepo = new DraftRepository();

export default function DraftsScreen() {
  const router = useRouter();
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

  const handleDeleteDraft = (draft: RegistrationDraft) => {
    Alert.alert(
      'Discard Draft',
      `Are you sure you want to discard the draft for ${draft.name || draft.phone_number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await draftRepo.deleteDraft(draft.draft_id);
            loadDrafts();
          },
        },
      ]
    );
  };

  const handleResumeDraft = (draft: RegistrationDraft) => {
    router.push('/(app)/new-registration');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        title="My Drafts"
        subtitle={`${drafts.length} saved progressive registration drafts`}
      />

      <FlatList
        data={drafts}
        keyExtractor={(item) => item.draft_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDrafts} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.draftName}>
                  {item.name ? item.name : 'Unnamed Draft'}
                </Text>
                <View style={styles.phoneRow}>
                  <Phone size={13} color={Colors.neutral[400]} />
                  <Text style={styles.phoneText}>{item.phone_number}</Text>
                </View>
              </View>

              <View style={styles.stepBadge}>
                <Text style={styles.stepText}>Step {item.step} of 6</Text>
              </View>
            </View>

            <Text style={styles.updatedText}>
              Last updated: {new Date(item.updated_at).toLocaleString()}
            </Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => handleDeleteDraft(item)}
                style={styles.deleteBtn}
              >
                <Trash2 size={16} color={Colors.status.dangerText} />
                <Text style={styles.deleteText}>Discard</Text>
              </TouchableOpacity>

              <Button
                title="Continue Registration"
                onPress={() => handleResumeDraft(item)}
                size="small"
                icon={<ArrowRight size={14} color="#FFFFFF" />}
                iconPosition="right"
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={<FileText size={32} color={Colors.primary[600]} />}
              title="No Pending Drafts"
              description="You have no in-progress registrations saved locally on this device."
              actionTitle="+ Start New Registration"
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
    backgroundColor: '#FFFFFF',
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
    marginBottom: 8,
  },
  draftName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 13,
    color: Colors.neutral[500],
    fontVariant: ['tabular-nums'],
  },
  stepBadge: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  stepText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary[700],
  },
  updatedText: {
    fontSize: 12,
    color: Colors.neutral[400],
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: Colors.neutral[100],
    paddingTop: 10,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  deleteText: {
    fontSize: 13,
    color: Colors.status.dangerText,
    fontWeight: '600',
  },
});
