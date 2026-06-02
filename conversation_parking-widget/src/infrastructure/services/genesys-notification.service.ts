import {
  ConnectionStatus,
  NotificationService,
  NotificationServiceConfig,
} from '../../domain/ports/notification-service.port';

interface WebSocketMessage {
  topicName: string;
  eventBody: Record<string, unknown>;
}

export class GenesysNotificationService implements NotificationService {
  private ws: WebSocket | null = null;
  private channelId: string | null = null;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private config: NotificationServiceConfig | null = null;

  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  private static readonly BASE_RECONNECT_DELAY_MS = 5000;
  private static readonly MAX_RECONNECT_DELAY_MS = 60000;
  private static readonly DEBOUNCE_DELAY_MS = 2000;

  async connect(config: NotificationServiceConfig): Promise<void> {
    this.config = config;
    this.setStatus('connecting');

    try {
      const channel = await this.createChannel();
      this.channelId = channel.id;
      this.openWebSocket(channel.connectUri);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('401')) {
        this.setStatus('failed');
        return;
      }
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.cleanup();
    this.setStatus('disconnected');
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private async createChannel(): Promise<{ id: string; connectUri: string }> {
    if (!this.config) {
      throw new Error('NotificationService not configured');
    }

    const baseUrl = `https://api.${this.config.environment}`;
    const response = await fetch(`${baseUrl}/api/v2/notifications/channels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to create channel: ${response.status}`);
    }

    const data: { id: string; connectUri: string } = await response.json();
    return { id: data.id, connectUri: data.connectUri };
  }

  private async subscribe(channelId: string): Promise<void> {
    if (!this.config) {
      throw new Error('NotificationService not configured');
    }

    const baseUrl = `https://api.${this.config.environment}`;
    const topic = `v2.users.${this.config.agentId}.conversations.messages`;

    const response = await fetch(
      `${baseUrl}/api/v2/notifications/channels/${channelId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ id: topic }]),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to subscribe: ${response.status}`);
    }
  }

  private openWebSocket(connectUri: string): void {
    this.ws = new WebSocket(connectUri);

    this.ws.onopen = async () => {
      try {
        await this.subscribe(this.channelId!);
        this.reconnectAttempts = 0;
        this.setStatus('connected');
      } catch {
        this.ws?.close();
        this.scheduleReconnect();
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.handleClose(event);
    };

    this.ws.onerror = (_event: Event) => {
      this.handleError();
    };
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data as string);

      if (message.topicName === 'channel.metadata') {
        return;
      }

      this.debouncedRefresh();
    } catch {
      // Ignore malformed messages
    }
  }

  private handleClose(event: CloseEvent): void {
    this.ws = null;

    if (event.code === 1000) {
      return;
    }

    if (this.status !== 'disconnected') {
      this.scheduleReconnect();
    }
  }

  private handleError(): void {
    // Error handling is done via onclose which fires after onerror
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= GenesysNotificationService.MAX_RECONNECT_ATTEMPTS) {
      this.setStatus('failed');
      return;
    }

    this.setStatus('reconnecting');
    const delay = this.getReconnectDelay();
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        const channel = await this.createChannel();
        this.channelId = channel.id;
        this.openWebSocket(channel.connectUri);
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes('401')) {
          this.setStatus('failed');
          return;
        }
        this.scheduleReconnect();
      }
    }, delay);
  }

  private getReconnectDelay(): number {
    const delay =
      GenesysNotificationService.BASE_RECONNECT_DELAY_MS *
      Math.pow(2, this.reconnectAttempts);
    return Math.min(delay, GenesysNotificationService.MAX_RECONNECT_DELAY_MS);
  }

  private debouncedRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.config?.onConversationUpdate();
    }, GenesysNotificationService.DEBOUNCE_DELAY_MS);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.config?.onStatusChange(status);
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    this.channelId = null;
    this.reconnectAttempts = 0;
  }
}
