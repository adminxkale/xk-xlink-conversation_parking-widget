import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  extractOrg,
  getCachedCredentials,
  setCachedCredentials,
  clearCachedCredentials,
} from '@/src/infrastructure/adapters/tenant-resolution.adapter';

/**
 * Feature: multi-tenant-auth-flow
 * Property 1: Org extraction is idempotent with URL cleaning
 *
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.6**
 *
 * For any valid URL containing an `org` parameter, extracting the org and then
 * extracting again from the cleaned URL (which should fall back to localStorage)
 * produces the same org value.
 */
describe('Feature: multi-tenant-auth-flow, Property 1: Org extraction is idempotent with URL cleaning', () => {
  const originalLocation = window.location;
  const originalReplaceState = window.history.replaceState;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  /**
   * Arbitrary that generates non-empty org strings (alphanumeric + hyphens/underscores).
   * These represent valid organization identifiers.
   */
  const orgArbitrary = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter((s) => s.length > 0);

  it('extracting org from URL and then from localStorage produces the same value', () => {
    fc.assert(
      fc.property(orgArbitrary, (generatedOrg) => {
        // Clear previous state
        localStorage.clear();

        // Setup: URL with ?org= parameter
        Object.defineProperty(window, 'location', {
          value: {
            ...originalLocation,
            search: `?org=${encodeURIComponent(generatedOrg)}`,
            pathname: '/',
            hash: '',
          },
          writable: true,
          configurable: true,
        });

        // First extraction: should get org from URL and store in localStorage
        const result1 = extractOrg();
        expect('org' in result1).toBe(true);
        const org1 = (result1 as { org: string }).org;

        // After extraction, URL is cleaned (replaceState was called).
        // Simulate the cleaned URL state (no org param)
        Object.defineProperty(window, 'location', {
          value: {
            ...originalLocation,
            search: '',
            pathname: '/',
            hash: '',
          },
          writable: true,
          configurable: true,
        });

        // Second extraction: should fall back to localStorage
        const result2 = extractOrg();
        expect('org' in result2).toBe(true);
        const org2 = (result2 as { org: string }).org;

        // Idempotency: both extractions produce the same org
        expect(org1).toBe(org2);
        expect(org1).toBe(generatedOrg);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: multi-tenant-auth-flow
 * Property 6: Cache invalidation on org change
 *
 * **Validates: Requirements 5.5, 5.6**
 *
 * For any two distinct org values (org₁ ≠ org₂), if credentials were cached for org₁
 * and then org₂ is detected, the cached credentials are discarded.
 */
describe('Feature: multi-tenant-auth-flow, Property 6: Cache invalidation on org change', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * Arbitrary that generates non-empty org strings (alphanumeric + hyphens/underscores).
   */
  const orgArbitrary = fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter((s) => s.length > 0);

  /**
   * Arbitrary that generates valid GenesysCredentials objects.
   */
  const credentialsArbitrary = fc.record({
    genesys_client_id: fc.string({ minLength: 1 }),
    genesys_client_secret: fc.string({ minLength: 1 }),
    environment: fc.string({ minLength: 1 }),
  });

  it('cached credentials for org₁ return null when queried with org₂ (org₁ ≠ org₂)', () => {
    fc.assert(
      fc.property(
        orgArbitrary,
        orgArbitrary,
        credentialsArbitrary,
        (org1, org2, credentials) => {
          // Pre-condition: org₁ and org₂ must be distinct
          fc.pre(org1 !== org2);

          // Clear state
          localStorage.clear();

          // Cache credentials for org₁
          setCachedCredentials(org1, credentials);

          // Verify credentials are cached for org₁
          const cached1 = getCachedCredentials(org1);
          expect(cached1).not.toBeNull();
          expect(cached1).toEqual(credentials);

          // When org₂ is detected, cached credentials should return null
          const cached2 = getCachedCredentials(org2);
          expect(cached2).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
