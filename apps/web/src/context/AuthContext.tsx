import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, User, Tenant } from '../api/auth.api';

interface AuthContextValue {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  loginWithDev: (email?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    try {
      const data = await authApi.getMe();
      setUser(data.user);
      setTenant(data.tenant);
    } catch {
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const loginWithDev = async (email?: string) => {
    setLoading(true);
    try {
      const res = await authApi.devLogin(email);
      setUser(res.user);
      setTenant(res.tenant);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setTenant(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        loading,
        loginWithDev,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
