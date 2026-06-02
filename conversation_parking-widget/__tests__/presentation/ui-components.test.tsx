import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Header } from '../../src/presentation/components/Header';
import { SkeletonLoader } from '../../src/presentation/components/SkeletonLoader';
import { EmptyState } from '../../src/presentation/components/EmptyState';
import { ErrorMessage } from '../../src/presentation/components/ErrorMessage';
import { InteractionCard } from '../../src/presentation/components/InteractionCard';
import { LineSelector } from '../../src/presentation/components/LineSelector';
import type { Interaction } from '../../src/domain/entities/interaction';
import type { Line } from '../../src/domain/entities/line';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
describe('Header', () => {
  it('renders the Xlink logo with correct alt text', () => {
    render(<Header />);
    const logo = screen.getByAltText('Xlink logo');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/images/xlink_logo_v2.png');
  });

  it('renders the title "Conversation Parking"', () => {
    render(<Header />);
    expect(screen.getByText('Conversation Parking')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SkeletonLoader
// ---------------------------------------------------------------------------
describe('SkeletonLoader', () => {
  it('renders skeleton placeholders with loading status', () => {
    render(<SkeletonLoader count={3} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Cargando interacciones')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
describe('EmptyState', () => {
  it('shows empty state message', () => {
    render(<EmptyState />);
    expect(screen.getByText('No hay interacciones disponibles')).toBeInTheDocument();
  });
});


// ---------------------------------------------------------------------------
// ErrorMessage
// ---------------------------------------------------------------------------
describe('ErrorMessage', () => {
  it('shows error message and a retry button', () => {
    const onRetry = vi.fn();
    render(<ErrorMessage message="Algo salió mal" onRetry={onRetry} />);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /reintentar/i });
    expect(retryBtn).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// InteractionCard — visual differentiation parked / unparked
// ---------------------------------------------------------------------------
describe('InteractionCard', () => {
  const baseInteraction: Interaction = {
    id: '1',
    originLine: '+573001234567',
    destinationLine: '+573009876543',
    startTimestamp: new Date(Date.now() - 120_000).toISOString(),
    isParked: false,
  };

  it('applies green styling when interaction is active (not parked)', () => {
    const { container } = render(
      <InteractionCard interaction={baseInteraction} onUnpark={() => {}} isSending={false} />
    );
    const card = container.firstElementChild!;
    expect(card.className).toContain('bg-green-50');
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  it('applies amber styling when interaction is parked', () => {
    const parked: Interaction = { ...baseInteraction, isParked: true };
    const { container } = render(
      <InteractionCard interaction={parked} onUnpark={() => {}} isSending={false} />
    );
    const card = container.firstElementChild!;
    expect(card.className).toContain('bg-amber-50');
    expect(screen.getByText('Parqueada')).toBeInTheDocument();
  });

  it('shows loading indicator on the button when isSending is true and interaction is parked', () => {
    const parked: Interaction = { ...baseInteraction, isParked: true };
    render(
      <InteractionCard interaction={parked} onUnpark={() => {}} isSending={true} />
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-label', 'Procesando...');
  });

  it('does not show button when interaction is not parked', () => {
    render(
      <InteractionCard interaction={baseInteraction} onUnpark={() => {}} isSending={false} />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// LineSelector
// ---------------------------------------------------------------------------
describe('LineSelector', () => {
  const mockLines: Line[] = [
    { id: 'l1', number: 'Línea 1', phone_number_id: 'pn1', phone_number: '+573001111111' },
    { id: 'l2', number: 'Línea 2', phone_number_id: 'pn2', phone_number: '+573002222222' },
  ];

  it('renders all line options', () => {
    render(<LineSelector lines={mockLines} selectedLineId="l1" onSelect={() => {}} isLoading={false} />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Línea 1 (+573001111111)');
    expect(options[1]).toHaveTextContent('Línea 2 (+573002222222)');
  });

  it('shows "Cargando líneas..." when loading', () => {
    render(<LineSelector lines={[]} selectedLineId={null} onSelect={() => {}} isLoading={true} />);
    expect(screen.getByText('Cargando líneas...')).toBeInTheDocument();
  });
});
