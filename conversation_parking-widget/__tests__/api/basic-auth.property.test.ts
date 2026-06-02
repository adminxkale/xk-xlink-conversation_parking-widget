import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildBasicAuth } from '../../app/api/send-template/route';

/**
 * Feature: conversation-parking-widget, Property 7: Construcción correcta de credenciales Basic Auth
 *
 * Validates: Requirements 7.3
 *
 * For any pair of strings (user, password), the authorization header built by
 * buildBasicAuth must be exactly "Basic " + base64(user + ":" + password).
 */
describe('Feature: conversation-parking-widget, Property 7: Construcción correcta de credenciales Basic Auth', () => {
  it('produces "Basic " + base64(user:pass) for any user/password pair', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (user, pass) => {
          const result = buildBasicAuth(user, pass);
          const expected = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
