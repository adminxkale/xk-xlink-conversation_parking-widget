"use client";

import { useState, useEffect } from "react";
import type { AuthState } from "../../domain/entities/auth";
import {
  extractToken,
  validateToken,
  clearToken,
  redirectToLogin,
} from "../../infrastructure/adapters/genesys-auth.adapter";

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  token: null,
  agent: null,
  agentGroupIds: null,
  error: null,
};

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      const token = extractToken();

      if (!token) {
        // No token found anywhere — redirect to Genesys login once
        // Use a flag to prevent redirect loops
        const alreadyRedirected = sessionStorage.getItem('auth_redirect_pending');
        if (alreadyRedirected) {
          sessionStorage.removeItem('auth_redirect_pending');
          if (!cancelled) {
            setState({
              isAuthenticated: false,
              isLoading: false,
              token: null,
              agent: null,
              agentGroupIds: null,
              error: 'No se pudo obtener el token de autenticación. Verifica la configuración OAuth.',
            });
          }
          return;
        }
        sessionStorage.setItem('auth_redirect_pending', 'true');
        redirectToLogin();
        return;
      }

      // We have a token — clear the redirect flag
      sessionStorage.removeItem('auth_redirect_pending');

      try {
        const { name, id, groupIds } = await validateToken(token);
        console.log(`[useAuth] Agent "${name}" (id: ${id}) — groupIds:`, groupIds);

        if (cancelled) return;

        setState({
          isAuthenticated: true,
          isLoading: false,
          token,
          agent: { name, id },
          agentGroupIds: groupIds,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;

        clearToken();

        // Don't redirect automatically — show error instead to break the loop
        setState({
          isAuthenticated: false,
          isLoading: false,
          token: null,
          agent: null,
          agentGroupIds: null,
          error: err instanceof Error ? err.message : "Authentication failed",
        });
      }
    }

    authenticate();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
