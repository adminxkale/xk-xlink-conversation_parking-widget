"use client";
import { createContext, useContext } from 'react';
import type { AuthState } from '../../domain/entities/auth';

const defaultState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  token: null,
  agent: null,
  agentGroupIds: null,
  tenantId: null,
  error: null,
};

export const AuthContext = createContext<AuthState>(defaultState);

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
