"use client";
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

type Sector = { id: string; name: string };
type Driver = { id: string; name: string };
type Order = {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  sectorId: string;
  sector: Sector;
  qty: number;
  gasType: string;
  status: string;
  driverId: string | null;
};

export default function AdminPanel() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterSector, setFilterSector] = useState<string>('');

  useEffect(() => {
    Promise.all([
      axios.get('/api/admin/sectors'),
      axios.get('/api/admin/drivers'),
      axios.get('/api/admin/orders')
    ]).then(([s, d, o]) => {
      setSectors(s.data);
      setDrivers(d.data);
      setOrders(o.data);
    });
  }, []);

  const filteredOrders = useMemo(() => {
    if (!filterSector) return orders;
    return orders.filter(o => o.sectorId === filterSector);
  }, [orders, filterSector]);

  async function assign(orderId: string, driverId: string) {
    await axios.post('/api/admin/assign', { orderId, driverId });
    const res = await axios.get('/api/admin/orders');
    setOrders(res.data);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium">Filtrar por sector</label>
          <select className="mt-1 rounded-md border-gray-300" value={filterSector} onChange={e => setFilterSector(e.target.value)}>
            <option value="">Todos</option>
            {sectors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-3">Cliente</th>
              <th className="p-3">Teléfono</th>
              <th className="p-3">Dirección</th>
              <th className="p-3">Sector</th>
              <th className="p-3">Cantidad</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Asignación</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => (
              <tr key={o.id} className="border-t">
                <td className="p-3">{o.customerName}</td>
                <td className="p-3">{o.phone}</td>
                <td className="p-3">{o.address}</td>
                <td className="p-3">{o.sector?.name || '-'}</td>
                <td className="p-3">{o.qty}</td>
                <td className="p-3">{o.gasType}</td>
                <td className="p-3">{o.status}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <select className="rounded-md border-gray-300" value={o.driverId || ''} onChange={e => assign(o.id, e.target.value)}>
                      <option value="">Sin asignar</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


