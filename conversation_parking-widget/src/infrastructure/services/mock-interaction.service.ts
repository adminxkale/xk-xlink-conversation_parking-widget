import { InteractionService, UnparkParams } from '../../domain/ports/interaction-service.port';
import { Interaction } from '../../domain/entities/interaction';

const mockInteractions: Interaction[] = [
  {
    id: 'conv-001',
    originLine: '+573001234567',
    destinationLine: '+573017654321',
    startTimestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    isParked: true,
  },
  {
    id: 'conv-002',
    originLine: '+573009876543',
    destinationLine: '+573017654321',
    startTimestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    isParked: true,
  },
  {
    id: 'conv-003',
    originLine: '+573001234567',
    destinationLine: '+573015551234',
    startTimestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    isParked: true,
  },
  {
    id: 'conv-004',
    originLine: '+573002223344',
    destinationLine: '+573015551234',
    startTimestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    isParked: true,
  },
  {
    id: 'conv-005',
    originLine: '+573009876543',
    destinationLine: '+573018887766',
    startTimestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    isParked: true,
  },
  {
    id: 'conv-006',
    originLine: '+573002223344',
    destinationLine: '+573017654321',
    startTimestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    isParked: true,
  },
];

export class MockInteractionService implements InteractionService {
  private interactions: Interaction[] = mockInteractions.map((i) => ({ ...i }));

  async getInteractions(agentId?: string, tenant?: string): Promise<Interaction[]> {
    // Mock: return all interactions regardless of agentId/tenant
    if (agentId) {
      return [...this.interactions];
    }
    return [...this.interactions];
  }

  async unparkInteraction(params: UnparkParams): Promise<Interaction> {
    const interaction = this.interactions.find((i) => i.id === params.id);
    if (!interaction) {
      throw new Error(`Interaction with id "${params.id}" not found`);
    }
    interaction.isParked = false;
    return { ...interaction };
  }
}
