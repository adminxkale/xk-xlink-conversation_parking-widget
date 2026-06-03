'use client';

import { ReactNode } from 'react';
import { GenesysCredentials } from '@/src/domain/entities/tenant';
import { useTenantResolution } from '@/src/application/hooks/useTenantResolution';

interface TenantResolutionGuardProps {
  children: (credentials: GenesysCredentials, tenantId: string) => ReactNode;
}

export function TenantResolutionGuard({ children }: TenantResolutionGuardProps) {
  const { state, retry } = useTenantResolution();

  // Loading states
  if (state.status === 'idle' || state.status === 'resolving-tenant' || state.status === 'fetching-credentials') {
    const stepMessage = state.status === 'resolving-tenant'
      ? 'Resolviendo organización...'
      : state.status === 'fetching-credentials'
      ? 'Obteniendo credenciales...'
      : 'Inicializando...';

    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
        <svg className="animate-spin w-6 h-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-gray-500">{stepMessage}</p>
      </div>
    );
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-8" role="alert">
        <p className="text-sm text-red-600">{state.error}</p>
        <button
          onClick={retry}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Resolved — render children with credentials
  if (state.status === 'resolved' && state.credentials) {
    return <>{children(state.credentials, state.tenantId ?? '')}</>;
  }

  // Fallback (shouldn't happen)
  return <></>;
}
