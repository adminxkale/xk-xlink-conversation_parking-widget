export interface Interaction {
  id: string;
  originLine: string;
  destinationLine: string;
  startTimestamp: string; // ISO 8601
  isParked: boolean;
  clientName?: string;
  agentId?: string;
  agentName?: string;
  queueId?: string;
}
