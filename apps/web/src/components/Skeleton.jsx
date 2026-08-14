import React from 'react';

export function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-text" />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`skeleton ${className}`} style={{ height: 120, padding: 16 }} />
  );
}
