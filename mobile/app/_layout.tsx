import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth/AuthContext';
import { initDatabase } from '../src/db/database';
import { Colors } from '../src/constants/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        await initDatabase();
        setDbReady(true);
      } catch (err: any) {
        console.error('Failed to initialize local SQLite database:', err);
        setDbError(err.message || 'Database initialization error');
      }
    }
    prepare();
  }, []);

  if (dbError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Database Initialization Failed</Text>
        <Text style={styles.errorSubtitle}>{dbError}</Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
        <Text style={styles.loadingText}>Initializing WaterGrid Mobile DB...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: Colors.neutral[600],
    fontWeight: '500',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.status.dangerText,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
});
