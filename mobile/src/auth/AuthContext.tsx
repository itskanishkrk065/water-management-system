import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, UserSession } from '../types/domain';
import { getDatabase } from '../db/database';

interface AuthContextType {
  session: UserSession | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, role?: UserRole) => Promise<boolean>;
  switchRole: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  isFieldOfficer: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize default session for offline field operations
  useEffect(() => {
    async function loadSavedSession() {
      try {
        const db = await getDatabase();
        const user = await db.getFirstAsync<User>(
          'SELECT id, name, email, role, is_active as isActive FROM users WHERE role = "FIELD_OFFICER" LIMIT 1;'
        );

        if (user) {
          setSession({
            user,
            token: 'offline-jwt-session-token',
            deviceId: 'DEVICE-ANDROID-ARM64',
            loggedInAt: new Date().toISOString(),
            isOffline: true,
          });
        }
      } catch (err) {
        console.error('Failed to load initial session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadSavedSession();
  }, []);

  const login = async (email: string, targetRole?: UserRole): Promise<boolean> => {
    try {
      const db = await getDatabase();
      let query = 'SELECT id, name, email, role, is_active as isActive FROM users WHERE email = ? LIMIT 1;';
      let params: any[] = [email];

      if (targetRole) {
        query = 'SELECT id, name, email, role, is_active as isActive FROM users WHERE role = ? LIMIT 1;';
        params = [targetRole];
      }

      let user = await db.getFirstAsync<User>(query, params);

      if (!user) {
        // Fallback default based on role
        user = {
          id: targetRole === 'ADMIN' ? 'usr-admin-01' : 'usr-field-01',
          name: targetRole === 'ADMIN' ? 'Admin Officer' : 'Ravi Kumar',
          email: targetRole === 'ADMIN' ? 'admin@watergrid.local' : 'field@watergrid.local',
          role: targetRole || 'FIELD_OFFICER',
          isActive: true,
        };
      }

      setSession({
        user,
        token: 'offline-jwt-session-token',
        deviceId: 'DEVICE-ANDROID-ARM64',
        loggedInAt: new Date().toISOString(),
        isOffline: true,
      });

      return true;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  const switchRole = async (newRole: UserRole) => {
    await login(newRole === 'ADMIN' ? 'admin@watergrid.local' : 'field@watergrid.local', newRole);
  };

  const logout = async () => {
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        isLoading,
        login,
        switchRole,
        logout,
        isFieldOfficer: session?.user.role === 'FIELD_OFFICER',
        isAdmin: session?.user.role === 'ADMIN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
