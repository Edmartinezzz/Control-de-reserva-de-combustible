import { NextResponse } from 'next/server';

export async function GET() {
  const base = process.env.BACKEND_API_BASE_URL;
  if (base) {
    try {
      const resp = await fetch(`${base}/api/estadisticas`, { cache: 'no-store' });
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: 'Error al obtener estadísticas', details: text }, { status: resp.status });
      }
      const data = await resp.json();
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: 'No se pudo conectar al backend de estadísticas' }, { status: 502 });
    }
  }
  // Sin backend configurado: responder informativo
  return NextResponse.json(
    {
      error:
        'Este endpoint de Next.js no está activo. Configure BACKEND_API_BASE_URL para proxy al backend Express (ruta /api/estadisticas).',
    },
    { status: 503 }
  );
}
