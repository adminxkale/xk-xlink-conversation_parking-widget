import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { MockInteractionService } from '../../src/infrastructure/services/mock-interaction.service';
import { Interaction } from '../../src/domain/entities/interaction';

/**
 * Feature: conversation-parking-widget, Property 3: Completitud de datos de interacción
 *
 * Validates: Requirements 3.2
 *
 * For every interaction returned by the mock service, verify that all required
 * fields are present and valid: id (non-empty string), originLine (non-empty string),
 * destinationLine (non-empty string), startTimestamp (valid ISO 8601), isParked (boolean).
 */
describe('Feature: conversation-parking-widget, Property 3: Completitud de datos de interacción', () => {
  let service: MockInteractionService;
  let interactions: Interaction[];

  beforeEach(async () => {
    service = new MockInteractionService();
    interactions = await service.getInteractions();
  });

  it('every interaction has complete and valid data', () => {
    expect(interactions.length).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: interactions.length - 1 }),
        (index) => {
          const interaction = interactions[index];

          // id is a non-empty string
          expect(typeof interaction.id).toBe('string');
          expect(interaction.id.length).toBeGreaterThan(0);

          // originLine is a non-empty string
          expect(typeof interaction.originLine).toBe('string');
          expect(interaction.originLine.length).toBeGreaterThan(0);

          // destinationLine is a non-empty string
          expect(typeof interaction.destinationLine).toBe('string');
          expect(interaction.destinationLine.length).toBeGreaterThan(0);

          // startTimestamp is a valid ISO 8601 string
          expect(typeof interaction.startTimestamp).toBe('string');
          expect(interaction.startTimestamp.length).toBeGreaterThan(0);
          expect(new Date(interaction.startTimestamp).toISOString()).toBe(
            interaction.startTimestamp
          );

          // isParked is a boolean
          expect(typeof interaction.isParked).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });
});
