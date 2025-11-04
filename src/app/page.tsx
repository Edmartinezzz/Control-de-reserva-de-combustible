"use client";
import React, { useEffect, useState } from 'react';
import axios from 'axios';

type Sector = { id: string; name: string };

export default function PublicPortalPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    address: '',
    sectorId: '',
    qty: 1,
    gasType: '10kg'
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    axios.get('/api/admin/sectors').then(r => setSectors(r.data));
  }, []);

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      await axios.post('/api/orders', {
        customerName: form.customerName,
        phone: form.phone,
        address: form.address,
        sectorId: form.sectorId,
        qty: Number(form.qty),
        gasType: form.gasType
      });
      setMessage('Pedido enviado correctamente. Te contactaremos por WhatsApp.');
      setForm({ customerName: '', phone: '', address: '', sectorId: '', qty: 1, gasType: '10kg' });
    } catch (err: unknown) {
      setMessage('No se pudo enviar el pedido. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Pide tu gas sin registrarte</h1>
        <p className="text-gray-600 mb-6">Completa el formulario y un repartidor te contactará.</p>
        <form onSubmit={submitOrder} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Nombre</label>
            <input required className="mt-1 w-full rounded-md border-gray-300" value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium">Teléfono</label>
            <input required className="mt-1 w-full rounded-md border-gray-300" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium">Dirección</label>
            <input required className="mt-1 w-full rounded-md border-gray-300" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium">Sector</label>
            <select required className="mt-1 w-full rounded-md border-gray-300" value={form.sectorId} onChange={e => setForm({ ...form, sectorId: e.target.value })}>
              <option value="">Selecciona...</option>
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Cantidad</label>
              <input type="number" min={1} className="mt-1 w-full rounded-md border-gray-300" value={form.qty} onChange={e => setForm({ ...form, qty: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium">Tipo de gas</label>
              <select className="mt-1 w-full rounded-md border-gray-300" value={form.gasType} onChange={e => setForm({ ...form, gasType: e.target.value })}>
                <option>10kg</option>
                <option>15kg</option>
                <option>45kg</option>
              </select>
            </div>
          </div>
          <button disabled={submitting} className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-60">
            {submitting ? 'Enviando...' : 'Enviar pedido'}
          </button>
          {message && <p className="text-sm text-gray-700">{message}</p>}
        </form>
      </div>
      <div className="hidden md:block">
        <div className="rounded-lg border bg-white p-6">
          <h2 className="font-semibold mb-2">¿Cómo funciona?</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
            <li>Envías tu pedido con dirección y teléfono.</li>
            <li>Asignamos un repartidor de tu sector.</li>
            <li>Te contactamos por WhatsApp para coordinar la entrega.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}


