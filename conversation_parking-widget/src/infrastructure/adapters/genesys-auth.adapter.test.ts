/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { extractToken, validateToken, clearToken } from './genesys-auth.adapter';

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

  describe('validateToken', () => {
    it('returns user data on successful validation', async () => {
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
  });

  describe('clearToken', () => {
    it('removes token from localStorage', () => {
      window.localStorage.setItem('genesys_token', 'some-token');

      clearToken();

      expect(window.localStorage.getItem('genesys_token')).toBeNull();
    });
  });
});
