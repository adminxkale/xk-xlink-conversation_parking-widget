"use client";

import { ConnectionStatus } from "@/src/domain/ports/notification-service.port";

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
}

function getStatusConfig(status: ConnectionStatus): {
  colorClass: string;
  tooltip: string;
} {
  switch (status) {
    case "connected":
      return { colorClass: "bg-green-500", tooltip: "Sincronización activa" };
    case "connecting":
    case "reconnecting":
      return {
        colorClass: "bg-amber-500 animate-pulse",
        tooltip: "Reconectando...",
      };
    case "disconnected":
    case "failed":
      return {
        colorClass: "bg-red-500",
        tooltip: "Sin conexión en tiempo real",
      };
  }
}

export function ConnectionStatusIndicator({
  status,
}: ConnectionStatusIndicatorProps) {
  const { colorClass, tooltip } = getStatusConfig(status);

  return (
    <span
      className={`w-2.5 h-2.5 rounded-full inline-block ${colorClass}`}
      title={tooltip}
      aria-label={tooltip}
      role="status"
    />
  );
}
