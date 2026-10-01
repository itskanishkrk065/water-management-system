import React from 'react';
import { Tabs } from 'expo-router';
import { Colors } from '../../src/constants/colors';
import {
  Home,
  Users,
  UserPlus,
  FileText,
  RefreshCw,
  MoreHorizontal,
  Droplets,
  Terminal,
} from 'lucide-react-native';
import { useAuth } from '../../src/auth/AuthContext';

export default function AppLayout() {
  const { isAdmin } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary[600],
        tabBarInactiveTintColor: Colors.neutral[400],
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: Colors.neutral[200],
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size || 22} />,
        }}
      />
      <Tabs.Screen
        name="beneficiaries"
        options={{
          title: 'Beneficiaries',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size || 22} />,
        }}
      />
      <Tabs.Screen
        name="new-registration"
        options={{
          title: 'Register',
          tabBarIcon: ({ color, size }) => <UserPlus color={color} size={size || 22} />,
        }}
      />
      <Tabs.Screen
        name="drafts"
        options={{
          title: 'Drafts',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size || 22} />,
        }}
      />
      <Tabs.Screen
        name="water"
        options={{
          title: 'Water',
          tabBarIcon: ({ color, size }) => <Droplets color={color} size={size || 22} />,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color, size }) => <RefreshCw color={color} size={size || 22} />,
        }}
      />
      <Tabs.Screen
        name="developer"
        options={{
          href: isAdmin ? '/(app)/developer' : null, // Admin only tab
          title: 'Dev Portal',
          tabBarIcon: ({ color, size }) => <Terminal color={color} size={size || 22} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size || 22} />,
        }}
      />
    </Tabs>
  );
}
