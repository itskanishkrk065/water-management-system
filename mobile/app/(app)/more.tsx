import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Header } from '../../src/components/Header';
import { Button } from '../../src/components/Button';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/auth/AuthContext';
import {
  User,
  Shield,
  Terminal,
  RefreshCw,
  HardDrive,
  Info,
  ChevronRight,
  LogOut,
} from 'lucide-react-native';

export default function MoreScreen() {
  const router = useRouter();
  const { session, switchRole, isAdmin, isFieldOfficer } = useAuth();

  const handleRoleToggle = async () => {
    const nextRole = isAdmin ? 'FIELD_OFFICER' : 'ADMIN';
    await switchRole(nextRole);
    Alert.alert(
      'Role Switched',
      `Active mobile profile switched to: ${nextRole === 'ADMIN' ? 'Admin Officer' : 'Field Officer (Ravi Kumar)'}`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="Settings & More" subtitle="Application profile and system settings" />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* User Profile Card */}
        <View style={styles.card}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <User size={24} color={Colors.primary[700]} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{session?.user.name || 'Field Officer'}</Text>
              <Text style={styles.userEmail}>{session?.user.email || 'field@watergrid.local'}</Text>
              <View style={styles.roleTag}>
                <Shield size={12} color={Colors.primary[700]} />
                <Text style={styles.roleText}>{session?.user.role}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Role Switcher */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Role-Based Profile (Offline Demo)</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.roleDesc}>
            Current Role: <Text style={styles.boldText}>{session?.user.role}</Text>
          </Text>
          <Text style={styles.roleSub}>
            Switch between Field Officer (data collection) and Administrator (approvals, developer portal).
          </Text>

          <Button
            title={`Switch to ${isAdmin ? 'Field Officer Profile' : 'Admin Profile'}`}
            variant="outline"
            onPress={handleRoleToggle}
            icon={<Shield size={16} color={Colors.primary[600]} />}
            style={{ marginTop: 10 }}
          />
        </View>

        {/* Developer Portal Access */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>System & Diagnostics</Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(app)/developer')}
          >
            <View style={styles.menuLeft}>
              <Terminal size={18} color={Colors.primary[600]} />
              <View>
                <Text style={styles.menuTitle}>Developer Diagnostics & DB Inspector</Text>
                <Text style={styles.menuSub}>
                  SQLite metrics, table browser, Clean State Protocol
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.neutral[400]} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/(app)/sync')}
          >
            <View style={styles.menuLeft}>
              <RefreshCw size={18} color={Colors.accent.amber} />
              <View>
                <Text style={styles.menuTitle}>Pending Sync Queue</Text>
                <Text style={styles.menuSub}>Inspect local offline mutation backlog</Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.neutral[400]} />
          </TouchableOpacity>
        </View>

        {/* Device Info */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Version:</Text>
            <Text style={styles.infoVal}>WaterGrid Mobile v1.0.0 (Phase 1)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Database:</Text>
            <Text style={styles.infoVal}>Local SQLite (WAL Mode)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device ID:</Text>
            <Text style={styles.infoVal}>DEVICE-ANDROID-ARM64</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.neutral[900],
  },
  userEmail: {
    fontSize: 13,
    color: Colors.neutral[500],
    marginTop: 1,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary[700],
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roleDesc: {
    fontSize: 14,
    color: Colors.neutral[800],
  },
  boldText: {
    fontWeight: '700',
    color: Colors.primary[700],
  },
  roleSub: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 4,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  menuSub: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.neutral[100],
    marginVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.neutral[500],
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.neutral[800],
  },
});
