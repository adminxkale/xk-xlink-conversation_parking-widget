# Design Document

## Overview

Este diseño transforma el flujo de autenticación del widget de una configuración estática (variables de entorno) a una resolución dinámica por tenant. Se añaden dos rutas API proxy (`proxy-tenant` y `proxy-secret`), un adaptador de resolución de tenant, y se modifica el adaptador de autenticación de Genesys para aceptar credenciales dinámicas.

La arquitectura sigue el patrón existente del proyecto: rutas proxy delgadas en App Router, adaptadores puros en infraestructura, y hooks de aplicación que orquestan el flujo.

## Architecture

### Componentes Nuevos

```
app/api/
├── proxy-tenant/route.ts          # Ruta proxy: org → tenant_id
└── proxy-secret/route.ts          # Ruta proxy: tenantId → Genesys credentials

src/
├── domain/
│   └── entities/
│       └── tenant.ts              # Interfaces: TenantInfo, GenesysCredentials, TenantResolutionState
├── infrastructure/
│   └── adapters/
│       └── tenant-resolution.adapter.ts  # Funciones puras: extractOrg, resolveTenant, fetchCredentials
├── application/
│   └── hooks/
│       └── useTenantResolution.ts  # Hook que orquesta la resolución multi-tenant
└── presentation/
    └── components/
        └── TenantResolutionGuard.tsx  # Componente que muestra loading/error/children
```

### Componentes Modificados

```
src/infrastructure/adapters/genesys-auth.adapter.ts  # redirectToLogin y validateToken aceptan parámetros dinámicos
src/application/hooks/useAuth.ts                      # Recibe credentials como parámetro en vez de leer env vars
src/presentation/components/AuthProvider.tsx          # Orquesta tenant resolution → auth
app/page.tsx                                          # Wrapper con TenantResolutionGuard
```

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│ Widget Load                                                      │
│                                                                  │
│  1. extractOrg(url) → org (string)                              │
│     └─ Persiste en localStorage('xlink_org')                    │
│                                                                  │
│  2. GET /api/proxy-tenant?org={org}                             │
│     └─ Server: GET xlink API → { tenant_id }                   │
│     └─ Return: { tenant_id }                                    │
│                                                                  │
│  3. GET /api/proxy-secret?tenantId={tenant_id}                  │
│     └─ Server: GET xlink API → credentials                     │
│     └─ Return: { genesys_client_id, genesys_client_secret,      │
│                  environment }                                   │
│                                                                  │
│  4. redirectToLogin(client_id, environment)                     │
│     └─ Persiste environment en localStorage('genesys_environment')│
│     └─ Redirect → Genesys OAuth                                 │
│                                                                  │
│  5. extractToken() → token                                      │
│     └─ validateToken(token, environment) → agent info           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Domain Entity: `tenant.ts`

**Path:** `src/domain/entities/tenant.ts`

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

### 2. API Route: `proxy-tenant`

**Path:** `app/api/proxy-tenant/route.ts`

- Receives query param: `org`
- Constructs Basic Auth from `AUTH_USER` and `AUTH_PASS` env vars (server-side only)
- Makes GET to: `https://api.xlinkapp.cloud/management-multitenant/external/management-tables/tenant/{org}`
- Validates response contains `tenant_id`
- Returns `{ tenant_id }` on success
- Returns 400 if `org` missing, 502 if upstream fails or `tenant_id` absent

### 3. API Route: `proxy-secret`

**Path:** `app/api/proxy-secret/route.ts`

- Receives query param: `tenantId`
- Constructs Basic Auth from `AUTH_USER` and `AUTH_PASS` env vars (server-side only)
- Makes GET to: `https://api.xlinkapp.cloud/management-secret/secret?secretId=/xlink/{STAGE}/integration/widget/{tenantId}`
- `STAGE` comes from server-side env var `STAGE`
- Validates response contains required credential fields
- Returns only `{ genesys_client_id, genesys_client_secret, environment }` (filtered)
- Returns 400 if `tenantId` missing, 502 if upstream fails, 500 on internal error

### 4. Adapter: `tenant-resolution.adapter.ts`

**Path:** `src/infrastructure/adapters/tenant-resolution.adapter.ts`

Pure functions for client-side tenant resolution orchestration:

```typescript
// Extract org from URL query params or localStorage
function extractOrg(): { org: string } | { error: string }

// Call proxy-tenant route
function resolveTenant(org: string): Promise<{ tenant_id: string }>

// Call proxy-secret route
function fetchGenesysCredentials(tenantId: string): Promise<GenesysCredentials>

// Cache management
function getCachedCredentials(org: string): GenesysCredentials | null
function setCachedCredentials(org: string, credentials: GenesysCredentials): void
function clearCachedCredentials(): void
```

### 5. Modified Adapter: `genesys-auth.adapter.ts`

Changes to existing function signatures:

```typescript
// Before: redirectToLogin(): void (reads from env vars)
// After: accepts dynamic credentials
function redirectToLogin(clientId: string, environment: string): void

// Before: validateToken(token: string): Promise<{...}>  (reads env for environment)
// After: accepts optional environment param
function validateToken(token: string, environment?: string): Promise<{ name: string; id: string; groupIds: string[] }>
```

### 6. Hook: `useTenantResolution`

**Path:** `src/application/hooks/useTenantResolution.ts`

```typescript
interface UseTenantResolutionReturn {
  state: TenantResolutionState;
  retry: () => void;
}

function useTenantResolution(): UseTenantResolutionReturn
```

### 7. Modified Hook: `useAuth`

```typescript
// Before: useAuth(): AuthState
// After: accepts credentials parameter
function useAuth(credentials: GenesysCredentials | null): AuthState
```

### 8. Component: `TenantResolutionGuard`

**Path:** `src/presentation/components/TenantResolutionGuard.tsx`

```typescript
interface TenantResolutionGuardProps {
  children: (credentials: GenesysCredentials) => ReactNode;
}

function TenantResolutionGuard({ children }: TenantResolutionGuardProps): JSX.Element
```

## Data Models

### localStorage Schema

| Key | Type | Content | Written By | Read By |
|-----|------|---------|-----------|---------|
| `xlink_org` | `string` | Organization identifier | `extractOrg()` | `extractOrg()`, cache validation |
| `genesys_credentials` | `JSON string` | Serialized `GenesysCredentials` | `setCachedCredentials()` | `getCachedCredentials()` |
| `genesys_environment` | `string` | Environment for post-redirect use | `redirectToLogin()` | `validateToken()` |
| `genesys_token` | `string` | OAuth access token (existing) | `extractToken()` | `extractToken()` |

### Environment Variables

#### New (server-side only)

| Variable | Purpose |
|----------|---------|
| `AUTH_USER` | Basic Auth username for Xlink API |
| `AUTH_PASS` | Basic Auth password for Xlink API |
| `STAGE` | Deployment stage (dev/staging/prod) for secret path construction |

#### Deprecated (to be removed)

| Variable | Replaced By |
|----------|-------------|
| `NEXT_PUBLIC_GENESYS_CLIENT_ID` | Dynamically resolved via proxy-secret |
| `NEXT_PUBLIC_GENESYS_ENVIRONMENT` | Dynamically resolved via proxy-secret |
| `NEXT_PUBLIC_BASIC_AUTH_USER` | Renamed to `AUTH_USER` (no longer public) |
| `NEXT_PUBLIC_BASIC_AUTH_PASS` | Renamed to `AUTH_PASS` (no longer public) |
| `NEXT_PUBLIC_STAGE` | Renamed to `STAGE` (no longer public) |

### API Response Schemas

**proxy-tenant (success):**
```json
{ "tenant_id": "string" }
```

**proxy-secret (success):**
```json
{
  "genesys_client_id": "string",
  "genesys_client_secret": "string",
  "environment": "string"
}
```

**Error responses:**
```json
{ "error": "descriptive error message" }
```

## Error Handling

| Step | Error Condition | HTTP Status | User-Facing Message | Recovery |
|------|----------------|-------------|--------------------|-|
| Extract org | Missing from URL and localStorage | N/A (client) | "No se encontró el parámetro de organización. Verifica la URL." | Retry (reload) |
| Extract org | localStorage access fails | N/A (client) | "No se pudo determinar la organización." | Retry |
| Resolve tenant | Network error | 502 | "Error al resolver la organización. Verifica tu conexión." | Retry button |
| Resolve tenant | Missing org param | 400 | "Error interno al resolver la organización." | Retry button |
| Resolve tenant | Upstream API error | 502 | "Error al resolver la organización." | Retry button |
| Resolve tenant | tenant_id missing in response | 502 | "No se encontró el tenant para esta organización." | Retry button |
| Fetch credentials | Network error | 502 | "Error al obtener credenciales. Contacta al administrador." | Retry button |
| Fetch credentials | Missing tenantId param | 400 | "Error interno al obtener credenciales." | Retry button |
| Fetch credentials | Upstream API error | 502 | "Error al obtener credenciales." | Retry button |
| Fetch credentials | Credential fields missing | 502 | "Credenciales incompletas para esta organización." | Retry button |
| Fetch credentials | Internal server error | 500 | "Error interno del servidor." | Retry button |
| OAuth redirect | Invalid credentials | N/A (client) | "Error de autenticación. Credenciales inválidas para esta organización." | Retry button |

## Correctness Properties

### Property 1: Org extraction is idempotent with URL cleaning

For any valid URL containing an `org` parameter, extracting the org and then extracting again from the cleaned URL (which should fall back to localStorage) produces the same org value.

```
extractOrg(url_with_org) → org₁
// URL is cleaned, org stored in localStorage
extractOrg(url_without_org) → org₂ (from localStorage)
org₁ === org₂
```

**Validates: Requirements 1.1, 1.2, 1.4, 1.6**

### Property 2: Basic Auth encoding is a valid Base64 round-trip

For any pair of (user, pass) strings, the Basic Auth header produced by the proxy routes is a valid Base64 encoding that decodes back to `{user}:{pass}`.

```
header = 'Basic ' + base64encode(user + ':' + pass)
decode(header.replace('Basic ', '')) === user + ':' + pass
```

**Validates: Requirements 2.2, 3.2, 6.1, 6.2**

### Property 3: Tenant resolver URL construction preserves org identifier

For any non-empty org string, the URL constructed by the Tenant_Resolver contains the org value as the last path segment.

```
url = `https://api.xlinkapp.cloud/management-multitenant/external/management-tables/tenant/${org}`
url.endsWith('/' + org) === true
```

**Validates: Requirements 2.1**

### Property 4: Secret resolver URL construction includes both STAGE and tenantId

For any non-empty STAGE and tenantId, the URL constructed by the Secret_Resolver contains both values in the correct positions within the secretId parameter.

```
secretId = `/xlink/${STAGE}/integration/widget/${tenantId}`
secretId.includes(STAGE) && secretId.includes(tenantId)
```

**Validates: Requirements 3.1**

### Property 5: Secret resolver response filtering

For any JSON response from the Xlink API (with arbitrary extra fields), the Secret_Resolver returns only the fields `genesys_client_id`, `genesys_client_secret`, and `environment`. No other keys from the original response appear in the output.

```
output_keys ⊆ { 'genesys_client_id', 'genesys_client_secret', 'environment' }
```

**Validates: Requirements 6.6**

### Property 6: Cache invalidation on org change

For any two distinct org values (org₁ ≠ org₂), if credentials were cached for org₁ and then org₂ is detected, the cached credentials are discarded and re-resolution occurs.

```
setCachedCredentials(org₁, creds₁)
// org₂ detected
getCachedCredentials(org₂) === null
```

**Validates: Requirements 5.5, 5.6**

### Property 7: Proxy routes never expose Basic Auth credentials in responses

For any valid or invalid request to proxy-tenant or proxy-secret, the response body (serialized as string) does not contain the AUTH_USER or AUTH_PASS values, nor the Base64-encoded Basic Auth header value.

```
response_body_string.includes(AUTH_USER) === false
response_body_string.includes(AUTH_PASS) === false
response_body_string.includes(base64(AUTH_USER + ':' + AUTH_PASS)) === false
```

**Validates: Requirements 6.3, 6.4**

## Testing Strategy

| Component | Test Type | Location |
|-----------|-----------|----------|
| `extractOrg` (URL parsing + localStorage) | Property-based | `__tests__/infrastructure/tenant-resolution.property.test.ts` |
| Basic Auth encoding (proxy routes) | Property-based | `__tests__/api/proxy-tenant.property.test.ts` |
| Secret response filtering | Property-based | `__tests__/api/proxy-secret.property.test.ts` |
| Credential non-exposure | Property-based | `__tests__/api/credential-exposure.property.test.ts` |
| `proxy-tenant/route.ts` | Unit (example-based) | `app/api/proxy-tenant/route.test.ts` |
| `proxy-secret/route.ts` | Unit (example-based) | `app/api/proxy-secret/route.test.ts` |
| `useTenantResolution` hook | Unit (example-based with msw) | `src/application/hooks/useTenantResolution.test.ts` |
| `useAuth` (modified) | Unit (mocked adapter) | `src/application/hooks/useAuth.test.ts` (update existing) |
| `TenantResolutionGuard` | Component test | `__tests__/presentation/tenant-resolution-guard.test.tsx` |
| End-to-end flow | Integration | `__tests__/integration/multi-tenant-auth.test.tsx` |
