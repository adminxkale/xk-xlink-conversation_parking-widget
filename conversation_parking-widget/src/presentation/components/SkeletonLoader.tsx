"use client";

interface SkeletonLoaderProps {
  count?: number;
}

export function SkeletonLoader({ count = 3 }: SkeletonLoaderProps) {
  return (
    <div className="space-y-3" role="status" aria-label="Cargando interacciones">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-20 rounded-lg bg-gray-200 animate-pulse"
        />
      ))}
    </div>
  );
}
