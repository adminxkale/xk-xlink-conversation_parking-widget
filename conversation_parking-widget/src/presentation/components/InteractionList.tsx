"use client";

import type { Interaction } from "../../domain/entities/interaction";
import { InteractionCard } from "./InteractionCard";
import { SkeletonLoader } from "./SkeletonLoader";
import { ErrorMessage } from "./ErrorMessage";
import { EmptyState } from "./EmptyState";

interface InteractionListProps {
  interactions: Interaction[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onUnpark: (id: string) => Promise<void>;
  sendingIds: Set<string>;
  queueNames?: Record<string, string>;
}

export function InteractionList({
  interactions,
  isLoading,
  error,
  onRetry,
  onUnpark,
  sendingIds,
  queueNames = {},
}: InteractionListProps) {
  if (isLoading) return <SkeletonLoader />;
  if (error) return <ErrorMessage message={error} onRetry={onRetry} />;
  if (interactions.length === 0) return <EmptyState onRetry={onRetry} />;

  return (
    <div className="space-y-3 p-3">
      {interactions.map((interaction) => (
        <InteractionCard
          key={interaction.id}
          interaction={interaction}
          onUnpark={onUnpark}
          isSending={sendingIds.has(interaction.id)}
          queueName={interaction.queueId ? queueNames[interaction.queueId] : undefined}
        />
      ))}
    </div>
  );
}
