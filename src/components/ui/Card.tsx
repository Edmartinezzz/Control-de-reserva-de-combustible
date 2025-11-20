import React from 'react';

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-red-100 bg-white p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-fade-in-up">{children}</div>;
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex items-center justify-between animate-fade-in">{children}</div>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-red-800 animate-fade-in-down">{children}</h2>;
}






