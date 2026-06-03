import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractToken, validateToken, redirectToLogin, clearToken } from './genesys-auth.adapter';

describe('genesys-auth.adapter', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
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
    it('returns token from URL hash and stores in localStorage', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, hash: '#access_token=hash-token-123', search: '' },
        writable: true,
      });

      const token = extractToken();

      expect(token).toBe('hash-token-123');
      expect(localStorage.getItem('genesys_token')).toBe('hash-token-123');
    });

    it('returns token from query params and stores in localStorage', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, hash: '', search: '?access_token=query-token-456' },
        writable: true,
      });

      const token = extractToken();

      expect(token).toBe('query-token-456');
      expect(localStorage.getItem('genesys_token')).toBe('query-token-456');
    });

    it('returns token from localStorage when not in URL', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, hash: '', search: '' },
        writable: true,
      });
      localStorage.setItem('genesys_token', 'stored-token-789');

      const token = extractToken();

      expect(token).toBe('stored-token-789');
    });

    it('returns null when no token found anywhere', () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, hash: '', search: '' },
        writable: true,
      });

      const token = extractToken();

      expect(token).toBeNull();
    });

    it('prioritizes hash over query params and localStorage', () => {
      Object.defineProperty(window, 'location', {
        value: {
          ...originalLocation,
          hash: '#access_token=hash-first',
          search: '?access_token=query-second',
        },
        writable: true,
      });
      localStorage.setItem('genesys_token', 'stored-third');

      const token = extractToken();

      expect(token).toBe('hash-first');
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
      localStorage.setItem('genesys_environment', 'mypurecloud.com');

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
        'Genesys environment is not available. Ensure redirectToLogin was called first.'
      );
    });
  });

  describe('redirectToLogin', () => {
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

      expect(localStorage.getItem('genesys_environment')).toBe('usw2.pure.cloud');
    });
  });

  describe('clearToken', () => {
    it('removes token from localStorage', () => {
      localStorage.setItem('genesys_token', 'some-token');

      clearToken();

      expect(localStorage.getItem('genesys_token')).toBeNull();
    });
  });
});
