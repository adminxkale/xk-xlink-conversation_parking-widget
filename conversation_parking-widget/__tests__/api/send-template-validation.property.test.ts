import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { POST } from '../../app/api/send-template/route';

/**
 * Feature: conversation-parking-widget, Property 8: Validación rechaza bodies incompletos
 *
 * Validates: Requirements 7.5
 *
 * For any proper subset of the required fields (destinationLine, conversationId),
 * sending a POST request to /api/send-template with that subset must return
 * HTTP 400 with a message about missing fields.
 */

const REQUIRED_FIELDS = ['destinationLine', 'conversationId'] as const;

/**
 * Generates a random proper subset of the required fields — i.e. at least one
 * field is always missing. The three possible subsets are:
 *   {} (both missing), { destinationLine }, { conversationId }
 */
const properSubsetArb = fc
  .subarray([...REQUIRED_FIELDS], { minLength: 0, maxLength: REQUIRED_FIELDS.length - 1 })
  .map((keys) => {
    const body: Record<string, string> = {};
    for (const key of keys) {
      body[key] = `test-value-${key}`;
    }
    return body;
  });

function buildRequest(body: Record<string, string>): Request {
  return new Request('http://localhost/api/send-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Feature: conversation-parking-widget, Property 8: Validación rechaza bodies incompletos', () => {
  it('returns HTTP 400 with missing-fields message for any proper subset of required fields', async () => {
    await fc.assert(
      fc.asyncProperty(properSubsetArb, async (partialBody) => {
        const request = buildRequest(partialBody);
        const response = await POST(request);

        expect(response.status).toBe(400);

        const json = await response.json();
        expect(json).toHaveProperty('error');
        expect(typeof json.error).toBe('string');

        // Verify the error mentions each actually-missing field
        const presentKeys = Object.keys(partialBody);
        const missingKeys = REQUIRED_FIELDS.filter((f) => !presentKeys.includes(f));
        for (const key of missingKeys) {
          expect(json.error).toContain(key);
        }
      }),
      { numRuns: 100 },
    );
  });
});
