'use client';

import { useState, useEffect, useCallback } from 'react';
import { GenesysCredentials, TenantResolutionState } from '@/src/domain/entities/tenant';
import {
  extractOrg,
  resolveTenant,
  fetchGenesysCredentials,
  getCachedCredentials,
  setCachedCredentials,
  clearCachedCredentials,
} from '@/src/infrastructure/adapters/tenant-resolution.adapter';

interface UseTenantResolutionReturn {
  state: TenantResolutionState;
  retry: () => void;
}

export function useTenantResolution(): UseTenantResolutionReturn {
  const [state, setState] = useState<TenantResolutionState>({
    status: 'idle',
    org: null,
    tenantId: null,
    credentials: null,
    error: null,
  });

  const resolve = useCallback(async () => {
    // Step 1: Extract org
    const orgResult = extractOrg();
    if ('error' in orgResult) {
      setState({ status: 'error', org: null, tenantId: null, credentials: null, error: orgResult.error });
      return;
    }
    const { org } = orgResult;

    // Step 2: Check cache
    const cached = getCachedCredentials(org);
    if (cached) {
      setState({ status: 'resolved', org, tenantId: cached.tenantId, credentials: cached.credentials, error: null });
      return;
    }

    // Step 3: Resolve tenant
    setState({ status: 'resolving-tenant', org, tenantId: null, credentials: null, error: null });
    try {
      const { tenant_id } = await resolveTenant(org);

      // Step 4: Fetch credentials (using org, not tenant_id — secret path uses org)
      setState({ status: 'fetching-credentials', org, tenantId: tenant_id, credentials: null, error: null });
      const credentials: GenesysCredentials = await fetchGenesysCredentials(org);

      // Success: cache and set resolved state
      setCachedCredentials(org, credentials, tenant_id);
      setState({ status: 'resolved', org, tenantId: tenant_id, credentials, error: null });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido durante la resolución del tenant.';
      setState(prev => ({ ...prev, status: 'error', error: errorMessage }));
    }
  }, []);

  useEffect(() => {
    resolve();
  }, [resolve]);

  const retry = useCallback(() => {
    clearCachedCredentials();
    setState({ status: 'idle', org: null, tenantId: null, credentials: null, error: null });
    resolve();
  }, [resolve]);

  return { state, retry };
}
