import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { colors, typography, shadows } from '../../src/constants/theme';
import { Feather } from '../../src/components/Icon';
import { useAuth } from '../../src/auth/AuthContext';

export default function AppLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          ...shadows.sheet,
        },
        tabBarLabelStyle: {
          fontSize: typography.fontSize.micro,
          fontWeight: '600',
          fontFamily: typography.fontFamily.medium,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" color={color} size={size ? size - 2 : 20} />
          ),
        }}
      />
      <Tabs.Screen
        name="beneficiaries/index"
        options={{
          title: 'Beneficiaries',
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" color={color} size={size ? size - 2 : 20} />
          ),
        }}
      />

      {/* Field Officer: Add (New Registration) */}
      <Tabs.Screen
        name="new-registration/index"
        options={{
          href: !isAdmin ? '/(app)/new-registration' : null,
          title: 'Register',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user-plus" color={color} size={size ? size - 2 : 20} />
          ),
        }}
      />

      {/* Admin: Approvals / Water */}
      <Tabs.Screen
        name="water/index"
        options={{
          href: isAdmin ? '/(app)/water' : null,
          title: 'Approvals',
          tabBarIcon: ({ color, size }) => (
            <Feather name="check-circle" color={color} size={size ? size - 2 : 20} />
          ),
        }}
      />

      {/* Admin: Reports */}
      <Tabs.Screen
        name="reports/index"
        options={{
          href: isAdmin ? '/(app)/reports' : null,
          title: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <Feather name="bar-chart-2" color={color} size={size ? size - 2 : 20} />
          ),
        }}
      />

      {/* Field Officer: Sync */}
      <Tabs.Screen
        name="sync/index"
        options={{
          href: !isAdmin ? '/(app)/sync' : null,
          title: 'Sync',
          tabBarIcon: ({ color, size }) => (
            <Feather name="refresh-cw" color={color} size={size ? size - 2 : 20} />
          ),
        }}
      />

      {/* More Hub for secondary screens */}
      <Tabs.Screen
        name="more/index"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" color={color} size={size ? size - 2 : 20} />
          ),
        }}
      />

      {/* Hidden Subscreens / Detail Screens */}
      <Tabs.Screen name="beneficiaries/[id]" options={{ href: null }} />
      <Tabs.Screen name="water/new" options={{ href: null }} />
      <Tabs.Screen name="extensions/index" options={{ href: null }} />
      <Tabs.Screen name="extensions/new" options={{ href: null }} />
      <Tabs.Screen name="billing/index" options={{ href: null }} />
      <Tabs.Screen name="infrastructure/index" options={{ href: null }} />
      <Tabs.Screen name="developer/index" options={{ href: null }} />
      <Tabs.Screen name="drafts/index" options={{ href: null }} />
    </Tabs>
  );
}
