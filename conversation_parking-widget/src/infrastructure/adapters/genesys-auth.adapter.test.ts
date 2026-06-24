/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the SDK import (no longer needed, but keep mock clean)
vi.mock('purecloud-platform-client-v2', () => ({}));

import { extractToken, validateToken, redirectToLogin, clearToken, getStoredEnvironment } from './genesys-auth.adapter';

describe('genesys-auth.adapter', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  describe('extractToken', () => {
    it('returns token from localStorage', () => {
      window.localStorage.setItem('genesys_token', 'stored-token-789');

      const token = extractToken();

      expect(token).toBe('stored-token-789');
    });

    it('returns null when no token in localStorage', () => {
      const token = extractToken();

      expect(token).toBeNull();
    });
  });

  describe('getStoredEnvironment', () => {
    it('returns environment from localStorage', () => {
      window.localStorage.setItem('genesys_environment', 'mypurecloud.com');

      expect(getStoredEnvironment()).toBe('mypurecloud.com');
    });

    it('returns null when no environment stored', () => {
      expect(getStoredEnvironment()).toBeNull();
    });
  });

  describe('validateToken', () => {
    it('returns user data on successful validation with explicit environment', async () => {
      const mockResponse = {
        name: 'Agent Smith',
        id: 'user-001',
        groups: [{ id: 'group-a' }, { id: 'group-b' }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await validateToken('valid-token', 'mypurecloud.com');

      expect(result).toEqual({
        name: 'Agent Smith',
        id: 'user-001',
        groupIds: ['group-a', 'group-b'],
      });
      expect(fetch).toHaveBeenCalledWith(
        'https://api.mypurecloud.com/api/v2/users/me?expand=groups',
        {
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('falls back to localStorage environment when not provided', async () => {
      window.localStorage.setItem('genesys_environment', 'mypurecloud.com');

      const mockResponse = {
        name: 'Agent Smith',
        id: 'user-001',
        groups: [{ id: 'group-a' }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await validateToken('valid-token');

      expect(result).toEqual({
        name: 'Agent Smith',
        id: 'user-001',
        groupIds: ['group-a'],
      });
      expect(fetch).toHaveBeenCalledWith(
        'https://api.mypurecloud.com/api/v2/users/me?expand=groups',
        expect.any(Object)
      );
    });

    it('throws on failed validation (401)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(validateToken('bad-token', 'mypurecloud.com')).rejects.toThrow(
        'Token validation failed with status 401'
      );
    });

    it('returns empty groupIds when user has no groups', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ name: 'Solo Agent', id: 'user-002' }),
      });

      const result = await validateToken('valid-token', 'mypurecloud.com');

      expect(result.groupIds).toEqual([]);
    });

    it('throws when environment is not available (no param and no localStorage)', async () => {
      await expect(validateToken('any-token')).rejects.toThrow(
        'Genesys environment is not available.'
      );
    });
  });

  describe('redirectToLogin (deprecated)', () => {
    it('redirects to Genesys OAuth login URL with provided clientId and environment', () => {
      const mockLocation = {
        ...originalLocation,
        origin: 'https://myapp.com',
        pathname: '/widget',
        href: '',
      };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      });

      redirectToLogin('test-client-id', 'mypurecloud.com');

      expect(mockLocation.href).toContain('https://login.mypurecloud.com/oauth/authorize');
      expect(mockLocation.href).toContain('client_id=test-client-id');
      expect(mockLocation.href).toContain('response_type=token');
      expect(mockLocation.href).toContain(
        'redirect_uri=' + encodeURIComponent('https://myapp.com/widget')
      );
    });

    it('stores environment in localStorage before redirecting', () => {
      const mockLocation = {
        ...originalLocation,
        origin: 'https://myapp.com',
        pathname: '/widget',
        href: '',
      };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      });

      redirectToLogin('my-client', 'usw2.pure.cloud');

      expect(window.localStorage.getItem('genesys_environment')).toBe('usw2.pure.cloud');
    });
  });

  describe('clearToken', () => {
    it('removes token from localStorage', () => {
      window.localStorage.setItem('genesys_token', 'some-token');

      clearToken();

      expect(window.localStorage.getItem('genesys_token')).toBeNull();
    });
  });
});
