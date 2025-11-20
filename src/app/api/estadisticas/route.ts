import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const base = process.env.BACKEND_API_BASE_URL;
  if (base) {
    try {
      // Obtener el token de Authorization del header de la petición
      const authHeader = request.headers.get('authorization');
      
      // Preparar headers para la petición al backend
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Si hay token, pasarlo al backend
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      
      const resp = await fetch(`${base}/api/estadisticas`, {
        cache: 'no-store',
        headers,
      });
      
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
