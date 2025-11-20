import React from 'react';

type BadgeProps = { variant?: 'default' | 'success' | 'warning' | 'danger'; children: React.ReactNode };

export function Badge({ variant = 'default', children }: BadgeProps) {
  const variants: Record<string, string> = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800'
  };
  return <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${variants[variant]}`}>{children}</span>;
}






