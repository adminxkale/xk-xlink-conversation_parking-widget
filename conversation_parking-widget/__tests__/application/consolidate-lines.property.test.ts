import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { consolidateLines } from '../../src/application/use-cases/consolidate-lines';
import { Line } from '../../src/domain/entities/line';

/**
 * Feature: conversation-parking-widget, Property 2: Deduplicación de líneas del agente
 *
 * Validates: Requirements 2.3
 *
 * For any set of group responses with potentially duplicated phone numbers,
 * the consolidation function must return an array of lines with no duplicates,
 * where each phone_number appears exactly once.
 */

/** Arbitrary that generates a random Line object */
const lineArb = (phonePool?: string[]): fc.Arbitrary<Line> => {
  const phoneArb = phonePool
    ? fc.constantFrom(...phonePool)
    : fc.stringMatching(/^\+\d{6,15}$/);

  return fc.record({
    id: fc.uuid(),
    number: fc.string({ minLength: 1, maxLength: 30 }),
    phone_number_id: fc.uuid(),
    phone_number: phoneArb,
    groups: fc.option(fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }), { nil: undefined }),
  });
};

/**
 * Generates multiple groups of lines with a shared phone pool
 * to ensure overlapping phone_numbers across groups.
 */
const lineGroupsArb: fc.Arbitrary<Line[][]> = (() => {
  // Create a small pool of phone numbers so duplicates are likely
  const phonePool = fc.array(fc.stringMatching(/^\+\d{6,15}$/), { minLength: 1, maxLength: 8 });

  return phonePool.chain((pool) =>
    fc.array(
      fc.array(lineArb(pool), { minLength: 0, maxLength: 6 }),
      { minLength: 0, maxLength: 5 }
    )
  );
})();

describe('Feature: conversation-parking-widget, Property 2: Deduplicación de líneas del agente', () => {
  it('result contains no duplicate phone_numbers', () => {
    fc.assert(
      fc.property(lineGroupsArb, (groups) => {
        const result = consolidateLines(groups);
        const phoneNumbers = result.map((l) => l.phone_number);
        const uniquePhones = new Set(phoneNumbers);

        expect(uniquePhones.size).toBe(phoneNumbers.length);
      }),
      { numRuns: 100 }
    );
  });

  it('every input phone_number appears exactly once in the result', () => {
    fc.assert(
      fc.property(lineGroupsArb, (groups) => {
        const result = consolidateLines(groups);
        const resultPhones = new Set(result.map((l) => l.phone_number));

        // Collect all unique phone_numbers from input
        const inputPhones = new Set<string>();
        for (const group of groups) {
          for (const line of group) {
            inputPhones.add(line.phone_number);
          }
        }

        // Every input phone must be in the result
        for (const phone of inputPhones) {
          expect(resultPhones.has(phone)).toBe(true);
        }

        // Result should have exactly the same set of unique phones
        expect(resultPhones.size).toBe(inputPhones.size);
      }),
      { numRuns: 100 }
    );
  });

  it('result length is less than or equal to total input length', () => {
    fc.assert(
      fc.property(lineGroupsArb, (groups) => {
        const result = consolidateLines(groups);
        const totalInputLines = groups.reduce((sum, g) => sum + g.length, 0);

        expect(result.length).toBeLessThanOrEqual(totalInputLines);
      }),
      { numRuns: 100 }
    );
  });
});
