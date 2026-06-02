import { InteractionService, UnparkParams } from '../../domain/ports/interaction-service.port';
import { Interaction } from '../../domain/entities/interaction';

export async function unparkInteraction(
  service: InteractionService,
  params: UnparkParams
): Promise<Interaction> {
  return service.unparkInteraction(params);
}
