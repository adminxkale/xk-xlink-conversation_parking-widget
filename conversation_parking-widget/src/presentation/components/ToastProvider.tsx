"use client";
import { ReactNode } from 'react';
import { ToastContext } from '../providers/ToastContext';
import { useToast } from '@/src/application/hooks/useToast';
import { ToastContainer } from './ToastContainer';

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const { toasts, addToast, removeToast } = useToast();

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}
