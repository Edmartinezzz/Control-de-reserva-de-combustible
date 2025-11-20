import React from 'react';
import { Card, CardHeader, CardTitle } from '../ui/Card';

type Event = { date: string; title: string };

export function Events({ month, items }: { month: string; items: Event[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{month} · Events</CardTitle>
      </CardHeader>
      <ul className="space-y-2 text-sm text-gray-700">
        {items.map((ev, i) => (
          <li key={i} className="rounded border px-3 py-2">
            <span className="mr-2 font-medium">{ev.date}</span>
            {ev.title}
          </li>
        ))}
      </ul>
    </Card>
  );
}






