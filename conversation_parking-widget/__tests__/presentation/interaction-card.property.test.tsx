import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { InteractionCard } from '../../src/presentation/components/InteractionCard';
import type { Interaction } from '../../src/domain/entities/interaction';

/**
 * Feature: conversation-parking-widget, Property 4: Renderizado completo de datos en tarjeta de interacción
 *
 * Validates: Requirements 4.1
 *
 * For any valid interaction, rendering its InteractionCard must produce DOM
 * containing: origin line, destination line, a duration in HH:MM:SS format,
 * and a park-state indicator ("Parqueada" or "Activa").
 */

// Arbitrary for valid Interaction objects
const interactionArb = fc.record({
  id: fc.uuid(),
  originLine: fc.stringMatching(/^\+\d{6,15}$/),
  destinationLine: fc.stringMatching(/^\+\d{6,15}$/),
  startTimestamp: fc.constant(new Date(Date.now() - 60000).toISOString()),
  isParked: fc.boolean(),
});

describe('Feature: conversation-parking-widget, Property 4: Renderizado completo de datos en tarjeta de interacción', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render origin line, destination line, duration (HH:MM:SS), and park state for any valid interaction', () => {
    fc.assert(
      fc.property(interactionArb, (interaction: Interaction) => {
        const { container } = render(
          <InteractionCard
            interaction={interaction}
            onTogglePark={() => {}}
            isSending={false}
          />
        );

        const text = container.textContent ?? '';

        // 1. Origin line is present
        expect(text).toContain(interaction.originLine);

        // 2. Destination line is present
        expect(text).toContain(interaction.destinationLine);

        // 3. Duration in HH:MM:SS format is present
        expect(text).toMatch(/\d{2}:\d{2}:\d{2}/);

        // 4. Park state indicator
        if (interaction.isParked) {
          expect(text).toContain('Parqueada');
        } else {
          expect(text).toContain('Activa');
        }

        // Cleanup timers between iterations
        cleanup();
      }),
      { numRuns: 100 }
    );
  });
});
