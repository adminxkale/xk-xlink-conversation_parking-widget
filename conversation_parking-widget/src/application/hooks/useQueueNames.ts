"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface QueueNameMap {
  [queueId: string]: string;
}

export function useQueueNames(
  queueIds: string[],
  token: string | null
): QueueNameMap {
  const [queueNames, setQueueNames] = useState<QueueNameMap>({});
  const cacheRef = useRef<QueueNameMap>({});
  const pendingRef = useRef<Set<string>>(new Set());

  const fetchQueueName = useCallback(
    async (queueId: string) => {
      if (!token || !queueId) return;
      if (cacheRef.current[queueId] || pendingRef.current.has(queueId)) return;

      pendingRef.current.add(queueId);

      try {
        const response = await fetch(
          `/api/proxy-queues?queueId=${encodeURIComponent(queueId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data: { id: string; name: string } = await response.json();
          cacheRef.current[queueId] = data.name;
          setQueueNames((prev) => ({ ...prev, [queueId]: data.name }));
        }
      } catch {
        // Silently fail — queue name is non-critical
      } finally {
        pendingRef.current.delete(queueId);
      }
    },
    [token]
  );

  useEffect(() => {
    const uniqueIds = [...new Set(queueIds)].filter(
      (id) => id && !cacheRef.current[id]
    );

    uniqueIds.forEach((id) => {
      fetchQueueName(id);
    });
  }, [queueIds, fetchQueueName]);

  return queueNames;
}
