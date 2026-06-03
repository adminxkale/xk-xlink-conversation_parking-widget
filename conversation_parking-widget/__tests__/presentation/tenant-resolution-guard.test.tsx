import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TenantResolutionGuard } from '@/src/presentation/components/TenantResolutionGuard';
import type { TenantResolutionState, GenesysCredentials } from '@/src/domain/entities/tenant';

const mockRetry = vi.fn();
let mockState: TenantResolutionState;

vi.mock('@/src/application/hooks/useTenantResolution', () => ({
  useTenantResolution: () => ({
    state: mockState,
    retry: mockRetry,
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TenantResolutionGuard', () => {
  // -------------------------------------------------------------------------
  // Loading states
  // -------------------------------------------------------------------------
  describe('Loading states', () => {
    it('shows "Inicializando..." with spinner during idle state', () => {
      mockState = { status: 'idle', org: null, tenantId: null, credentials: null, error: null };

      render(
        <TenantResolutionGuard>
          {() => <div>children</div>}
        </TenantResolutionGuard>
      );

      expect(screen.getByText('Inicializando...')).toBeInTheDocument();
      expect(screen.queryByText('children')).not.toBeInTheDocument();
    });

    it('shows "Resolviendo organización..." during resolving-tenant state', () => {
      mockState = { status: 'resolving-tenant', org: 'test-org', tenantId: null, credentials: null, error: null };

      render(
        <TenantResolutionGuard>
          {() => <div>children</div>}
        </TenantResolutionGuard>
      );

      expect(screen.getByText('Resolviendo organización...')).toBeInTheDocument();
      expect(screen.queryByText('children')).not.toBeInTheDocument();
    });

    it('shows "Obteniendo credenciales..." during fetching-credentials state', () => {
      mockState = { status: 'fetching-credentials', org: 'test-org', tenantId: 'tenant-123', credentials: null, error: null };

      render(
        <TenantResolutionGuard>
          {() => <div>children</div>}
        </TenantResolutionGuard>
      );

      expect(screen.getByText('Obteniendo credenciales...')).toBeInTheDocument();
      expect(screen.queryByText('children')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  describe('Error state', () => {
    it('shows error message with role="alert" and "Reintentar" button', () => {
      mockState = { status: 'error', org: 'test-org', tenantId: null, credentials: null, error: 'Error al resolver la organización.' };

      render(
        <TenantResolutionGuard>
          {() => <div>children</div>}
        </TenantResolutionGuard>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Error al resolver la organización.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
      expect(screen.queryByText('children')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Retry button functionality
  // -------------------------------------------------------------------------
  describe('Retry button functionality', () => {
    it('calls retry function when "Reintentar" button is clicked', async () => {
      const user = userEvent.setup();
      mockState = { status: 'error', org: 'test-org', tenantId: null, credentials: null, error: 'Algo falló' };

      render(
        <TenantResolutionGuard>
          {() => <div>children</div>}
        </TenantResolutionGuard>
      );

      const retryButton = screen.getByRole('button', { name: /reintentar/i });
      await user.click(retryButton);

      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Resolved state
  // -------------------------------------------------------------------------
  describe('Resolved state', () => {
    it('renders children with resolved credentials', () => {
      const credentials: GenesysCredentials = {
        genesys_client_id: 'client-abc',
        genesys_client_secret: 'secret-xyz',
        environment: 'mypurecloud.com',
      };
      mockState = { status: 'resolved', org: 'test-org', tenantId: 'tenant-123', credentials, error: null };

      render(
        <TenantResolutionGuard>
          {(creds) => (
            <div data-testid="resolved-content">
              <span>{creds.genesys_client_id}</span>
              <span>{creds.environment}</span>
            </div>
          )}
        </TenantResolutionGuard>
      );

      expect(screen.getByTestId('resolved-content')).toBeInTheDocument();
      expect(screen.getByText('client-abc')).toBeInTheDocument();
      expect(screen.getByText('mypurecloud.com')).toBeInTheDocument();
    });
  });
});
