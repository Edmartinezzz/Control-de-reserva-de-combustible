import React from 'react';

type Slice = { value: number; color: string };

export function DonutChart({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const cx = 80, cy = 80, r = 60;
  let start = 0;
  return (
    <svg width={160} height={160} viewBox="0 0 160 160">
      {slices.map((s, i) => {
        const angle = (s.value / total) * Math.PI * 2;
        const x1 = cx + r * Math.cos(start);
        const y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(start + angle);
        const y2 = cy + r * Math.sin(start + angle);
        const large = angle > Math.PI ? 1 : 0;
        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        start += angle;
        return <path key={i} d={d} fill={s.color} opacity={0.9} />;
      })}
      <circle cx={cx} cy={cy} r={36} fill="white" />
    </svg>
  );
}





