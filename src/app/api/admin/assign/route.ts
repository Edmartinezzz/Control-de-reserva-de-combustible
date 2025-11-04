import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { WhatsAppClient } from '../../../lib/whatsapp';

export async function POST(req: NextRequest) {
  const { orderId, driverId } = await req.json();
  if (!orderId || !driverId) return NextResponse.json({ error: 'orderId y driverId requeridos' }, { status: 400 });

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'ASIGNADO', delivery: { upsert: { update: { driverId }, create: { driverId } } } },
    include: { delivery: { include: { driver: true } } }
  });

  // Notificar por WhatsApp (si config presente)
  const wa = new WhatsAppClient();
  if (wa.isConfigured()) {
    try {
      await wa.sendTextMessage(order.phone, `Tu pedido ha sido asignado. Repartidor: ${order.delivery?.driver?.name}`);
    } catch {
      // No bloquear por fallo de notificación
    }
  }

  return NextResponse.json({ ok: true });
}


