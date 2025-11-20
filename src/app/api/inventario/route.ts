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
      
      const resp = await fetch(`${base}/api/inventario`, {
        cache: 'no-store',
        headers,
      });
      
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: 'Error al obtener inventario', details: text }, { status: resp.status });
      }
      const data = await resp.json();
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: 'No se pudo conectar al backend' }, { status: 502 });
    }
  }
  return NextResponse.json({ error: 'Backend no configurado' }, { status: 503 });
}

export async function POST(request: NextRequest) {
  const base = process.env.BACKEND_API_BASE_URL;
  if (base) {
    try {
      const authHeader = request.headers.get('authorization');
      const body = await request.json();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      
      const resp = await fetch(`${base}/api/inventario`, {
        method: 'POST',
        cache: 'no-store',
        headers,
        body: JSON.stringify(body),
      });
      
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: 'Error al actualizar inventario', details: text }, { status: resp.status });
      }
      const data = await resp.json();
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: 'No se pudo conectar al backend' }, { status: 502 });
    }
  }
  return NextResponse.json({ error: 'Backend no configurado' }, { status: 503 });
}
