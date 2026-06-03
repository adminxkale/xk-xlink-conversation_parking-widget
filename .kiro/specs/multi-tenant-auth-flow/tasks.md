# Implementation Plan: Multi-Tenant Auth Flow

## Overview

Implementar soporte multi-tenant en el flujo de autenticación del widget, resolviendo dinámicamente credenciales de Genesys por organización a través de rutas proxy server-side.

## Tasks

- [x] 1. Create `src/domain/entities/tenant.ts` with interfaces `TenantInfo`, `GenesysCredentials`, and `TenantResolutionState`
- [x] 2. Create `app/api/proxy-tenant/route.ts` with GET handler that receives `org` query param, validates it, makes Basic Auth request to Xlink management-multitenant API, validates `tenant_id` in response, and returns it
- [x] 3. Write property test: Basic Auth encoding round-trip for proxy-tenant (`__tests__/api/proxy-tenant.property.test.ts`)
- [x] 4. Write unit tests for proxy-tenant route covering: missing org param (400), successful response (200), upstream error (502), missing tenant_id in response (502)
- [x] 5. Create `app/api/proxy-secret/route.ts` with GET handler that receives `tenantId` query param, validates it, makes Basic Auth request to Xlink management-secret API using STAGE env var, validates credential fields in response, returns only filtered fields
- [x] 6. Write property test: response filtering only returns allowed keys (`__tests__/api/proxy-secret.property.test.ts`)
- [x] 7. Write unit tests for proxy-secret route covering: missing tenantId param (400), successful response with filtered fields (200), upstream error (502), missing credential fields in response (502), internal error (500)
- [x] 8. Create `src/infrastructure/adapters/tenant-resolution.adapter.ts` with functions: `extractOrg()`, `resolveTenant(org)`, `fetchGenesysCredentials(tenantId)`, `getCachedCredentials(org)`, `setCachedCredentials(org, credentials)`, `clearCachedCredentials()`
- [x] 9. Write property test: org extraction idempotency and cache invalidation on org change (`__tests__/infrastructure/tenant-resolution.property.test.ts`)
- [x] 10. Write unit tests for tenant-resolution adapter covering: extractOrg with param present, extractOrg with param absent and localStorage fallback, extractOrg with both absent (error), URL cleaning after extraction, cache hit/miss scenarios
- [x] 11. Modify `redirectToLogin()` in `genesys-auth.adapter.ts` to accept `clientId` and `environment` as parameters, store `environment` in localStorage under `genesys_environment`, remove dependency on NEXT_PUBLIC_ env vars
- [x] 12. Modify `validateToken()` in `genesys-auth.adapter.ts` to accept optional `environment` parameter, fallback to localStorage `genesys_environment` when not provided
- [x] 13. Update existing `useAuth.test.ts` to account for the new parameter signatures
- [x] 14. Create `src/application/hooks/useTenantResolution.ts` that orchestrates: extract org → resolve tenant → fetch credentials, manages `TenantResolutionState`, implements cache logic, and exposes `retry()` function
- [x] 15. Write unit tests for useTenantResolution hook with msw mocking proxy routes, covering: successful flow, tenant resolution failure, credentials fetch failure, retry behavior, cache usage, cache invalidation on org change
- [x] 16. Modify `useAuth` hook to accept `GenesysCredentials` as parameter, pass `clientId` and `environment` to `redirectToLogin()` and `validateToken()`
- [x] 17. Update existing useAuth tests to pass credentials parameter
- [x] 18. Create `src/presentation/components/TenantResolutionGuard.tsx` that uses `useTenantResolution` hook, shows loading state with step description, shows error state with retry button, renders children when resolved
- [x] 19. Write component tests for TenantResolutionGuard covering: loading states, error display, retry button functionality, successful resolution rendering children
- [x] 20. Modify `AuthProvider.tsx` to accept and pass `GenesysCredentials` to `useAuth`
- [x] 21. Update `app/page.tsx` to wrap `AuthProvider` inside `TenantResolutionGuard`, passing resolved credentials
- [x] 22. Update environment variables: rename NEXT_PUBLIC_BASIC_AUTH_USER → AUTH_USER, NEXT_PUBLIC_BASIC_AUTH_PASS → AUTH_PASS, NEXT_PUBLIC_STAGE → STAGE in `.env.local`, remove NEXT_PUBLIC_GENESYS_CLIENT_ID and NEXT_PUBLIC_GENESYS_ENVIRONMENT
- [x] 23. Update all existing proxy routes (`proxy-interactions`, `proxy-queues`, `proxy-group-phones`, `send-template`) to use `AUTH_USER` and `AUTH_PASS` (without NEXT_PUBLIC_ prefix) for Basic Auth construction
- [x] 24. Write property test: proxy routes never expose Basic Auth credentials in response bodies (`__tests__/api/credential-exposure.property.test.ts`)
- [x] 25. Write integration test covering the full startup sequence: org extraction → tenant resolution → credential fetch → OAuth redirect with correct parameters (`__tests__/integration/multi-tenant-auth.test.tsx`)
- [x] 26. Verify all existing tests pass after modifications by running the full test suite

## Task Dependencies

```yaml
dependencies:
  2: [1]
  5: [1]
  8: [1]
  3: [2]
  4: [2]
  6: [5]
  7: [5]
  9: [8]
  10: [8]
  11: [1]
  12: [1]
  13: [11, 12]
  14: [8, 11, 12]
  16: [11, 12]
  15: [14]
  17: [16]
  18: [14]
  19: [18]
  20: [16, 18]
  21: [20, 19]
  22: [20, 19]
  23: [22]
  24: [22]
  25: [23, 24, 21]
  26: [25]
```

## Notes

- Tasks 1-10 can be parallelized in groups (proxy-tenant, proxy-secret, adapter) after task 1.
- Tasks 11-12 modify existing code and must be done before tasks 16-17 which depend on the new signatures.
- Task 22 (env var rename) should be done alongside task 23 (updating existing routes) to avoid breaking the app.
- Property-based tests (tasks 3, 6, 9, 24) use `fast-check` already in devDependencies.
- All tests should run with `npm run test` (vitest --run).
