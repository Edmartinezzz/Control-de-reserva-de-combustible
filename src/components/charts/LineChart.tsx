import React from 'react';

type Point = { x: number; y: number };

export function LineChart({ points }: { points: Point[] }) {
  const width = 400;
  const height = 160;
  const padding = 24;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scaleX = (x: number) => padding + ((x - minX) / (maxX - minX || 1)) * (width - padding * 2);
  const scaleY = (y: number) => height - padding - ((y - minY) / (maxY - minY || 1)) * (height - padding * 2);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ');
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}> 
      <rect x={1} y={1} width={width-2} height={height-2} rx={8} className="fill-white stroke-gray-200" />
      <path d={d} className="stroke-rose-500 fill-none" strokeWidth={2} />
    </svg>
  );
}






