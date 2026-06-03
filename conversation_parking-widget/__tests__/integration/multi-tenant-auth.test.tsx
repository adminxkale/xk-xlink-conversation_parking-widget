import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TenantResolutionGuard } from '@/src/presentation/components/TenantResolutionGuard';
import { AuthProvider } from '@/src/presentation/components/AuthProvider';

// ── Mock genesys-auth adapter to capture redirectToLogin call ──────────────────
const mockRedirectToLogin = vi.fn();
const mockExtractToken = vi.fn().mockReturnValue(null);
const mockValidateToken = vi.fn();
const mockClearToken = vi.fn();

vi.mock('@/src/infrastructure/adapters/genesys-auth.adapter', () => ({
  extractToken: (...args: unknown[]) => mockExtractToken(...args),
  validateToken: (...args: unknown[]) => mockValidateToken(...args),
  clearToken: (...args: unknown[]) => mockClearToken(...args),
  redirectToLogin: (...args: unknown[]) => mockRedirectToLogin(...args),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function setWindowUrl(url: string) {
  const urlObj = new URL(url);
  Object.defineProperty(window, 'location', {
    value: {
      href: urlObj.href,
      origin: urlObj.origin,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash,
    },
    writable: true,
    configurable: true,
  });
}

function setupFetchMock() {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/api/proxy-tenant')) {
      return Promise.resolve(
        new Response(JSON.stringify({ tenant_id: 'tenant-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    if (url.includes('/api/proxy-secret')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            genesys_client_id: 'client-abc',
            genesys_client_secret: 'secret-xyz',
            environment: 'mypurecloud.com',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    }

    return Promise.resolve(new Response('Not Found', { status: 404 }));
  }) as unknown as typeof fetch;
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('Multi-Tenant Auth Integration: Full Startup Sequence', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState = vi.fn();
    setupFetchMock();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('completes full flow: org extraction → tenant resolution → credential fetch → OAuth redirect', async () => {
    // Set up URL with ?org=test-org
    setWindowUrl('http://localhost:3000/?org=test-org');

    // No token found — triggers redirect
    mockExtractToken.mockReturnValue(null);

    render(
      <TenantResolutionGuard>
        {(credentials) => (
          <AuthProvider credentials={credentials}>
            <div data-testid="widget-content">Widget Loaded</div>
          </AuthProvider>
        )}
      </TenantResolutionGuard>
    );

    // The component initially shows a loading indicator (resolving org or fetching creds)
    expect(
      screen.getByText('Resolviendo organización...') ||
      screen.getByText('Obteniendo credenciales...') ||
      screen.getByText('Inicializando...')
    ).toBeTruthy();

    // After tenant resolution + credential fetch, AuthProvider renders and calls redirectToLogin
    await waitFor(() => {
      expect(mockRedirectToLogin).toHaveBeenCalledWith('client-abc', 'mypurecloud.com');
    });

    // Verify the proxy-tenant was called with correct org
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/proxy-tenant?org=test-org')
    );

    // Verify the proxy-secret was called with correct tenantId
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/proxy-secret?tenantId=tenant-123')
    );

    // Verify org was stored in localStorage
    expect(localStorage.getItem('xlink_org')).toBe('test-org');

    // Verify URL was cleaned (replaceState called to remove org param)
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('uses localStorage org when URL param is absent and completes full flow', async () => {
    // Pre-set org in localStorage (simulating a return visit without ?org)
    localStorage.setItem('xlink_org', 'stored-org');
    setWindowUrl('http://localhost:3000/');

    mockExtractToken.mockReturnValue(null);

    render(
      <TenantResolutionGuard>
        {(credentials) => (
          <AuthProvider credentials={credentials}>
            <div data-testid="widget-content">Widget Loaded</div>
          </AuthProvider>
        )}
      </TenantResolutionGuard>
    );

    // Should resolve tenant using stored org
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/proxy-tenant?org=stored-org')
      );
    });

    // Should eventually call redirectToLogin with resolved credentials
    await waitFor(() => {
      expect(mockRedirectToLogin).toHaveBeenCalledWith('client-abc', 'mypurecloud.com');
    });
  });

  it('shows error when org is missing from URL and localStorage', async () => {
    setWindowUrl('http://localhost:3000/');

    render(
      <TenantResolutionGuard>
        {(credentials) => (
          <AuthProvider credentials={credentials}>
            <div data-testid="widget-content">Widget Loaded</div>
          </AuthProvider>
        )}
      </TenantResolutionGuard>
    );

    // Should show error about missing org parameter
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText('No se encontró el parámetro de organización. Verifica la URL.')
      ).toBeInTheDocument();
    });

    // Should NOT call any proxy routes
    expect(global.fetch).not.toHaveBeenCalled();

    // Should NOT call redirectToLogin
    expect(mockRedirectToLogin).not.toHaveBeenCalled();
  });

  it('renders widget when token already exists (post-OAuth redirect)', async () => {
    setWindowUrl('http://localhost:3000/?org=test-org');

    // Token exists — simulate returning from OAuth redirect
    mockExtractToken.mockReturnValue('existing-token');
    mockValidateToken.mockResolvedValue({
      name: 'Agent Smith',
      id: 'agent-123',
      groupIds: ['group-a'],
    });

    render(
      <TenantResolutionGuard>
        {(credentials) => (
          <AuthProvider credentials={credentials}>
            <div data-testid="widget-content">Widget Loaded</div>
          </AuthProvider>
        )}
      </TenantResolutionGuard>
    );

    // Should complete tenant resolution and then validate token
    await waitFor(() => {
      expect(mockValidateToken).toHaveBeenCalledWith('existing-token', 'mypurecloud.com');
    });

    // Should render widget content
    await waitFor(() => {
      expect(screen.getByTestId('widget-content')).toBeInTheDocument();
    });

    // Should NOT call redirectToLogin since token is valid
    expect(mockRedirectToLogin).not.toHaveBeenCalled();
  });
});
