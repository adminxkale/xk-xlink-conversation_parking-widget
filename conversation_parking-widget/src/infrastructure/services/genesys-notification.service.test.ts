import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenesysNotificationService } from './genesys-notification.service';
import { NotificationServiceConfig, ConnectionStatus } from '../../domain/ports/notification-service.port';

// --- Fake WebSocket ---

type FakeWSInstance = {
  url: string;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
};

let fakeWSInstances: FakeWSInstance[] = [];

class FakeWebSocket {
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  close = vi.fn();
  readyState = 0; // CONNECTING

  constructor(url: string) {
    this.url = url;
    fakeWSInstances.push(this as unknown as FakeWSInstance);
  }

  simulateOpen(): void {
    this.readyState = 1; // OPEN
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateClose(code: number = 1006, reason: string = ''): void {
    this.readyState = 3; // CLOSED
    this.onclose?.(new CloseEvent('close', { code, reason }));
  }

  simulateError(): void {
    this.onerror?.(new Event('error'));
  }
}

// --- Helpers ---

function createConfig(overrides?: Partial<NotificationServiceConfig>): NotificationServiceConfig {
  return {
    token: 'test-token',
    agentId: 'agent-123',
    environment: 'mypurecloud.com',
    onConversationUpdate: vi.fn(),
    onStatusChange: vi.fn(),
    ...overrides,
  };
}

function mockFetchSuccess(): void {
  vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/api/v2/notifications/channels') && !url.includes('/subscriptions')) {
      return new Response(
        JSON.stringify({ id: 'channel-1', connectUri: 'wss://notifications.example.com/ws' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/subscriptions')) {
      return new Response(JSON.stringify({}), { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  });
}

function getLatestWS(): FakeWebSocket {
  return fakeWSInstances[fakeWSInstances.length - 1] as unknown as FakeWebSocket;
}

// --- Tests ---

describe('GenesysNotificationService', () => {
  let service: GenesysNotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeWSInstances = [];
    (global as unknown as Record<string, unknown>).WebSocket = FakeWebSocket;
    service = new GenesysNotificationService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete (global as unknown as Record<string, unknown>).WebSocket;
  });

  describe('connect()', () => {
    it('crea canal y abre WebSocket', async () => {
      mockFetchSuccess();
      const config = createConfig();

      await service.connect(config);

      // Verify channel creation was called
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mypurecloud.com/api/v2/notifications/channels',
        expect.objectContaining({ method: 'POST' })
      );

      // Verify WebSocket was opened with the connectUri
      const ws = getLatestWS();
      expect(ws).toBeDefined();
      expect(ws.url).toBe('wss://notifications.example.com/ws');

      // Simulate WS open and verify subscription
      await ws.simulateOpen();
      await vi.runAllTimersAsync();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.mypurecloud.com/api/v2/notifications/channels/channel-1/subscriptions',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('mensajes de conversación', () => {
    it('disparan onConversationUpdate con debounce de 2s', async () => {
      mockFetchSuccess();
      const config = createConfig();

      await service.connect(config);
      const ws = getLatestWS();
      await ws.simulateOpen();
      await vi.runAllTimersAsync();

      // Send a conversation message
      ws.simulateMessage({
        topicName: 'v2.users.agent-123.conversations.messages',
        eventBody: { id: 'conv-1' },
      });

      // Should NOT have been called yet (debounce)
      expect(config.onConversationUpdate).not.toHaveBeenCalled();

      // Advance 2 seconds (debounce delay)
      await vi.advanceTimersByTimeAsync(2000);

      expect(config.onConversationUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('heartbeats', () => {
    it('mensajes channel.metadata son ignorados', async () => {
      mockFetchSuccess();
      const config = createConfig();

      await service.connect(config);
      const ws = getLatestWS();
      await ws.simulateOpen();
      await vi.runAllTimersAsync();

      // Send heartbeat
      ws.simulateMessage({
        topicName: 'channel.metadata',
        eventBody: { message: 'WebSocket Heartbeat' },
      });

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(3000);

      expect(config.onConversationUpdate).not.toHaveBeenCalled();
    });
  });

  describe('debounce', () => {
    it('múltiples eventos en <2s generan un solo callback', async () => {
      mockFetchSuccess();
      const config = createConfig();

      await service.connect(config);
      const ws = getLatestWS();
      await ws.simulateOpen();
      await vi.runAllTimersAsync();

      // Send multiple messages rapidly
      ws.simulateMessage({ topicName: 'v2.users.agent-123.conversations.messages', eventBody: { id: 'conv-1' } });
      await vi.advanceTimersByTimeAsync(500);
      ws.simulateMessage({ topicName: 'v2.users.agent-123.conversations.messages', eventBody: { id: 'conv-2' } });
      await vi.advanceTimersByTimeAsync(500);
      ws.simulateMessage({ topicName: 'v2.users.agent-123.conversations.messages', eventBody: { id: 'conv-3' } });

      // Advance past debounce from last message
      await vi.advanceTimersByTimeAsync(2000);

      // Only one callback should have fired
      expect(config.onConversationUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconexión', () => {
    it('cierre inesperado del WebSocket inicia reconexión', async () => {
      mockFetchSuccess();
      const config = createConfig();

      await service.connect(config);
      const ws = getLatestWS();
      await ws.simulateOpen();
      await vi.runAllTimersAsync();

      // Simulate unexpected close
      ws.simulateClose(1006, 'Abnormal closure');

      expect(config.onStatusChange).toHaveBeenCalledWith('reconnecting');

      // Advance past first reconnect delay (5000ms)
      await vi.advanceTimersByTimeAsync(5000);
      await vi.runAllTimersAsync();

      // A new WebSocket should have been created
      expect(fakeWSInstances.length).toBeGreaterThan(1);
    });

    it('backoff exponencial incrementa el delay correctamente', async () => {
      // Track channel creation calls with timestamps
      const channelCallTimestamps: number[] = [];
      let callCount = 0;

      vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.includes('/api/v2/notifications/channels') && !url.includes('/subscriptions')) {
          callCount++;
          if (callCount === 1) {
            return new Response(
              JSON.stringify({ id: 'channel-1', connectUri: 'wss://notifications.example.com/ws' }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          channelCallTimestamps.push(Date.now());
          return new Response('Server Error', { status: 500 });
        }

        if (url.includes('/subscriptions')) {
          return new Response(JSON.stringify({}), { status: 200 });
        }

        return new Response('Not Found', { status: 404 });
      });

      const config = createConfig();
      await service.connect(config);
      const ws = getLatestWS();
      await ws.simulateOpen();
      await vi.runAllTimersAsync();

      const startTime = Date.now();

      // Simulate unexpected close to trigger reconnection
      ws.simulateClose(1006);

      // Run through all reconnect attempts (they cascade since each failure triggers next)
      // Delays: 5000, 10000, 20000, 40000, 60000
      await vi.advanceTimersByTimeAsync(5000);
      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(10000);
      await vi.runAllTimersAsync();
      await vi.advanceTimersByTimeAsync(20000);
      await vi.runAllTimersAsync();

      // Verify the delays are exponentially increasing
      // First reconnect at ~5000ms, second at ~15000ms, third at ~35000ms
      expect(channelCallTimestamps.length).toBeGreaterThanOrEqual(3);
      const delay1 = channelCallTimestamps[0] - startTime;
      const delay2 = channelCallTimestamps[1] - channelCallTimestamps[0];
      const delay3 = channelCallTimestamps[2] - channelCallTimestamps[1];

      // Verify exponential growth: each delay should be roughly double the previous
      expect(delay1).toBe(5000);   // 5000 * 2^0
      expect(delay2).toBe(10000);  // 5000 * 2^1
      expect(delay3).toBe(20000);  // 5000 * 2^2
    });

    it('después de 5 intentos fallidos, status cambia a failed', async () => {
      // Mock fetch: first call succeeds, rest fail
      let callCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.includes('/api/v2/notifications/channels') && !url.includes('/subscriptions')) {
          callCount++;
          if (callCount === 1) {
            return new Response(
              JSON.stringify({ id: 'channel-1', connectUri: 'wss://notifications.example.com/ws' }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          return new Response('Server Error', { status: 500 });
        }

        if (url.includes('/subscriptions')) {
          return new Response(JSON.stringify({}), { status: 200 });
        }

        return new Response('Not Found', { status: 404 });
      });

      const config = createConfig();
      await service.connect(config);
      const ws = getLatestWS();
      await ws.simulateOpen();
      await vi.runAllTimersAsync();

      // Simulate unexpected close
      ws.simulateClose(1006);

      // Run through all 5 reconnect attempts
      // Delays: 5000, 10000, 20000, 40000, 60000
      const delays = [5000, 10000, 20000, 40000, 60000];
      for (const delay of delays) {
        await vi.advanceTimersByTimeAsync(delay);
        await vi.runAllTimersAsync();
      }

      expect(config.onStatusChange).toHaveBeenCalledWith('failed');
    });
  });

  describe('disconnect()', () => {
    it('cierra WebSocket y cancela timers', async () => {
      mockFetchSuccess();
      const config = createConfig();

      await service.connect(config);
      const ws = getLatestWS();
      await ws.simulateOpen();
      await vi.runAllTimersAsync();

      // Send a message to start debounce timer
      ws.simulateMessage({
        topicName: 'v2.users.agent-123.conversations.messages',
        eventBody: { id: 'conv-1' },
      });

      // Disconnect
      service.disconnect();

      expect(ws.close).toHaveBeenCalled();
      expect(config.onStatusChange).toHaveBeenCalledWith('disconnected');

      // Advance timers - debounce should NOT fire
      await vi.advanceTimersByTimeAsync(3000);
      expect(config.onConversationUpdate).not.toHaveBeenCalled();
    });
  });

  describe('error 401', () => {
    it('error 401 al crear canal no reintenta (token expirado)', async () => {
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return new Response('Unauthorized', { status: 401 });
      });

      const config = createConfig();
      await service.connect(config);

      expect(config.onStatusChange).toHaveBeenCalledWith('failed');

      // Advance timers - no reconnection should happen
      await vi.advanceTimersByTimeAsync(60000);
      await vi.runAllTimersAsync();

      // fetch should only have been called once (the initial attempt)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('cierre normal', () => {
    it('cierre con código 1000 no inicia reconexión', async () => {
      mockFetchSuccess();
      const config = createConfig();

      await service.connect(config);
      const ws = getLatestWS();
      await ws.simulateOpen();
      await vi.runAllTimersAsync();

      const instanceCountBefore = fakeWSInstances.length;

      // Simulate normal close
      ws.simulateClose(1000, 'Normal closure');

      // Advance timers
      await vi.advanceTimersByTimeAsync(60000);
      await vi.runAllTimersAsync();

      // No new WebSocket should have been created
      expect(fakeWSInstances.length).toBe(instanceCountBefore);
      expect(config.onStatusChange).not.toHaveBeenCalledWith('reconnecting');
    });
  });
});
