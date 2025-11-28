import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const base = process.env.BACKEND_API_BASE_URL;

  // Si hay un backend configurado, usarlo (Proxy)
  if (base) {
    try {
      const authHeader = request.headers.get('authorization');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      const resp = await fetch(`${base}/api/estadisticas/retiros`, {
        method: 'GET',
        headers,
        cache: 'no-store'
      });

      if (!resp.ok) {
        // Si falla el backend, intentar devolver estructura vacía para no romper el frontend
        console.error(`Backend error: ${resp.status}`);
        return NextResponse.json({
          litrosHoy: 0,
          litrosMes: 0,
          litrosAno: 0,
          clientesHoy: 0,
          litrosPorMes: [],
          retirosPorDia: []
        });
      }

      const data = await resp.json();
      return NextResponse.json(data);
    } catch (e: any) {
      console.error('Error proxying to backend:', e);
      // Fallback seguro
      return NextResponse.json({
        litrosHoy: 0,
        litrosMes: 0,
        litrosAno: 0,
        clientesHoy: 0,
        litrosPorMes: [],
        retirosPorDia: []
      });
    }
  }

  // Si no hay backend configurado, devolver 0s (evitar error 500)
  return NextResponse.json({
    litrosHoy: 0,
    litrosMes: 0,
    litrosAno: 0,
    clientesHoy: 0,
    litrosPorMes: [],
    retirosPorDia: []
  });
}
