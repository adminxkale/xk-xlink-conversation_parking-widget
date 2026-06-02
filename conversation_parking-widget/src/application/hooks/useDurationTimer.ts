"use client";

import { useState, useEffect } from "react";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface CountdownResult {
  display: string;
  isExpired: boolean;
}

export function formatCountdown(startTimestamp: string): CountdownResult {
  const start = new Date(startTimestamp).getTime();
  const deadline = start + TWENTY_FOUR_HOURS_MS;
  const now = Date.now();
  const remainingMs = deadline - now;

  if (remainingMs <= 0) {
    return { display: "00:00:00", isExpired: true };
  }

  const remainingSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  return {
    display: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    isExpired: false,
  };
}

export function useDurationTimer(startTimestamp: string): CountdownResult {
  const [countdown, setCountdown] = useState(() => formatCountdown(startTimestamp));

  useEffect(() => {
    const interval = setInterval(() => {
      const result = formatCountdown(startTimestamp);
      setCountdown(result);
      if (result.isExpired) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTimestamp]);

  return countdown;
}
