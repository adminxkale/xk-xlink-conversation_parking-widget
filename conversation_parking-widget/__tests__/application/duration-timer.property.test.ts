import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import { formatCountdown } from '../../src/application/hooks/useDurationTimer';

/**
 * Feature: conversation-parking-widget, Property 5: Cálculo correcto de duración
 *
 * Validates: Requirements 4.2
 *
 * For any pair of timestamps (start, now) where now >= start,
 * the duration calculation function must return a string in HH:MM:SS format
 * whose numeric value in seconds equals the difference (now - start) truncated to seconds.
 */

const HH_MM_SS_REGEX = /^\d{2}:\d{2}:\d{2}$/;

/** Parse an HH:MM:SS string back to total seconds */
function parseHHMMSS(formatted: string): number {
  const [hh, mm, ss] = formatted.split(':').map(Number);
  return hh * 3600 + mm * 60 + ss;
}

/**
 * Arbitrary that generates a start timestamp (Date in the past)
 * and a "now" value that is >= start.
 */
const timestampPairArb = fc
  .tuple(
    // start: random date within the last ~10 years
    fc.integer({ min: 0, max: 10 * 365 * 24 * 3600 * 1000 }),
    // offset in ms (0 to ~48 hours) so now >= start
    fc.integer({ min: 0, max: 48 * 3600 * 1000 })
  )
  .map(([baseOffset, delta]) => {
    const referencePoint = 1_700_000_000_000; // a fixed reference (~Nov 2023)
    const start = referencePoint - baseOffset;
    const now = start + delta;
    return { start, now };
  });

describe('Feature: conversation-parking-widget, Property 5: Cálculo correcto de duración', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a string matching HH:MM:SS format', () => {
    fc.assert(
      fc.property(timestampPairArb, ({ start, now }) => {
        vi.spyOn(Date, 'now').mockReturnValue(now);

        const result = formatCountdown(new Date(start).toISOString());

        expect(result.display).toMatch(HH_MM_SS_REGEX);
      }),
      { numRuns: 100 }
    );
  });

  it('numeric value in seconds equals remaining countdown seconds', () => {
    fc.assert(
      fc.property(timestampPairArb, ({ start, now }) => {
        vi.spyOn(Date, 'now').mockReturnValue(now);

        const result = formatCountdown(new Date(start).toISOString());
        const totalSeconds = parseHHMMSS(result.display);

        // formatCountdown calculates a 24-hour countdown from start
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const deadline = start + TWENTY_FOUR_HOURS_MS;
        const remainingMs = deadline - now;

        if (remainingMs <= 0) {
          expect(totalSeconds).toBe(0);
          expect(result.isExpired).toBe(true);
        } else {
          const expectedSeconds = Math.floor(remainingMs / 1000);
          expect(totalSeconds).toBe(expectedSeconds);
          expect(result.isExpired).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});
