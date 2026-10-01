import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/colors';
import { useAuth } from '../auth/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showSyncBadge?: boolean;
  pendingCount?: number;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showSyncBadge = true,
  pendingCount = 0,
  rightAction,
}) => {
  const { session } = useAuth();
  const userName = session?.user.name || 'Officer';
  const isField = session?.user.role === 'FIELD_OFFICER';

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <View style={styles.brandContainer}>
          <Text style={styles.brand}>WATERGRID</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>{isField ? 'FIELD OPS' : 'ADMIN'}</Text>
          </View>
        </View>

        <View style={styles.rightContainer}>
          {showSyncBadge && (
            <View style={styles.offlinePill}>
              <View style={styles.offlineDot} />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
          {rightAction}
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : (
            <Text style={styles.subtitle}>Welcome back, {userName}</Text>
          )}
        </View>

        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>{pendingCount} pending sync</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary[700],
    letterSpacing: 1,
  },
  roleTag: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: Colors.primary[200],
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary[700],
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutral[200],
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.status.warningText,
    marginRight: 5,
  },
  offlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.neutral[700],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.neutral[900],
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.neutral[500],
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: Colors.status.warningBg,
    borderColor: Colors.status.warningBorder,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.status.warningText,
  },
});
