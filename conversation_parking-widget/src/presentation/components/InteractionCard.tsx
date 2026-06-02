"use client";
import type { Interaction } from '../../domain/entities/interaction';
import { useDurationTimer } from '../../application/hooks/useDurationTimer';

function remainingHours(startTimestamp: string): number {
  const start = new Date(startTimestamp).getTime();
  const deadline = start + 24 * 60 * 60 * 1000;
  return Math.max(0, (deadline - Date.now()) / (1000 * 60 * 60));
}

interface InteractionCardProps {
  interaction: Interaction;
  onUnpark: (id: string) => void;
  isSending: boolean;
  queueName?: string;
}

export function InteractionCard({ interaction, onUnpark, isSending, queueName }: InteractionCardProps) {
  const { display, isExpired } = useDurationTimer(interaction.startTimestamp);

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg transition-colors duration-200 ${
        interaction.isParked
          ? 'bg-amber-50 border border-amber-200'
          : 'bg-green-50 border border-green-200'
      }`}
    >
      <div className="flex-1 min-w-0">
        {interaction.isParked && interaction.agentName && (
          <p className="mb-1 text-xs text-gray-500">
            Conversación parqueada por <span className="font-semibold text-black">{interaction.agentName}</span>
          </p>
        )}
        {interaction.isParked && queueName && (
          <p className="mb-1 text-xs text-gray-500">
            Parqueada en la cola: <span className="font-semibold text-black">{queueName}</span>
          </p>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-900 truncate">
            Origen: {interaction.originLine}
          </span>
          <span className="text-gray-400">→</span>
          <span className="text-gray-700 truncate">
            Destino: {interaction.clientName
              ? <><span className="font-semibold text-black">{interaction.clientName}</span> ({interaction.destinationLine})</>
              : interaction.destinationLine}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>{new Date(interaction.startTimestamp).toLocaleDateString()}</span>
          <span className={`font-mono ${isExpired ? 'text-red-600 font-semibold' : remainingHours(interaction.startTimestamp) < 2 ? 'text-amber-600' : 'text-gray-500'}`}>
            {isExpired ? '⏰ Expirada' : `⏳ ${display}`}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            interaction.isParked
              ? 'bg-amber-100 text-amber-800'
              : 'bg-green-100 text-green-800'
          }`}>
            {interaction.isParked ? 'Parqueada' : 'Activa'}
          </span>
        </div>
      </div>
      {interaction.isParked && (
        <button
          onClick={() => onUnpark(interaction.id)}
          disabled={isSending || isExpired}
          className="min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 bg-green-600 hover:bg-green-700 text-white focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={isExpired ? 'Sesión expirada' : isSending ? 'Procesando...' : 'Desparquear conversación'}
        >
          {isSending ? '...' : 'Desparquear'}
        </button>
      )}
    </div>
  );
}
