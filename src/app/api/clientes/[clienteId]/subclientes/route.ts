import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string }> }
) {
  const base = process.env.BACKEND_API_BASE_URL;
  if (base) {
    try {
      const { clienteId } = await params;
      const authHeader = request.headers.get('authorization');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      const resp = await fetch(`${base}/api/clientes/${clienteId}/subclientes`, {
        cache: 'no-store',
        headers,
      });
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: 'Error al obtener subclientes', details: text }, { status: resp.status });
      }
      const data = await resp.json();
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: 'No se pudo conectar al backend de subclientes' }, { status: 502 });
    }
  }
  return NextResponse.json(
    {
      error:
        'Este endpoint de Next.js no está activo. Configure BACKEND_API_BASE_URL para proxy al backend Flask (ruta /api/clientes/:clienteId/subclientes).',
    },
    { status: 503 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clienteId: string }> }
) {
  const base = process.env.BACKEND_API_BASE_URL;
  if (base) {
    try {
      const { clienteId } = await params;
      const body = await request.json();
      const authHeader = request.headers.get('authorization');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      const resp = await fetch(`${base}/api/clientes/${clienteId}/subclientes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: 'Error al crear subcliente', details: text }, { status: resp.status });
      }
      const data = await resp.json();
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: 'No se pudo conectar al backend de subclientes' }, { status: 502 });
    }
  }
  return NextResponse.json(
    {
      error:
        'Este endpoint de Next.js no está activo. Configure BACKEND_API_BASE_URL para proxy al backend Flask (ruta /api/clientes/:clienteId/subclientes).',
    },
    { status: 503 }
  );
}

