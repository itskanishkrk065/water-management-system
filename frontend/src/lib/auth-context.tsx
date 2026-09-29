'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from './api';

export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'FIELD_OFFICER' | 'ACCOUNTS' | 'VIEWER' | 'BENEFICIARY';
  beneficiary_id?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  registerBeneficiary: (data: {
    fullName?: string;
    full_name?: string;
    phoneNumber?: string;
    phone?: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
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
    if (loggedInUser.role === 'BENEFICIARY') {
      router.push('/beneficiary/dashboard');
    } else {
      router.push('/dashboard');
    }
  };

  const registerBeneficiary = async (data: {
    fullName?: string;
    full_name?: string;
    phoneNumber?: string;
    phone?: string;
    email: string;
    password: string;
  }) => {
    const fullName = (data.fullName || data.full_name || '').trim();
    const phoneNumber = (data.phoneNumber || data.phone || '').trim();

    const payload = {
      fullName,
      full_name: fullName,
      phoneNumber,
      phone: phoneNumber,
      email: data.email,
      password: data.password,
    };

    const res = await apiClient.post('/auth/beneficiary-signup', payload);
    const { accessToken, refreshToken, user: loggedInUser } = res.data;

    localStorage.setItem('water_access_token', accessToken);
    localStorage.setItem('water_refresh_token', refreshToken);
    localStorage.setItem('water_user', JSON.stringify(loggedInUser));

    setUser(loggedInUser);
    router.push('/beneficiary/profile');
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

  return (
    <AuthContext.Provider value={{ user, isLoading, login, registerBeneficiary, logout }}>
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
