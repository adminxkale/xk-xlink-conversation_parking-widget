import { InteractionService, UnparkParams } from '../../domain/ports/interaction-service.port';
import { Interaction } from '../../domain/entities/interaction';

interface ApiSession {
  business: string;
  client: string;
  createdAt: string;
  clientName?: string | null;
  parking: boolean;
  agentId?: string;
  agentName?: string;
  queueId?: string;
}

interface ApiResponse {
  statusCode: number;
  message: string;
  total: number;
  data: ApiSession[];
}

export class RealInteractionService implements InteractionService {
  private interactions: Interaction[] = [];

  async getInteractions(agentId?: string, tenant?: string): Promise<Interaction[]> {
    if (!agentId || !tenant) return [];

    const response = await fetch(
      `/api/proxy-interactions?agent_id=${encodeURIComponent(agentId)}&tenant=${encodeURIComponent(tenant)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch interactions: ${response.status}`);
    }

    const apiData: ApiResponse = await response.json();

    this.interactions = apiData.data.map((session) => ({
      id: `${session.business}-${session.client}`,
      originLine: session.business,
      destinationLine: session.client,
      startTimestamp: session.createdAt,
      isParked: session.parking,
      clientName: session.clientName ?? undefined,
      agentId: session.agentId,
      agentName: session.agentName,
      queueId: session.queueId,
    }));

    return [...this.interactions];
  }

  async unparkInteraction(params: UnparkParams): Promise<Interaction> {
    const interaction = this.interactions.find((i) => i.id === params.id);
    if (!interaction) {
      throw new Error(`Interaction with id "${params.id}" not found`);
    }

    // Step 1: POST to Genesys Cloud to resume conversation (must succeed first)
    const environment = localStorage.getItem('genesys_environment') || 'mypurecloud.com';
    const conversationResponse = await fetch('/api/proxy-conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.token}`,
        'X-Genesys-Environment': environment,
      },
      body: JSON.stringify({
        queueId: params.queueId,
        toAddress: params.client,
        toAddressMessengerType: 'open',
      }),
    });

    if (!conversationResponse.ok) {
      const errorData = await conversationResponse.json().catch(() => ({}));
      throw new Error(
        (errorData as { error?: string }).error ?? `Failed to resume conversation: ${conversationResponse.status}`
      );
    }

    // Step 2: PUT to Xlink API to set parking = false (only if Genesys succeeded)
    const unparkResponse = await fetch('/api/proxy-interactions/unpark', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business: params.business,
        client: params.client,
        tenant: params.tenant,
      }),
    });

    if (!unparkResponse.ok) {
      const errorData = await unparkResponse.json().catch(() => ({}));
      throw new Error(
        (errorData as { error?: string }).error ?? `Failed to unpark interaction: ${unparkResponse.status}`
      );
    }

    interaction.isParked = false;
    return { ...interaction };
  }
}
