import { Interaction } from '../entities/interaction';

export interface UnparkParams {
  id: string;
  business: string;
  client: string;
  agentId: string;
  agentName: string;
  queueId: string;
  token: string;
  tenant: string;
}

export interface InteractionService {
  getInteractions(agentId?: string, tenant?: string): Promise<Interaction[]>;
  unparkInteraction(params: UnparkParams): Promise<Interaction>;
}
