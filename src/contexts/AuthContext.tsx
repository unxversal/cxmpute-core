// src/contexts/AuthContext.tsx
"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import type { AuthenticatedUserSubject } from '@/lib/auth'; // Assuming this type is defined

interface AuthContextType {
  user: AuthenticatedUserSubject | null;
  isAuthenticated: boolean;
  // You might add a loading state if user data is fetched async on client
  // isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children, user }: { children: ReactNode; user: AuthenticatedUserSubject | null }) => {
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};