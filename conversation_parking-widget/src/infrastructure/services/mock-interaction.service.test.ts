import { describe, it, expect, beforeEach } from 'vitest';
import { MockInteractionService } from './mock-interaction.service';

describe('MockInteractionService', () => {
  let service: MockInteractionService;

  beforeEach(() => {
    service = new MockInteractionService();
  });

  describe('getInteractions', () => {
    it('returns all interactions when no agentId is provided', async () => {
      const interactions = await service.getInteractions();
      expect(interactions.length).toBeGreaterThanOrEqual(5);
    });

    it('returns all interactions when agentId is provided', async () => {
      const all = await service.getInteractions();
      const withAgent = await service.getInteractions('agent-123');

      expect(withAgent.length).toBe(all.length);
    });
  });

  describe('unparkInteraction', () => {
    it('sets isParked to false and returns updated interaction', async () => {
      const all = await service.getInteractions();
      const parked = all.find((i) => i.isParked)!;

      const result = await service.unparkInteraction({
        id: parked.id,
        business: parked.originLine,
        client: parked.destinationLine,
        agentId: 'agent-1',
        agentName: 'Test Agent',
        queueId: 'queue-1',
        token: 'test-token',
      });

      expect(result.isParked).toBe(false);
      expect(result.id).toBe(parked.id);
    });

    it('throws error for non-existent interaction id', async () => {
      await expect(
        service.unparkInteraction({
          id: 'non-existent',
          business: '123',
          client: '456',
          agentId: 'agent-1',
          agentName: 'Test',
          queueId: 'queue-1',
          token: 'token',
        })
      ).rejects.toThrow('Interaction with id "non-existent" not found');
    });
  });

  describe('mock data quality', () => {
    it('all interactions are parked by default', async () => {
      const all = await service.getInteractions();
      expect(all.every((i) => i.isParked)).toBe(true);
    });

    it('contains interactions with different origin lines', async () => {
      const all = await service.getInteractions();
      const uniqueOrigins = new Set(all.map((i) => i.originLine));
      expect(uniqueOrigins.size).toBeGreaterThan(1);
    });

    it('all interactions have valid ISO 8601 timestamps', async () => {
      const all = await service.getInteractions();
      for (const interaction of all) {
        expect(new Date(interaction.startTimestamp).toISOString()).toBe(
          interaction.startTimestamp
        );
      }
    });
  });
});
