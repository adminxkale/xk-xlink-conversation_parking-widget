"use client";

import { useState, useEffect } from "react";
import type { AuthState } from "../../domain/entities/auth";
import type { GenesysCredentials } from "../../domain/entities/tenant";
import {
  loginWithPKCE,
  clearToken,
} from "../../infrastructure/adapters/genesys-auth.adapter";

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  token: null,
  agent: null,
  agentGroupIds: null,
  tenantId: null,
  error: null,
};

export function useAuth(credentials: GenesysCredentials | null): AuthState {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    // Wait until credentials are available before attempting auth
    if (!credentials) return;

    let cancelled = false;

    async function authenticate() {
      try {
        // loginWithPKCE handles the full PKCE flow via the Genesys SDK:
        // - On first visit: redirects to Genesys login (page navigates away, promise never resolves)
        // - On callback (with ?code=): exchanges code for token and returns user data
        const { name, id, groupIds, token } = await loginWithPKCE(
          credentials!.genesys_client_id,
          credentials!.environment
        );

        if (cancelled) return;

        console.log(`[useAuth] Agent "${name}" (id: ${id}) authenticated via PKCE — groupIds:`, groupIds);

        setState({
          isAuthenticated: true,
          isLoading: false,
          token,
          agent: { name, id },
          agentGroupIds: groupIds,
          tenantId: null,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;

        const errorMessage = err instanceof Error ? err.message : "Authentication failed";

        // The SDK redirects the page to Genesys login on first call.
        // When that happens, the page navigates away and this catch may fire briefly.
        // We detect this by checking if the error is about the redirect or if the page
        // is about to unload. In that case, we stay in loading state.
        if (
          errorMessage.includes('Login redirect') ||
          errorMessage.includes('Redirecting')
        ) {
          // Page is navigating away — keep loading state
          return;
        }

        clearToken();

        setState({
          isAuthenticated: false,
          isLoading: false,
          token: null,
          agent: null,
          agentGroupIds: null,
          tenantId: null,
          error: errorMessage,
        });
      }
    }

    authenticate();

    return () => {
      cancelled = true;
    };
  }, [credentials]);

  return state;
}
