import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// Para demo no hay auth: devuelve todas las entregas en curso
export async function GET() {
  const deliveries = await prisma.delivery.findMany({
    orderBy: { id: 'desc' },
    include: { order: true }
  });
  return NextResponse.json(deliveries);
}


