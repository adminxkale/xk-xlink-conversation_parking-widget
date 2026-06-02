import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import type { ConnectionStatus } from '@/src/domain/ports/notification-service.port';

afterEach(() => {
  cleanup();
});

describe('ConnectionStatusIndicator', () => {
  it('renderiza punto verde para status connected', () => {
    render(<ConnectionStatusIndicator status="connected" />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-green-500');
  });

  it('renderiza punto amarillo parpadeante para reconnecting', () => {
    render(<ConnectionStatusIndicator status="reconnecting" />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-amber-500');
    expect(indicator).toHaveClass('animate-pulse');
  });

  it('renderiza punto amarillo parpadeante para connecting', () => {
    render(<ConnectionStatusIndicator status="connecting" />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-amber-500');
    expect(indicator).toHaveClass('animate-pulse');
  });

  it('renderiza punto rojo para failed', () => {
    render(<ConnectionStatusIndicator status="failed" />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-red-500');
  });

  it('renderiza punto rojo para disconnected', () => {
    render(<ConnectionStatusIndicator status="disconnected" />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-red-500');
  });

  it('muestra tooltip "Sincronización activa" para connected', () => {
    render(<ConnectionStatusIndicator status="connected" />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('title', 'Sincronización activa');
  });

  it('muestra tooltip "Reconectando..." para reconnecting', () => {
    render(<ConnectionStatusIndicator status="reconnecting" />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('title', 'Reconectando...');
  });

  it('muestra tooltip "Reconectando..." para connecting', () => {
    render(<ConnectionStatusIndicator status="connecting" />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('title', 'Reconectando...');
  });

  it('muestra tooltip "Sin conexión en tiempo real" para failed', () => {
    render(<ConnectionStatusIndicator status="failed" />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('title', 'Sin conexión en tiempo real');
  });

  it('muestra tooltip "Sin conexión en tiempo real" para disconnected', () => {
    render(<ConnectionStatusIndicator status="disconnected" />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('title', 'Sin conexión en tiempo real');
  });
});
