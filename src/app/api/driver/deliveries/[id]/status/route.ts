import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { status } = await req.json();
  if (!status) return NextResponse.json({ error: 'status requerido' }, { status: 400 });

  const updated = await prisma.delivery.update({
    where: { id: context.params.id },
    data: { status }
  });

  if (status === 'ENTREGADO') {
    // cerrar pedido
    await prisma.order.update({ where: { id: updated.orderId }, data: { status: 'COMPLETADO' } });
  }

  return NextResponse.json({ ok: true });
}


