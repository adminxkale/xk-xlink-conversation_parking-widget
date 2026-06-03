"use client";

import { useState, useEffect } from "react";
import type { Line } from "../../domain/entities/line";
import {
  fetchGroupPhones,
  fetchChannels,
} from "../../infrastructure/adapters/lines.adapter";
import { consolidateLines } from "../use-cases/consolidate-lines";

interface UseAgentLinesResult {
  lines: Line[];
  selectedLineId: string | null;
  setSelectedLineId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function useAgentLines(
  agentGroupIds: string[] | null,
  tenant?: string | null
): UseAgentLinesResult {
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // null means still loading auth — do nothing
    if (agentGroupIds === null || !tenant) return;

    let cancelled = false;

    async function loadLines() {
      setIsLoading(true);
      setError(null);

      try {
        let result: Line[];

        if (agentGroupIds!.length > 0) {
          const settled = await Promise.allSettled(
            agentGroupIds!.map((gid) => fetchGroupPhones(gid, tenant))
          );

          const fulfilled = settled.filter(
            (r): r is PromiseSettledResult<Line[]> & { status: "fulfilled" } =>
              r.status === "fulfilled"
          );

          if (fulfilled.length === 0) {
            throw new Error(
              "No se pudieron cargar las líneas: todos los grupos fallaron"
            );
          }

          result = consolidateLines(fulfilled.map((r) => r.value));
          console.log('[useAgentLines] Consolidated lines:', result);
        } else {
          result = await fetchChannels();
        }

        if (cancelled) return;

        console.log('[useAgentLines] Líneas cargadas en el selector:', result);
        setLines(result);
        if (result.length > 0) {
          setSelectedLineId(result[0].id);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load lines");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLines();

    return () => {
      cancelled = true;
    };
  }, [agentGroupIds, tenant]);

  return { lines, selectedLineId, setSelectedLineId, isLoading, error };
}
