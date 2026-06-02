import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { InteractionCard } from '../../src/presentation/components/InteractionCard';
import type { Interaction } from '../../src/domain/entities/interaction';

/**
 * Feature: conversation-parking-widget, Property 9: Presencia de aria-labels en elementos interactivos
 *
 * Validates: Requirements 9.3
 *
 * For any parked interaction, rendering its InteractionCard must produce
 * a button with a non-empty, descriptive aria-label attribute.
 * For non-parked interactions, no button should be rendered.
 */

// Arbitrary for valid Interaction objects
const interactionArb = fc.record({
  id: fc.uuid(),
  originLine: fc.stringMatching(/^\+\d{6,15}$/),
  destinationLine: fc.stringMatching(/^\+\d{6,15}$/),
  startTimestamp: fc.constant(new Date(Date.now() - 60000).toISOString()),
  isParked: fc.boolean(),
});

describe('Feature: conversation-parking-widget, Property 9: Presencia de aria-labels en elementos interactivos', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should ensure unpark button has a non-empty aria-label for parked interactions, and no button for active ones', () => {
    fc.assert(
      fc.property(interactionArb, (interaction: Interaction) => {
        const { container } = render(
          <InteractionCard
            interaction={interaction}
            onUnpark={() => {}}
            isSending={false}
          />
        );

        const buttons = container.querySelectorAll('button');

        if (interaction.isParked) {
          // Parked interactions must have the unpark button
          expect(buttons.length).toBe(1);

          buttons.forEach((button) => {
            const ariaLabel = button.getAttribute('aria-label');
            expect(ariaLabel).not.toBeNull();
            expect(ariaLabel!.trim().length).toBeGreaterThan(0);
          });
        } else {
          // Non-parked interactions should not have a button
          expect(buttons.length).toBe(0);
        }

        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});
