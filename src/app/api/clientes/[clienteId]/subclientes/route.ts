import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: { clienteId: string } }
) {
    const base = process.env.BACKEND_API_BASE_URL;
    if (base) {
        try {
            const token = request.headers.get('authorization');
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = token;
            }

            const response = await fetch(
                `${base}/api/clientes/${params.clienteId}/subclientes`,
                {
                    method: 'GET',
                    cache: 'no-store',
                    headers,
                }
            );

            const data = await response.json();
            return NextResponse.json(data, { status: response.status });
        } catch (error) {
            console.error('Error en proxy de subclientes GET:', error);
            return NextResponse.json(
                { error: 'Error al obtener subclientes' },
                { status: 500 }
            );
        }
    }

    return NextResponse.json(
        { error: 'Backend URL no configurada' },
        { status: 500 }
    );
}

export async function POST(
    request: NextRequest,
    { params }: { params: { clienteId: string } }
) {
    const base = process.env.BACKEND_API_BASE_URL;
    if (base) {
        try {
            const body = await request.json();
            const token = request.headers.get('authorization');
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = token;
            }

            const response = await fetch(
                `${base}/api/clientes/${params.clienteId}/subclientes`,
                {
                    method: 'POST',
                    cache: 'no-store',
                    headers,
                    body: JSON.stringify(body),
                }
            );

            const data = await response.json();
            return NextResponse.json(data, { status: response.status });
        } catch (error) {
            console.error('Error en proxy de subclientes POST:', error);
            return NextResponse.json(
                { error: 'Error al crear subcliente' },
                { status: 500 }
            );
        }
    }

    return NextResponse.json(
        { error: 'Backend URL no configurada' },
        { status: 500 }
    );
}
