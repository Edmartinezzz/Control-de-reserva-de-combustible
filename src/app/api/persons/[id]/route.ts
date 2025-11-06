import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'ID requerido' }, 
        { status: 400 }
      );
    }

    const person = await prisma.person.findUnique({ 
      where: { id },
      include: { 
        sector: true, 
        vehicles: true 
      } 
    });

    if (!person) {
      return NextResponse.json(
        { error: 'Persona no encontrada' }, 
        { status: 404 }
      );
    }

    return NextResponse.json(person);
  } catch (error) {
    console.error('Error en la ruta /api/persons/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
