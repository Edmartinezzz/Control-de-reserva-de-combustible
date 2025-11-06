import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(req: NextRequest) {
  const vehicles = await (prisma as any).vehicle.findMany({ include: { sector: true, owner: true } });
  return NextResponse.json(vehicles);
}

export async function PATCH(req: NextRequest) {
  if (req.method !== 'PATCH') {
    return NextResponse.json({ error: 'Método no permitido' }, { status: 405 });
  }
  const body = await req.json();
  const { id, litersAvailable } = body;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const data: any = {};
  if (typeof litersAvailable === 'number') data.litersAvailable = litersAvailable;
  if (typeof body.capacity === 'number') data.capacity = body.capacity;
  if (typeof body.sectorId === 'string') data.sectorId = body.sectorId || null;

  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 });

  const updated = await (prisma as any).vehicle.update({ where: { id }, data });
  return NextResponse.json(updated);
}
