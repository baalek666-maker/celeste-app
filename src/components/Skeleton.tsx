/**
 * Skeleton — placeholder shimmer component for loading states.
 * Used while data is fetching so the screen never feels empty or frozen.
 *
 * Variants:
 *   <Skeleton className="..." />          → animated gradient bar
 *   <SkeletonCard lines={3} />            → stacked rows simulating a card
 *   <SkeletonCircle size={64} />          → round avatar/sun placeholder
 *
 * The shimmer is a Tailwind keyframe defined in index.css as `animate-shimmer`
 * (uses background-position sliding). Accessibility: aria-hidden + role="status"
 * on the wrapper so screen readers announce the loading state via the
 * enclosing parent's role.
 */
import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-night-800/40 rounded ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className = '' }: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-label="Chargement en cours"
      className={`glass rounded-3xl p-5 space-y-3 ${className}`}
    >
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

interface SkeletonCircleProps {
  size?: number;
  className?: string;
}

export function SkeletonCircle({ size = 64, className = '' }: SkeletonCircleProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-full bg-night-800/40 relative overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}