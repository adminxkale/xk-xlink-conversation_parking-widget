export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface NotificationServiceConfig {
  token: string;
  agentId: string;
  environment: string;
  onConversationUpdate: () => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

export interface NotificationService {
  connect(config: NotificationServiceConfig): Promise<void>;
  disconnect(): void;
  getStatus(): ConnectionStatus;
}
