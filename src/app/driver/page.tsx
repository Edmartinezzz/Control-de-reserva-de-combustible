"use client";
import React, { useEffect, useState } from 'react';
import axios from 'axios';

type Delivery = {
  id: string;
  order: {
    customerName: string;
    phone: string;
    address: string;
    qty: number;
    gasType: string;
  };
  status: string;
};

export default function DriverApp() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await axios.get('/api/driver/deliveries');
    setDeliveries(res.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: string) {
    await axios.patch(`/api/driver/deliveries/${id}/status`, { status });
    await load();
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mis entregas</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {deliveries.map(d => (
          <div key={d.id} className="rounded-md border bg-white p-4">
            <div className="font-medium">{d.order.customerName} • {d.order.phone}</div>
            <div className="text-sm text-gray-700">{d.order.address}</div>
            <div className="text-sm text-gray-700">{d.order.qty} × {d.order.gasType}</div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs rounded bg-gray-100 px-2 py-1">{d.status}</span>
              <div className="ml-auto flex gap-2">
                <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={() => updateStatus(d.id, 'EN_CAMINO')}>En camino</button>
                <button className="rounded bg-green-600 px-3 py-1 text-white" onClick={() => updateStatus(d.id, 'ENTREGADO')}>Entregado</button>
                <button className="rounded bg-red-600 px-3 py-1 text-white" onClick={() => updateStatus(d.id, 'FALLIDO')}>Fallido</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


