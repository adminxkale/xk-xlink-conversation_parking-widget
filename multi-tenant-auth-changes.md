# Multi-Tenant Auth Flow — Guía de Implementación

## Resumen

Implementar soporte multi-tenant en el widget. El widget resuelve dinámicamente las credenciales de Genesys por organización (`?org=xxx` en la URL) usando rutas proxy server-side. El `tenant_id` resuelto se usa para las APIs de interacciones y líneas.

## Flujo completo

1. Widget carga con `?org=hightelecom`
2. Extrae org de URL → guarda en localStorage → limpia URL
3. `GET /api/proxy-tenant?org=hightelecom` → devuelve `{ tenant_id: "Xkale" }`
4. `GET /api/proxy-secret?org=hightelecom` → devuelve `{ genesys_client_id, genesys_client_secret, environment }`
5. Con las credenciales, redirige al OAuth de Genesys
6. Tras autenticarse, usa `tenant_id` para consultar interacciones y líneas

## URLs externas

| Ruta proxy | URL externa |
|------------|-------------|
| `proxy-tenant?org=X` | `https://api.xlinkapp.cloud/management-multitenant/external/management-tables/tenant/{org}` |
| `proxy-secret?org=X` | `https://api.xlinkapp.cloud/management-secret/secret?secretId=/xlink/{STAGE}/integration/widget/{org}` |
| `proxy-group-phones?tenant=X` | `https://api.xlinkapp.cloud/management-multitenant/external/management-tables/xlink-{STAGE}-template-cache/{tenant}` |
| `proxy-interactions?agent_id=X&tenant=Y` | `https://api.xlinkapp.cloud/session-manager/{tenant}/agent/{agentId}` |
| `proxy-interactions/unpark` (body: tenant) | `https://api.xlinkapp.cloud/session-manager/{tenant}/{business}/{client}/` |

---

## 1. `.env.local` (server-side only, sin NEXT_PUBLIC_)

```env
AUTH_USER='Xkale'
AUTH_PASS='SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
STAGE='dev'
```

---

## 2. `src/domain/entities/tenant.ts` (NUEVO)

```typescript
export interface TenantInfo {
  tenant_id: string;
}

export interface GenesysCredentials {
  genesys_client_id: string;
  genesys_client_secret: string;
  environment: string;
}

export interface TenantResolutionState {
  status: 'idle' | 'resolving-tenant' | 'fetching-credentials' | 'resolved' | 'error';
  org: string | null;
  tenantId: string | null;
  credentials: GenesysCredentials | null;
  error: string | null;
}
```

---

## 3. `src/domain/entities/auth.ts` (MODIFICADO — agregar `tenantId`)

```typescript
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  agent: { name: string; id: string } | null;
  agentGroupIds: string[] | null;
  tenantId: string | null;
  error: string | null;
}
```

---

## 4. `app/api/proxy-tenant/route.ts` (NUEVO)

```typescript
import { NextResponse } from 'next/server';

const BASE_URL = 'https://api.xlinkapp.cloud/management-multitenant/external/management-tables/tenant';

export function buildBasicAuth(user?: string, pass?: string): string {
  const u = user ?? process.env.AUTH_USER ?? '';
  const p = pass ?? process.env.AUTH_PASS ?? '';
  return 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');
}

export function buildTenantUrl(org: string): string {
  return `${BASE_URL}/${org}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const org = searchParams.get('org');

  if (!org) {
    return NextResponse.json({ error: 'Missing required query parameter: org' }, { status: 400 });
  }

  const targetUrl = `${BASE_URL}/${org}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 'Content-Type': 'application/json', 'Authorization': buildBasicAuth() },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `External API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();

    if (!data.tenant_id) {
      return NextResponse.json({ error: 'Tenant resolution failed: tenant_id not found in response' }, { status: 502 });
    }

    return NextResponse.json({ tenant_id: data.tenant_id });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to reach external API' }, { status: 502 });
  }
}
```

---

## 5. `app/api/proxy-secret/route.ts` (NUEVO)

```typescript
import { NextResponse } from 'next/server';

const BASE_URL = 'https://api.xlinkapp.cloud/management-secret/secret';

function buildBasicAuth(): string {
  const user = process.env.AUTH_USER ?? '';
  const pass = process.env.AUTH_PASS ?? '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const org = searchParams.get('org');

  if (!org) {
    return NextResponse.json({ error: 'Missing required query parameter: org' }, { status: 400 });
  }

  const stage = process.env.STAGE ?? '';
  const secretId = `/xlink/${stage}/integration/widget/${org}`;
  const targetUrl = `${BASE_URL}?secretId=${secretId}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 'Content-Type': 'application/json', 'Authorization': buildBasicAuth() },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `External API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();

    if (!data.genesys_client_id || !data.genesys_client_secret || !data.environment) {
      return NextResponse.json({ error: 'Credential retrieval failed: required fields not found' }, { status: 502 });
    }

    return NextResponse.json({
      genesys_client_id: data.genesys_client_id,
      genesys_client_secret: data.genesys_client_secret,
      environment: data.environment,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## 6. `app/api/proxy-group-phones/route.ts` (MODIFICADO — usa tenant + STAGE)

```typescript
import { NextResponse } from 'next/server';

const BASE_URL = 'https://api.xlinkapp.cloud/management-multitenant/external/management-tables';

function buildBasicAuth(): string {
  const user = process.env.AUTH_USER ?? '';
  const pass = process.env.AUTH_PASS ?? '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenant = searchParams.get('tenant');

  if (!tenant) {
    return NextResponse.json({ error: 'Missing required query parameter: tenant' }, { status: 400 });
  }

  const stage = process.env.STAGE ?? '';
  const tableName = `xlink-${stage}-template-cache`;
  const targetUrl = `${BASE_URL}/${tableName}/${tenant}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 'Content-Type': 'application/json', 'Authorization': buildBasicAuth() },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `External API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to reach external API' }, { status: 502 });
  }
}
```

---

## 7. `app/api/proxy-interactions/route.ts` (MODIFICADO — usa tenant)

```typescript
import { NextResponse } from 'next/server';

const BASE_URL = 'https://api.xlinkapp.cloud';

function buildBasicAuth(): string {
  const user = process.env.AUTH_USER ?? '';
  const pass = process.env.AUTH_PASS ?? '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agent_id');
  const tenant = searchParams.get('tenant');

  if (!agentId) {
    return NextResponse.json({ error: 'Missing required query parameter: agent_id' }, { status: 400 });
  }
  if (!tenant) {
    return NextResponse.json({ error: 'Missing required query parameter: tenant' }, { status: 400 });
  }

  const targetUrl = `${BASE_URL}/session-manager/${tenant}/agent/${agentId}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { 'Content-Type': 'application/json', 'Authorization': buildBasicAuth() },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ statusCode: 200, message: 'No existen sesiones para este agente', total: 0, data: [] });
      }
      return NextResponse.json({ error: `External API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to reach external API' }, { status: 502 });
  }
}
```

---

## 8. `app/api/proxy-interactions/unpark/route.ts` (MODIFICADO — usa tenant)

```typescript
import { NextResponse } from 'next/server';

const BASE_URL = 'https://api.xlinkapp.cloud';

function buildBasicAuth(): string {
  const user = process.env.AUTH_USER ?? '';
  const pass = process.env.AUTH_PASS ?? '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export async function PUT(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { business, client, tenant } = body as { business?: string; client?: string; tenant?: string };

  if (!business || !client || !tenant) {
    return NextResponse.json({ error: 'Missing required fields: business, client, tenant' }, { status: 400 });
  }

  const targetUrl = `${BASE_URL}/session-manager/${tenant}/${business}/${client}/`;

  try {
    const response = await fetch(targetUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': buildBasicAuth() },
      body: JSON.stringify({ parking: false }),
    });

    if (!response.ok) {
      let userMessage = 'No se pudo desparquear la conversación. Intenta de nuevo.';
      if (response.status === 403) userMessage = 'No tienes permisos para desparquear esta conversación.';
      else if (response.status === 404) userMessage = 'La conversación no fue encontrada o ya fue desparqueada.';
      return NextResponse.json({ error: userMessage }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to reach external API' }, { status: 502 });
  }
}
```

---

## 9. `src/infrastructure/adapters/tenant-resolution.adapter.ts` (NUEVO)

```typescript
import { GenesysCredentials } from '@/src/domain/entities/tenant';

const ORG_KEY = 'xlink_org';
const CREDENTIALS_KEY = 'genesys_credentials';

export function extractOrg(): { org: string } | { error: string } {
  if (typeof window === 'undefined') {
    return { error: 'No se pudo determinar la organización.' };
  }

  const queryParams = new URLSearchParams(window.location.search);
  const orgParam = queryParams.get('org');

  if (orgParam) {
    localStorage.setItem(ORG_KEY, orgParam);
    queryParams.delete('org');
    const remaining = queryParams.toString();
    const cleanUrl = window.location.pathname + (remaining ? `?${remaining}` : '') + window.location.hash;
    window.history.replaceState(null, '', cleanUrl);
    return { org: orgParam };
  }

  try {
    const storedOrg = localStorage.getItem(ORG_KEY);
    if (storedOrg) return { org: storedOrg };
  } catch {
    return { error: 'No se pudo determinar la organización.' };
  }

  return { error: 'No se encontró el parámetro de organización. Verifica la URL.' };
}

export async function resolveTenant(org: string): Promise<{ tenant_id: string }> {
  const response = await fetch(`/api/proxy-tenant?org=${encodeURIComponent(org)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Error al resolver la organización.' }));
    throw new Error(data.error || 'Error al resolver la organización.');
  }
  return response.json();
}

export async function fetchGenesysCredentials(org: string): Promise<GenesysCredentials> {
  const response = await fetch(`/api/proxy-secret?org=${encodeURIComponent(org)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Error al obtener credenciales.' }));
    throw new Error(data.error || 'Error al obtener credenciales.');
  }
  return response.json();
}

export function getCachedCredentials(org: string): { credentials: GenesysCredentials; tenantId: string } | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { org: string; credentials: GenesysCredentials; tenantId?: string };
    if (parsed.org !== org) return null;
    return { credentials: parsed.credentials, tenantId: parsed.tenantId ?? '' };
  } catch {
    return null;
  }
}

export function setCachedCredentials(org: string, credentials: GenesysCredentials, tenantId: string): void {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ org, credentials, tenantId }));
}

export function clearCachedCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
}
```

---

## 10. `src/infrastructure/adapters/genesys-auth.adapter.ts` (MODIFICADO)

Cambios clave:
- `redirectToLogin(clientId: string, environment: string)` — ya no lee env vars
- `validateToken(token, environment?)` — fallback a localStorage

```typescript
const TOKEN_KEY = 'genesys_token';
const ENVIRONMENT_KEY = 'genesys_environment';

export function extractToken(): string | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (hash) {
    const hashParams = new URLSearchParams(hash.substring(1));
    const hashToken = hashParams.get('access_token');
    if (hashToken) {
      localStorage.setItem(TOKEN_KEY, hashToken);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return hashToken;
    }
  }

  const queryParams = new URLSearchParams(window.location.search);
  const queryToken = queryParams.get('access_token');
  if (queryToken) {
    localStorage.setItem(TOKEN_KEY, queryToken);
    queryParams.delete('access_token');
    const remaining = queryParams.toString();
    window.history.replaceState(null, '', window.location.pathname + (remaining ? `?${remaining}` : ''));
    return queryToken;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export async function validateToken(
  token: string,
  environment?: string
): Promise<{ name: string; id: string; groupIds: string[] }> {
  const resolvedEnvironment =
    environment ?? (typeof window !== 'undefined' ? localStorage.getItem(ENVIRONMENT_KEY) : null);

  if (!resolvedEnvironment) {
    throw new Error('Genesys environment is not available.');
  }

  const response = await fetch(
    `https://api.${resolvedEnvironment}/api/v2/users/me?expand=groups`,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  if (!response.ok) {
    throw new Error(`Token validation failed with status ${response.status}`);
  }

  const data = await response.json();
  const groupIds = Array.isArray(data.groups) ? data.groups.map((g: { id: string }) => g.id) : [];
  return { name: data.name ?? '', id: data.id ?? '', groupIds };
}

export function redirectToLogin(clientId: string, environment: string): void {
  localStorage.setItem(ENVIRONMENT_KEY, environment);
  const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
  window.location.href =
    `https://login.${environment}/oauth/authorize` +
    `?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}`;
}

export function clearToken(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}
```

---

## 11. `src/application/hooks/useTenantResolution.ts` (NUEVO)

```typescript
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

export function useTenantResolution() {
  const [state, setState] = useState<TenantResolutionState>({
    status: 'idle', org: null, tenantId: null, credentials: null, error: null,
  });

  const resolve = useCallback(async () => {
    const orgResult = extractOrg();
    if ('error' in orgResult) {
      setState({ status: 'error', org: null, tenantId: null, credentials: null, error: orgResult.error });
      return;
    }
    const { org } = orgResult;

    const cached = getCachedCredentials(org);
    if (cached) {
      setState({ status: 'resolved', org, tenantId: cached.tenantId, credentials: cached.credentials, error: null });
      return;
    }

    setState({ status: 'resolving-tenant', org, tenantId: null, credentials: null, error: null });
    try {
      const { tenant_id } = await resolveTenant(org);
      setState({ status: 'fetching-credentials', org, tenantId: tenant_id, credentials: null, error: null });
      const credentials = await fetchGenesysCredentials(org);
      setCachedCredentials(org, credentials, tenant_id);
      setState({ status: 'resolved', org, tenantId: tenant_id, credentials, error: null });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido.';
      setState(prev => ({ ...prev, status: 'error', error: errorMessage }));
    }
  }, []);

  useEffect(() => { resolve(); }, [resolve]);

  const retry = useCallback(() => {
    clearCachedCredentials();
    setState({ status: 'idle', org: null, tenantId: null, credentials: null, error: null });
    resolve();
  }, [resolve]);

  return { state, retry };
}
```

---

## 12. `src/application/hooks/useAuth.ts` (MODIFICADO)

```typescript
"use client";

import { useState, useEffect } from "react";
import type { AuthState } from "../../domain/entities/auth";
import type { GenesysCredentials } from "../../domain/entities/tenant";
import {
  extractToken, validateToken, clearToken, redirectToLogin,
} from "../../infrastructure/adapters/genesys-auth.adapter";

const initialState: AuthState = {
  isAuthenticated: false, isLoading: true, token: null,
  agent: null, agentGroupIds: null, tenantId: null, error: null,
};

export function useAuth(credentials: GenesysCredentials | null): AuthState {
  const [state, setState] = useState<AuthState>(initialState);

  useEffect(() => {
    if (!credentials) return;
    let cancelled = false;

    async function authenticate() {
      const token = extractToken();

      if (!token) {
        const alreadyRedirected = sessionStorage.getItem('auth_redirect_pending');
        if (alreadyRedirected) {
          sessionStorage.removeItem('auth_redirect_pending');
          if (!cancelled) {
            setState({
              isAuthenticated: false, isLoading: false, token: null,
              agent: null, agentGroupIds: null, tenantId: null,
              error: 'No se pudo obtener el token de autenticación. Verifica la configuración OAuth.',
            });
          }
          return;
        }
        sessionStorage.setItem('auth_redirect_pending', 'true');
        redirectToLogin(credentials!.genesys_client_id, credentials!.environment);
        return;
      }

      sessionStorage.removeItem('auth_redirect_pending');

      try {
        const { name, id, groupIds } = await validateToken(token, credentials!.environment);
        if (cancelled) return;
        setState({
          isAuthenticated: true, isLoading: false, token,
          agent: { name, id }, agentGroupIds: groupIds, tenantId: null, error: null,
        });
      } catch (err) {
        if (cancelled) return;
        clearToken();
        setState({
          isAuthenticated: false, isLoading: false, token: null,
          agent: null, agentGroupIds: null, tenantId: null,
          error: err instanceof Error ? err.message : "Authentication failed",
        });
      }
    }

    authenticate();
    return () => { cancelled = true; };
  }, [credentials]);

  return state;
}
```

---

## 13. `src/presentation/components/TenantResolutionGuard.tsx` (NUEVO)

```typescript
'use client';

import { ReactNode } from 'react';
import { GenesysCredentials } from '@/src/domain/entities/tenant';
import { useTenantResolution } from '@/src/application/hooks/useTenantResolution';

interface TenantResolutionGuardProps {
  children: (credentials: GenesysCredentials, tenantId: string) => ReactNode;
}

export function TenantResolutionGuard({ children }: TenantResolutionGuardProps) {
  const { state, retry } = useTenantResolution();

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

  if (state.status === 'resolved' && state.credentials) {
    return <>{children(state.credentials, state.tenantId ?? '')}</>;
  }

  return <></>;
}
```

---

## 14. `src/presentation/components/AuthProvider.tsx` (MODIFICADO)

```typescript
"use client";
import { ReactNode } from 'react';
import { AuthContext } from '../providers/AuthContext';
import { useAuth } from '../../application/hooks/useAuth';
import type { GenesysCredentials } from '@/src/domain/entities/tenant';

interface AuthProviderProps {
  children: ReactNode;
  credentials: GenesysCredentials | null;
  tenantId: string;
}

export function AuthProvider({ children, credentials, tenantId }: AuthProviderProps) {
  const authState = useAuth(credentials);
  const stateWithTenant = { ...authState, tenantId };

  if (authState.isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-gray-500">
          <svg className="animate-spin h-6 w-6 text-blue-500 mx-auto mb-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Autenticando...
        </div>
      </div>
    );
  }

  if (authState.error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-red-600 text-sm mb-3">{authState.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 min-h-[44px]"
            aria-label="Reintentar autenticación"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={stateWithTenant}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 15. `src/presentation/providers/AuthContext.tsx` (MODIFICADO)

```typescript
"use client";
import { createContext, useContext } from 'react';
import type { AuthState } from '../../domain/entities/auth';

const defaultState: AuthState = {
  isAuthenticated: false, isLoading: true, token: null,
  agent: null, agentGroupIds: null, tenantId: null, error: null,
};

export const AuthContext = createContext<AuthState>(defaultState);

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
```

---

## 16. `app/page.tsx` (MODIFICADO)

```typescript
"use client";

import { TenantResolutionGuard } from '../src/presentation/components/TenantResolutionGuard';
import { AuthProvider } from '../src/presentation/components/AuthProvider';
import { YourWidget } from '../src/presentation/components/YourWidget';

export default function Home() {
  return (
    <TenantResolutionGuard>
      {(credentials, tenantId) => (
        <AuthProvider credentials={credentials} tenantId={tenantId}>
          <YourWidget />
        </AuthProvider>
      )}
    </TenantResolutionGuard>
  );
}
```

---

## 17. Cambios en servicios y hooks del cliente

### `domain/ports/interaction-service.port.ts`

```typescript
export interface UnparkParams {
  id: string;
  business: string;
  client: string;
  agentId: string;
  agentName: string;
  queueId: string;
  token: string;
  tenant: string;
}

export interface InteractionService {
  getInteractions(agentId?: string, tenant?: string): Promise<Interaction[]>;
  unparkInteraction(params: UnparkParams): Promise<Interaction>;
}
```

### `useInteractions` hook

Recibe `tenant` como tercer parámetro:

```typescript
export function useInteractions(
  agentId: string | null,
  token: string | null,
  tenant: string | null,
  addToast?: (params: { type: ToastType; message: string }) => void
)
```

- `fetchInteractions`: no ejecuta si `!tenant`
- `getInteractions(service, agentId, tenant)`
- `unparkInteraction(service, { ...params, tenant: tenant ?? '' })`

### `useAgentLines` hook

Recibe `tenant` como segundo parámetro:

```typescript
export function useAgentLines(
  agentGroupIds: string[] | null,
  tenant?: string | null
)
```

- Early return si `!tenant`
- `fetchGroupPhones(gid, tenant)`

### `fetchGroupPhones` en `lines.adapter.ts`

```typescript
export async function fetchGroupPhones(groupId: string, tenant?: string): Promise<Line[]> {
  if (!tenant) throw new Error('Tenant is required to fetch group phones');
  const response = await fetch(`/api/proxy-group-phones?tenant=${encodeURIComponent(tenant)}`);
  // ...
}
```

### `RealInteractionService`

```typescript
async getInteractions(agentId?: string, tenant?: string): Promise<Interaction[]> {
  if (!agentId || !tenant) return [];
  const response = await fetch(
    `/api/proxy-interactions?agent_id=${encodeURIComponent(agentId)}&tenant=${encodeURIComponent(tenant)}`
  );
  // ...
}

// En unparkInteraction:
body: JSON.stringify({ business: params.business, client: params.client, tenant: params.tenant })
```

### `ConversationParkingWidget`

```typescript
const { agentGroupIds, agent, token, tenantId } = useAuthContext();
const { lines, ... } = useAgentLines(agentGroupIds, tenantId);
const { interactions, ... } = useInteractions(agent?.id ?? null, token, tenantId, addToast);
```
