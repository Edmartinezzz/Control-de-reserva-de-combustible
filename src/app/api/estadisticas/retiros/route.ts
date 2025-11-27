import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export async function GET(request: NextRequest) {
    try {
        // Resolve the SQLite database file (adjust path if needed)
        const dbPath = path.resolve(process.cwd(), 'gas_delivery.db');
        const db = await open({ filename: dbPath, driver: sqlite3.Database });

        // Litros retirados hoy
        const hoy = await db.get(`
      SELECT COALESCE(SUM(litros), 0) as total
      FROM retiros
      WHERE DATE(fecha) = DATE('now', 'localtime')
    `);
        // Litros retirados este mes
        const esteMes = await db.get(`
      SELECT COALESCE(SUM(litros), 0) as total
      FROM retiros
      WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now', 'localtime')
    `);
        // Litros retirados este año
        const esteAno = await db.get(`
      SELECT COALESCE(SUM(litros), 0) as total
      FROM retiros
      WHERE strftime('%Y', fecha) = strftime('%Y', 'now', 'localtime')
    `);
        // Clientes únicos que retiraron hoy
        const clientesHoy = await db.get(`
      SELECT COUNT(DISTINCT cliente_id) as total
      FROM retiros
      WHERE DATE(fecha) = DATE('now', 'localtime')
    `);
        // Litros por mes (últimos 12 meses)
        const litrosPorMes = await db.all(`
      SELECT strftime('%Y-%m', fecha) as mes, SUM(litros) as total
      FROM retiros
      WHERE fecha >= date('now', '-12 months', 'localtime')
      GROUP BY strftime('%Y-%m', fecha)
      ORDER BY mes ASC
    `);
        // Retiros por día (últimos 7 días)
        const retirosPorDia = await db.all(`
      SELECT DATE(fecha) as dia, SUM(litros) as total, COUNT(DISTINCT cliente_id) as clientes
      FROM retiros
      WHERE fecha >= date('now', '-7 days', 'localtime')
      GROUP BY DATE(fecha)
      ORDER BY dia ASC
    `);
        await db.close();
        return NextResponse.json({
            litrosHoy: hoy?.total || 0,
            litrosMes: esteMes?.total || 0,
            litrosAno: esteAno?.total || 0,
            clientesHoy: clientesHoy?.total || 0,
            litrosPorMes: litrosPorMes || [],
            retirosPorDia: retirosPorDia || [],
        });
    } catch (e: any) {
        console.error('Error al obtener estadísticas de retiros:', e);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
