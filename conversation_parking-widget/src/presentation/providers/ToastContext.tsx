"use client";
import { createContext, useContext } from 'react';
import type { ToastType } from '@/src/domain/entities/toast';

export interface ToastContextValue {
  addToast: (params: { type: ToastType; message: string }) => void;
  removeToast: (id: string) => void;
}

const defaultValue: ToastContextValue = {
  addToast: () => {},
  removeToast: () => {},
};

export const ToastContext = createContext<ToastContextValue>(defaultValue);

export function useToastContext(): ToastContextValue {
  return useContext(ToastContext);
}
