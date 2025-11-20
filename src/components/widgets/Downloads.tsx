import React from 'react';
import { Card, CardHeader, CardTitle } from '../ui/Card';

type Item = { label: string; count: number };

export function Downloads({ items }: { items: Item[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Downloads</CardTitle>
      </CardHeader>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between rounded-md bg-amber-100/60 px-4 py-2">
            <div className="text-sm font-medium">{it.label}</div>
            <div className="text-lg font-semibold">{it.count.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}






