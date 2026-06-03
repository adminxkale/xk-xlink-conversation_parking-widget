import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractOrg,
  getCachedCredentials,
  setCachedCredentials,
  clearCachedCredentials,
} from './tenant-resolution.adapter';
import { GenesysCredentials } from '@/src/domain/entities/tenant';

describe('tenant-resolution.adapter', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('extractOrg', () => {
    it('returns org from URL query param and stores it in localStorage', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?org=myorg',
          pathname: '/',
          hash: '',
        },
        writable: true,
      });
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});

      const result = extractOrg();

      expect(result).toEqual({ org: 'myorg' });
      expect(localStorage.getItem('xlink_org')).toBe('myorg');
      replaceStateSpy.mockRestore();
    });

    it('returns org from localStorage when URL param is absent', () => {
      localStorage.setItem('xlink_org', 'stored-org');
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
          pathname: '/',
          hash: '',
        },
        writable: true,
      });

      const result = extractOrg();

      expect(result).toEqual({ org: 'stored-org' });
    });

    it('returns error when URL param is absent and localStorage has no value', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '',
          pathname: '/',
          hash: '',
        },
        writable: true,
      });

      const result = extractOrg();

      expect(result).toEqual({ error: 'No se encontró el parámetro de organización. Verifica la URL.' });
    });

    it('cleans the org param from the URL after extraction', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?org=myorg&other=value',
          pathname: '/app',
          hash: '#section',
        },
        writable: true,
      });
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});

      extractOrg();

      expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/app?other=value#section');
      replaceStateSpy.mockRestore();
    });

    it('cleans URL completely when org is the only param', () => {
      Object.defineProperty(window, 'location', {
        value: {
          search: '?org=myorg',
          pathname: '/app',
          hash: '',
        },
        writable: true,
      });
      const replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});

      extractOrg();

      expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/app');
      replaceStateSpy.mockRestore();
    });
  });

  describe('getCachedCredentials', () => {
    const mockCredentials: GenesysCredentials = {
      genesys_client_id: 'client-123',
      genesys_client_secret: 'secret-456',
      environment: 'mypurecloud.com',
    };

    it('returns credentials when org matches stored value', () => {
      setCachedCredentials('org1', mockCredentials);

      const result = getCachedCredentials('org1');

      expect(result).toEqual(mockCredentials);
    });

    it('returns null when org does not match stored value', () => {
      setCachedCredentials('org1', mockCredentials);

      const result = getCachedCredentials('org2');

      expect(result).toBeNull();
    });

    it('returns null when no credentials are stored', () => {
      const result = getCachedCredentials('org1');

      expect(result).toBeNull();
    });
  });

  describe('clearCachedCredentials', () => {
    it('removes credentials from localStorage', () => {
      const creds: GenesysCredentials = {
        genesys_client_id: 'id',
        genesys_client_secret: 'secret',
        environment: 'env',
      };
      setCachedCredentials('myorg', creds);

      clearCachedCredentials();

      expect(getCachedCredentials('myorg')).toBeNull();
      expect(localStorage.getItem('genesys_credentials')).toBeNull();
    });
  });
});
