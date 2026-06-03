"use client";

import { useState, useEffect, useRef } from "react";
import type { ConnectionStatus } from "../../domain/ports/notification-service.port";
import { getNotificationService } from "../../infrastructure/config/service-registry";

export interface UseConversationNotificationsResult {
  connectionStatus: ConnectionStatus;
}

export function useConversationNotifications(
  agentId: string | null,
  token: string | null,
  onRefresh: () => void
): UseConversationNotificationsResult {
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!agentId || !token) {
      return;
    }

    const service = getNotificationService();
    const environment = localStorage.getItem('genesys_environment') || 'mypurecloud.com';

    service.connect({
      token,
      agentId,
      environment,
      onConversationUpdate: () => {
        onRefreshRef.current();
      },
      onStatusChange: (status: ConnectionStatus) => {
        setConnectionStatus(status);
      },
    });

    return () => {
      service.disconnect();
    };
  }, [agentId, token]);

  return { connectionStatus };
}
