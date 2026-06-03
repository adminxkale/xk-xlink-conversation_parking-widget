import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTenantResolution } from './useTenantResolution';
import type { GenesysCredentials } from '@/src/domain/entities/tenant';

vi.mock('@/src/infrastructure/adapters/tenant-resolution.adapter', () => ({
  extractOrg: vi.fn(),
  resolveTenant: vi.fn(),
  fetchGenesysCredentials: vi.fn(),
  getCachedCredentials: vi.fn(),
  setCachedCredentials: vi.fn(),
  clearCachedCredentials: vi.fn(),
}));

import {
  extractOrg,
  resolveTenant,
  fetchGenesysCredentials,
  getCachedCredentials,
  setCachedCredentials,
  clearCachedCredentials,
} from '@/src/infrastructure/adapters/tenant-resolution.adapter';

const mockExtractOrg = vi.mocked(extractOrg);
const mockResolveTenant = vi.mocked(resolveTenant);
const mockFetchGenesysCredentials = vi.mocked(fetchGenesysCredentials);
const mockGetCachedCredentials = vi.mocked(getCachedCredentials);
const mockSetCachedCredentials = vi.mocked(setCachedCredentials);
const mockClearCachedCredentials = vi.mocked(clearCachedCredentials);

const TEST_ORG = 'test-org';
const TEST_TENANT_ID = 'tenant-abc-123';
const TEST_CREDENTIALS: GenesysCredentials = {
  genesys_client_id: 'client-id-123',
  genesys_client_secret: 'secret-xyz',
  environment: 'mypurecloud.com',
};

describe('useTenantResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful flow', () => {
    it('resolves tenant and fetches credentials when no cache exists', async () => {
      mockExtractOrg.mockReturnValue({ org: TEST_ORG });
      mockGetCachedCredentials.mockReturnValue(null);
      mockResolveTenant.mockResolvedValue({ tenant_id: TEST_TENANT_ID });
      mockFetchGenesysCredentials.mockResolvedValue(TEST_CREDENTIALS);

      const { result } = renderHook(() => useTenantResolution());

      await waitFor(() => {
        expect(result.current.state.status).toBe('resolved');
      });

      expect(result.current.state.org).toBe(TEST_ORG);
      expect(result.current.state.tenantId).toBe(TEST_TENANT_ID);
      expect(result.current.state.credentials).toEqual(TEST_CREDENTIALS);
      expect(result.current.state.error).toBeNull();

      expect(mockExtractOrg).toHaveBeenCalledTimes(1);
      expect(mockGetCachedCredentials).toHaveBeenCalledWith(TEST_ORG);
      expect(mockResolveTenant).toHaveBeenCalledWith(TEST_ORG);
      expect(mockFetchGenesysCredentials).toHaveBeenCalledWith(TEST_TENANT_ID);
      expect(mockSetCachedCredentials).toHaveBeenCalledWith(TEST_ORG, TEST_CREDENTIALS);
    });
  });

  describe('tenant resolution failure', () => {
    it('sets error state when resolveTenant throws', async () => {
      mockExtractOrg.mockReturnValue({ org: TEST_ORG });
      mockGetCachedCredentials.mockReturnValue(null);
      mockResolveTenant.mockRejectedValue(new Error('Error al resolver la organización.'));

      const { result } = renderHook(() => useTenantResolution());

      await waitFor(() => {
        expect(result.current.state.status).toBe('error');
      });

      expect(result.current.state.error).toBe('Error al resolver la organización.');
      expect(mockFetchGenesysCredentials).not.toHaveBeenCalled();
    });
  });

  describe('credentials fetch failure', () => {
    it('sets error state when fetchGenesysCredentials throws', async () => {
      mockExtractOrg.mockReturnValue({ org: TEST_ORG });
      mockGetCachedCredentials.mockReturnValue(null);
      mockResolveTenant.mockResolvedValue({ tenant_id: TEST_TENANT_ID });
      mockFetchGenesysCredentials.mockRejectedValue(new Error('Error al obtener credenciales.'));

      const { result } = renderHook(() => useTenantResolution());

      await waitFor(() => {
        expect(result.current.state.status).toBe('error');
      });

      expect(result.current.state.error).toBe('Error al obtener credenciales.');
    });
  });

  describe('retry behavior', () => {
    it('clears cache and re-runs flow on retry after error', async () => {
      // First: simulate failure
      mockExtractOrg.mockReturnValue({ org: TEST_ORG });
      mockGetCachedCredentials.mockReturnValue(null);
      mockResolveTenant.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTenantResolution());

      await waitFor(() => {
        expect(result.current.state.status).toBe('error');
      });

      // Now: set up success for retry
      mockResolveTenant.mockResolvedValue({ tenant_id: TEST_TENANT_ID });
      mockFetchGenesysCredentials.mockResolvedValue(TEST_CREDENTIALS);

      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.state.status).toBe('resolved');
      });

      expect(mockClearCachedCredentials).toHaveBeenCalled();
      expect(result.current.state.credentials).toEqual(TEST_CREDENTIALS);
    });
  });

  describe('cache usage', () => {
    it('resolves immediately from cache without calling resolveTenant or fetchGenesysCredentials', async () => {
      mockExtractOrg.mockReturnValue({ org: TEST_ORG });
      mockGetCachedCredentials.mockReturnValue(TEST_CREDENTIALS);

      const { result } = renderHook(() => useTenantResolution());

      await waitFor(() => {
        expect(result.current.state.status).toBe('resolved');
      });

      expect(result.current.state.credentials).toEqual(TEST_CREDENTIALS);
      expect(mockResolveTenant).not.toHaveBeenCalled();
      expect(mockFetchGenesysCredentials).not.toHaveBeenCalled();
      expect(mockSetCachedCredentials).not.toHaveBeenCalled();
    });
  });

  describe('org extraction error', () => {
    it('sets error state when extractOrg returns an error', async () => {
      mockExtractOrg.mockReturnValue({ error: 'No se encontró el parámetro de organización. Verifica la URL.' });

      const { result } = renderHook(() => useTenantResolution());

      await waitFor(() => {
        expect(result.current.state.status).toBe('error');
      });

      expect(result.current.state.error).toBe('No se encontró el parámetro de organización. Verifica la URL.');
      expect(result.current.state.org).toBeNull();
      expect(mockGetCachedCredentials).not.toHaveBeenCalled();
      expect(mockResolveTenant).not.toHaveBeenCalled();
      expect(mockFetchGenesysCredentials).not.toHaveBeenCalled();
    });
  });
});
