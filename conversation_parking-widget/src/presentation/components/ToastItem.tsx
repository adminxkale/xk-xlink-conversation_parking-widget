"use client";

import { Toast } from "@/src/domain/entities/toast";

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const isSuccess = toast.type === "success";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        flex items-center gap-2 px-3 py-2 rounded border-l-4 shadow-md text-sm
        pointer-events-auto animate-slide-in
        ${
          isSuccess
            ? "bg-green-50 border-green-500"
            : "bg-red-50 border-red-500"
        }
      `}
    >
      {/* Icon */}
      {isSuccess ? (
        <svg
          className="w-4 h-4 text-green-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-red-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}

      {/* Message */}
      <span className={isSuccess ? "text-green-800" : "text-red-800"}>
        {toast.message}
      </span>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className={`
          ml-auto shrink-0 p-0.5 rounded hover:bg-opacity-20
          ${isSuccess ? "text-green-600 hover:bg-green-200" : "text-red-600 hover:bg-red-200"}
        `}
        aria-label="Cerrar notificación"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
