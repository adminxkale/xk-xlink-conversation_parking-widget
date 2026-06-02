import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { extractToken } from '../../src/infrastructure/adapters/genesys-auth.adapter';

/**
 * Feature: conversation-parking-widget, Property 1: Extracción de token desde múltiples fuentes
 *
 * Validates: Requirements 1.1
 *
 * For any combination of presence/absence of token in URL hash, query params,
 * and localStorage, extractToken must return the token if it exists in at least
 * one source, and null if it doesn't exist in any.
 * Priority: hash > query > localStorage.
 */
describe('Feature: conversation-parking-widget, Property 1: Extracción de token desde múltiples fuentes', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  /**
   * Arbitrary that generates an optional token string (non-empty alphanumeric) or null.
   */
  const optionalToken = fc.option(
    fc.stringMatching(/^[a-zA-Z0-9_-]+$/).filter((s) => s.length > 0),
    { nil: null }
  );

  it('returns a token if any source has one, null if none; respects hash > query > localStorage priority', () => {
    fc.assert(
      fc.property(
        optionalToken,
        optionalToken,
        optionalToken,
        (hashToken, queryToken, localStorageToken) => {
          // Setup localStorage
          localStorage.clear();
          if (localStorageToken !== null) {
            localStorage.setItem('genesys_token', localStorageToken);
          }

          // Setup window.location with hash and search
          const hash = hashToken !== null ? `#access_token=${hashToken}` : '';
          const search = queryToken !== null ? `?access_token=${queryToken}` : '';

          Object.defineProperty(window, 'location', {
            value: { ...originalLocation, hash, search },
            writable: true,
            configurable: true,
          });

          const result = extractToken();

          const anyTokenExists =
            hashToken !== null || queryToken !== null || localStorageToken !== null;

          if (!anyTokenExists) {
            // No token in any source → must return null
            expect(result).toBeNull();
          } else {
            // At least one source has a token → must return a non-null string
            expect(result).not.toBeNull();
            expect(typeof result).toBe('string');
            expect(result!.length).toBeGreaterThan(0);
          }

          // Verify priority: hash > query > localStorage
          if (hashToken !== null) {
            expect(result).toBe(hashToken);
          } else if (queryToken !== null) {
            expect(result).toBe(queryToken);
          } else if (localStorageToken !== null) {
            expect(result).toBe(localStorageToken);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
