"use client";

import type { Line } from "../../domain/entities/line";

interface LineSelectorProps {
  lines: Line[];
  selectedLineId: string | null;
  onSelect: (lineId: string) => void;
  isLoading: boolean;
}

export function LineSelector({ lines, selectedLineId, onSelect, isLoading }: LineSelectorProps) {
  console.log('[LineSelector] Rendering with lines:', lines, 'selectedLineId:', selectedLineId);

  if (isLoading) {
    return <p className="p-3 text-sm text-gray-500">Cargando líneas...</p>;
  }

  if (lines.length === 0) {
    return <p className="p-3 text-sm text-gray-500">No hay líneas disponibles</p>;
  }

  return (
    <div className="p-3">
      <label htmlFor="line-selector" className="sr-only">Seleccionar línea</label>
      <select
        id="line-selector"
        value={selectedLineId ?? ""}
        onChange={(e) => onSelect(e.target.value || "")}
        className="w-full p-2 text-sm border rounded-lg bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
        aria-label="Seleccionar línea del agente"
      >
        <option value="">Todas las líneas</option>
        {lines.map((line) => (
          <option key={line.id} value={line.id}>
            {line.number} ({line.phone_number})
          </option>
        ))}
      </select>
    </div>
  );
}
