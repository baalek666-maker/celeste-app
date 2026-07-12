/**
 * Skeleton — premium loading placeholder with shimmer.
 * Variants for cards, lists, charts, and text blocks.
 */
import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'card' | 'text' | 'circle' | 'chart';
  lines?: number;
}

/** Skeleton block — text lines, circles, or generic blocks. */
export function Skeleton({ className = '', variant = 'text', lines = 1 }: SkeletonProps) {
  if (variant === 'circle') {
    return <div className={`skeleton rounded-full ${className}`} />;
  }

  // text variant with multiple lines
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-3 mb-2"
          style={{ width: i === lines - 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  );
}

/** Skeleton card — full card placeholder with avatar + lines. */
export function SkeletonCard({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="skeleton w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-1/3" />
          <div className="skeleton h-2 w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="skeleton h-3" style={{ width: i === lines - 1 ? '75%' : '100%' }} />
        ))}
      </div>
    </div>
  );
}

/** Skeleton chart — circular chart placeholder. */
export function SkeletonChart({ className = '' }: { className?: string }) {
  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>
      <div className="skeleton h-4 w-1/4 mb-4" />
      <div className="aspect-square skeleton rounded-full mx-auto" style={{ maxWidth: '280px' }} />
    </div>
  );
}

export default Skeleton;
