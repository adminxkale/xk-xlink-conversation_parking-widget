"use client";
import { ReactNode } from 'react';
import { AuthContext } from '../providers/AuthContext';
import { useAuth } from '../../application/hooks/useAuth';
import type { GenesysCredentials } from '@/src/domain/entities/tenant';

interface AuthProviderProps {
  children: ReactNode;
  credentials: GenesysCredentials | null;
  tenantId: string;
}

export function AuthProvider({ children, credentials, tenantId }: AuthProviderProps) {
  const authState = useAuth(credentials);

  // Merge tenantId into the auth state
  const stateWithTenant = { ...authState, tenantId };

  if (authState.isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-gray-500">
          <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Autenticando...
        </div>
      </div>
    );
  }

  if (authState.error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-red-600 text-sm mb-3">{authState.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 min-h-[44px]"
            aria-label="Reintentar autenticación"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={stateWithTenant}>
      {children}
    </AuthContext.Provider>
  );
}
