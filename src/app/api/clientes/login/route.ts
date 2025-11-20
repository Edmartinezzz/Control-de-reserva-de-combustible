import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const base = process.env.BACKEND_API_BASE_URL;
  if (base) {
    try {
      const body = await request.json();
      const resp = await fetch(`${base}/api/clientes/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: 'Error al iniciar sesión', details: text }, { status: resp.status });
      }
      const data = await resp.json();
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: 'No se pudo conectar al backend de login' }, { status: 502 });
    }
  }
  return NextResponse.json(
    {
      error:
        'Este endpoint de Next.js no está activo. Configure BACKEND_API_BASE_URL para proxy al backend Flask (ruta /api/clientes/login).',
    },
    { status: 503 }
  );
}

