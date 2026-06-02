"use client";

interface EmptyStateProps {
  onRetry?: () => void;
}

export function EmptyState({ onRetry }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-gray-500">
      <p>No hay interacciones parqueadas disponibles</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]"
          aria-label="Recargar"
        >
          Recargar
        </button>
      )}
    </div>
  );
}
