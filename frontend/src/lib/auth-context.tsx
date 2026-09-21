'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from './api';

export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'FIELD_OFFICER' | 'ACCOUNTS' | 'VIEWER';
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRoleQuick: (role: 'ADMIN' | 'FIELD_OFFICER' | 'ACCOUNTS' | 'VIEWER') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('water_user');
    const token = localStorage.getItem('water_access_token');
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('water_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await apiClient.post('/auth/login', { email, password: pass });
    const { accessToken, refreshToken, user: loggedInUser } = res.data;

    localStorage.setItem('water_access_token', accessToken);
    localStorage.setItem('water_refresh_token', refreshToken);
    localStorage.setItem('water_user', JSON.stringify(loggedInUser));

    setUser(loggedInUser);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      // Ignore network failures on logout
    } finally {
      localStorage.removeItem('water_access_token');
      localStorage.removeItem('water_refresh_token');
      localStorage.removeItem('water_user');
      setUser(null);
      router.push('/login');
    }
  };

  const switchRoleQuick = async (role: 'ADMIN' | 'FIELD_OFFICER' | 'ACCOUNTS' | 'VIEWER') => {
    const roleEmailMap = {
      ADMIN: 'admin@water.gov',
      FIELD_OFFICER: 'field@water.gov',
      ACCOUNTS: 'accounts@water.gov',
      VIEWER: 'viewer@water.gov',
    };
    await login(roleEmailMap[role], 'Admin@123456');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, switchRoleQuick }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
