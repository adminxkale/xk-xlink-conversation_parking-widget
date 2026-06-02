import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConversationNotifications } from './useConversationNotifications';

vi.mock('../../infrastructure/config/service-registry', () => ({
  getNotificationService: vi.fn(),
}));

import { getNotificationService } from '../../infrastructure/config/service-registry';

const mockGetNotificationService = vi.mocked(getNotificationService);

describe('useConversationNotifications', () => {
  let mockService: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      getStatus: vi.fn().mockReturnValue('disconnected'),
    };
    mockGetNotificationService.mockReturnValue(mockService);
  });

  it('conecta cuando agentId y token están disponibles', () => {
    renderHook(() =>
      useConversationNotifications('agent-123', 'valid-token', vi.fn())
    );

    expect(mockService.connect).toHaveBeenCalledTimes(1);
    expect(mockService.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'valid-token',
        agentId: 'agent-123',
        environment: expect.any(String),
      })
    );
  });

  it('no conecta si agentId o token son null', () => {
    const { rerender } = renderHook(
      ({ agentId, token }) =>
        useConversationNotifications(agentId, token, vi.fn()),
      { initialProps: { agentId: null as string | null, token: null as string | null } }
    );

    expect(mockService.connect).not.toHaveBeenCalled();

    rerender({ agentId: 'agent-123', token: null });
    expect(mockService.connect).not.toHaveBeenCalled();

    rerender({ agentId: null, token: 'valid-token' });
    expect(mockService.connect).not.toHaveBeenCalled();
  });

  it('desconecta al desmontar', () => {
    const { unmount } = renderHook(() =>
      useConversationNotifications('agent-123', 'valid-token', vi.fn())
    );

    unmount();

    expect(mockService.disconnect).toHaveBeenCalledTimes(1);
  });

  it('llama onRefresh cuando llega un evento de conversación', () => {
    const onRefresh = vi.fn();

    renderHook(() =>
      useConversationNotifications('agent-123', 'valid-token', onRefresh)
    );

    // Capture the onConversationUpdate callback passed to connect
    const connectConfig = mockService.connect.mock.calls[0][0];

    act(() => {
      connectConfig.onConversationUpdate();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('expone connectionStatus correctamente', () => {
    const { result } = renderHook(() =>
      useConversationNotifications('agent-123', 'valid-token', vi.fn())
    );

    // Initial status should be 'disconnected'
    expect(result.current.connectionStatus).toBe('disconnected');

    // Capture the onStatusChange callback and invoke it
    const connectConfig = mockService.connect.mock.calls[0][0];

    act(() => {
      connectConfig.onStatusChange('connected');
    });

    expect(result.current.connectionStatus).toBe('connected');

    act(() => {
      connectConfig.onStatusChange('reconnecting');
    });

    expect(result.current.connectionStatus).toBe('reconnecting');
  });
});
