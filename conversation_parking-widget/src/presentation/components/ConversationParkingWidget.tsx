"use client";

import { useMemo } from "react";
import { useAuthContext } from "../providers/AuthContext";
import { useToastContext } from "../providers/ToastContext";
import { useAgentLines } from "../../application/hooks/useAgentLines";
import { useInteractions } from "../../application/hooks/useInteractions";
import { useConversationNotifications } from "../../application/hooks/useConversationNotifications";
import { useQueueNames } from "../../application/hooks/useQueueNames";
import { Header } from "./Header";
import { LineSelector } from "./LineSelector";
import { InteractionList } from "./InteractionList";
import { ConnectionStatusIndicator } from "./ConnectionStatusIndicator";
import { ToastProvider } from "./ToastProvider";

function ConversationParkingWidgetInner() {
  const { addToast } = useToastContext();
  const { agentGroupIds, agent, token, tenantId } = useAuthContext();
  const {
    lines,
    selectedLineId,
    setSelectedLineId,
    isLoading: linesLoading,
  } = useAgentLines(agentGroupIds, tenantId);
  const { interactions, isLoading, error, unpark, sendingIds, retry } =
    useInteractions(agent?.id ?? null, token, tenantId, addToast);

  const { connectionStatus } = useConversationNotifications(
    agent?.id ?? null,
    token,
    retry
  );

  const queueIds = useMemo(
    () => interactions.map((i) => i.queueId).filter((id): id is string => !!id),
    [interactions]
  );
  const queueNames = useQueueNames(queueIds, token);

  // Filter interactions by selected line (origin line = line.phone_number)
  const filteredInteractions = selectedLineId
    ? (() => {
        const selectedLine = lines.find((l) => l.id === selectedLineId);
        if (!selectedLine) return interactions;
        return interactions.filter(
          (i) => i.originLine === selectedLine.phone_number
        );
      })()
    : interactions;

  const handleLineSelect = (lineId: string) => {
    setSelectedLineId(lineId);
  };

  return (
    <div className="relative flex flex-col h-full bg-white">
      <Header />
      <LineSelector
        lines={lines}
        selectedLineId={selectedLineId}
        onSelect={handleLineSelect}
        isLoading={linesLoading}
      />
      <div className="flex-1 overflow-y-auto">
        <InteractionList
          interactions={filteredInteractions}
          isLoading={isLoading}
          error={error}
          onRetry={retry}
          onUnpark={unpark}
          sendingIds={sendingIds}
          queueNames={queueNames}
        />
      </div>

      {/* Floating refresh button with connection status indicator */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
        <ConnectionStatusIndicator status={connectionStatus} />
        <button
          type="button"
          onClick={retry}
          disabled={isLoading}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Actualizar interacciones"
          title="Actualizar interacciones"
        >
          <svg
            className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function ConversationParkingWidget() {
  return (
    <ToastProvider>
      <ConversationParkingWidgetInner />
    </ToastProvider>
  );
}
