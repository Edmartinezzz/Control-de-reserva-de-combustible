import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  const sectors = await prisma.sector.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(sectors);
}


