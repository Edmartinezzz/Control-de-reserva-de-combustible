import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';

const OrderSchema = z.object({
  customerName: z.string().min(2),
  phone: z.string().min(5),
  address: z.string().min(3),
  sectorId: z.string().min(1),
  qty: z.number().int().min(1),
  gasType: z.string().min(2)
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = OrderSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const order = await prisma.order.create({
    data: {
      customerName: data.customerName,
      phone: data.phone,
      address: data.address,
      qty: data.qty,
      gasType: data.gasType,
      sectorId: data.sectorId
    }
  });

  return NextResponse.json({ id: order.id });
}


