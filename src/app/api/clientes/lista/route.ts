import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const base = process.env.BACKEND_API_BASE_URL;
  if (base) {
    try {
      const authHeader = request.headers.get('authorization');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      const resp = await fetch(`${base}/api/clientes/lista`, {
        cache: 'no-store',
        headers,
      });
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: 'Error al obtener lista de clientes', details: text }, { status: resp.status });
      }
      const data = await resp.json();
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: 'No se pudo conectar al backend de clientes' }, { status: 502 });
    }
  }
  return NextResponse.json(
    {
      error:
        'Este endpoint de Next.js no está activo. Configure BACKEND_API_BASE_URL para proxy al backend Flask (ruta /api/clientes/lista).',
    },
    { status: 503 }
  );
}

