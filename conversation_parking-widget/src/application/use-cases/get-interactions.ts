import { InteractionService } from '../../domain/ports/interaction-service.port';
import { Interaction } from '../../domain/entities/interaction';

export async function getInteractions(
  service: InteractionService,
  agentId?: string,
  tenant?: string
): Promise<Interaction[]> {
  return service.getInteractions(agentId, tenant);
}
