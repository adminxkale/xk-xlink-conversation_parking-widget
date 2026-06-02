"use client";

interface ErrorMessageProps {
  message: string;
  onRetry: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center" role="alert">
      <p className="text-red-600">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]"
        aria-label="Reintentar"
      >
        Reintentar
      </button>
    </div>
  );
}
