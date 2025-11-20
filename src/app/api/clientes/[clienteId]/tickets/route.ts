import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  const base = process.env.BACKEND_API_BASE_URL;
  if (base) {
    try {
      const { clienteId } = params;
      const authHeader = request.headers.get('authorization');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      const resp = await fetch(`${base}/api/clientes/${clienteId}/tickets`, {
        cache: 'no-store',
        headers,
      });
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: 'Error al obtener tickets del cliente', details: text }, { status: resp.status });
      }
      const data = await resp.json();
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: 'No se pudo conectar al backend de tickets' }, { status: 502 });
    }
  }
  return NextResponse.json(
    {
      error:
        'Este endpoint de Next.js no está activo. Configure BACKEND_API_BASE_URL para proxy al backend Flask (ruta /api/clientes/:clienteId/tickets).',
    },
    { status: 503 }
  );
}

