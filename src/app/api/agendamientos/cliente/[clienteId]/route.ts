import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ clienteId: string }> }
) {
    try {
        const { clienteId } = await params;
        const backendUrl = process.env.BACKEND_API_BASE_URL;

        if (!backendUrl) {
            console.error('❌ BACKEND_API_BASE_URL no está configurada');
            return NextResponse.json(
                { error: 'Configuración del servidor incorrecta' },
                { status: 500 }
            );
        }

        // Obtener el token de autorización
        const authHeader = request.headers.get('authorization');

        if (!authHeader) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        console.log(`📡 Proxy GET /api/agendamientos/cliente/${clienteId}`);
        console.log(`🔗 Backend URL: ${backendUrl}/api/agendamientos/cliente/${clienteId}`);

        // Hacer la petición al backend de Flask
        const response = await fetch(
            `${backendUrl}/api/agendamientos/cliente/${clienteId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json',
                },
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error(`❌ Error del backend: ${response.status}`, data);
            return NextResponse.json(
                data,
                { status: response.status }
            );
        }

        console.log(`✅ Agendamientos obtenidos exitosamente para cliente ${clienteId}`);
        return NextResponse.json(data);

    } catch (error) {
        console.error('❌ Error en proxy de agendamientos por cliente:', error);

        if (error instanceof Error) {
            return NextResponse.json(
                {
                    error: 'Error al conectar con el servidor',
                    details: error.message
                },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
