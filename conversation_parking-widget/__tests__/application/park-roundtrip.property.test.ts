import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MockInteractionService } from '../../src/infrastructure/services/mock-interaction.service';
import { unparkInteraction } from '../../src/application/use-cases/unpark-interaction';
import { Interaction } from '../../src/domain/entities/interaction';

/**
 * Feature: conversation-parking-widget, Property: Unpark sets isParked to false
 *
 * For any parked interaction, calling unparkInteraction must set isParked to false.
 */
describe('Feature: conversation-parking-widget, Property: Unpark sets isParked to false', () => {
  it('unpark changes isParked from true to false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }),
        async (index) => {
          const service = new MockInteractionService();
          const interactions: Interaction[] = await service.getInteractions();
          expect(interactions.length).toBeGreaterThan(0);

          const safeIndex = index % interactions.length;
          const interaction = interactions[safeIndex];

          // All mock interactions are parked
          expect(interaction.isParked).toBe(true);

          const unparked = await unparkInteraction(service, {
            id: interaction.id,
            business: interaction.originLine,
            client: interaction.destinationLine,
            agentId: 'test-agent',
            agentName: 'Test',
            queueId: 'queue-1',
            token: 'test-token',
          });

          expect(unparked.isParked).toBe(false);
          expect(unparked.id).toBe(interaction.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});
