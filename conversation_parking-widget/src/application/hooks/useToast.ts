"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Toast, ToastType } from "../../domain/entities/toast";

export interface UseToastResult {
  toasts: Toast[];
  addToast: (params: { type: ToastType; message: string }) => void;
  removeToast: (id: string) => void;
}

const AUTO_DISMISS_MS = 5000;

export function useToast(): UseToastResult {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));

    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (params: { type: ToastType; message: string }) => {
      const id = crypto.randomUUID();
      const toast: Toast = {
        id,
        type: params.type,
        message: params.message,
        createdAt: Date.now(),
      };

      setToasts((prev) => [...prev, toast]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, AUTO_DISMISS_MS);

      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  // Cleanup all pending timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return { toasts, addToast, removeToast };
}
