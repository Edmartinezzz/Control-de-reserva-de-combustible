import React from 'react';

type StatCardProps = {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: 'coral' | 'aqua' | 'yellow' | 'teal';
};

const colorStyles: Record<string, string> = {
  coral: 'bg-rose-200 text-rose-900',
  aqua: 'bg-teal-200 text-teal-900',
  yellow: 'bg-amber-200 text-amber-900',
  teal: 'bg-cyan-200 text-cyan-900'
};

export function StatCard({ label, value, sublabel, color = 'aqua' }: StatCardProps) {
  return (
    <div className={`rounded-lg ${colorStyles[color]} p-4`}> 
      <div className="text-xs uppercase opacity-80">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sublabel && <div className="text-xs opacity-80">{sublabel}</div>}
    </div>
  );
}






