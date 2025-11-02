import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from './types';
import { hasBackend } from './config';
import * as auth from './auth';
import { socketManager } from './socket';
import { bootstrapSWBridge, syncAuthTokenToSW, syncConfigToSW } from './swBridge';

interface AuthContextType {
  user: User | null;
  role: Role;
  isAuthenticated: boolean;
  login: (hallticket: string, password: string) => Promise<void>;
  register: (data: { hallticket: string; password: string; firstName?: string; lastName?: string; email?: string; phone?: string; role?: Role }) => Promise<void>;
  logout: () => void;
  switchRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>('STUDENT');

  useEffect(() => {
    // Hydrate from stored auth only when backend is configured
    (async () => {
      if (!hasBackend()) return;
      // Ensure SW knows API base early
      try { bootstrapSWBridge(); } catch {}
      const me = await auth.getMe();
      if (me) {
        setRole(me.role);
        setUser({
          id: me.id,
          hallticket: '',
          name: '',
          phone: '',
          email: '',
          role: me.role,
          createdAt: new Date().toISOString(),
        });
      }
    })();
  }, []);

  const login = async (hallticket: string, password: string) => {
    if (!hasBackend()) throw new Error('Backend not configured');
    const res = await auth.login(hallticket.trim().toUpperCase(), password);
    if (!res) throw new Error('Login failed');
    const userRole: Role = res.role;
    setUser({
      id: 'me',
      hallticket,
      name: '',
      phone: '',
      email: '',
      role: userRole,
      createdAt: new Date().toISOString(),
    });
    setRole(userRole);
    try { socketManager.connect(); } catch {}
    try {
      // Push token and config to SW for quick-replies
      const token = localStorage.getItem('authToken');
      syncConfigToSW();
      if (token) syncAuthTokenToSW(token);
    } catch {}
  };

  const register = async (data: { hallticket: string; password: string; firstName?: string; lastName?: string; email?: string; phone?: string; role?: Role }) => {
    if (!hasBackend()) throw new Error('Backend not configured');
    const res = await auth.register({
      hallticket: data.hallticket.trim().toUpperCase(),
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      role: data.role,
    });
    if (!res) throw new Error('Register failed');
    const userRole: Role = res.role;
    setUser({
      id: 'me',
      hallticket: data.hallticket,
      name: [data.firstName, data.lastName].filter(Boolean).join(' '),
      phone: data.phone || '',
      email: data.email || '',
      role: userRole,
      createdAt: new Date().toISOString(),
    });
    setRole(userRole);
    try { socketManager.connect(); } catch {}
    try {
      const token = localStorage.getItem('authToken');
      syncConfigToSW();
      if (token) syncAuthTokenToSW(token);
    } catch {}
  };

  const logout = () => {
    if (hasBackend()) auth.logout();
    setUser(null);
    setRole('STUDENT');
    try { syncAuthTokenToSW(null); } catch {}
  };

  const switchRole = (newRole: Role) => {
    // No demo mode switching; keep function to avoid crashes if called
    setRole(newRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
