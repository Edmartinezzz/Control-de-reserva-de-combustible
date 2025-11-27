"""
Script para verificar el estado de agendamientos y estadísticas
"""

import psycopg2
import psycopg2.extras
import os
import urllib.parse
from datetime import date

def verificar_estado():
    try:
        database_url = os.environ.get('DATABASE_URL', 'postgresql://despacho_gas_user:PHiZn59ErClN2WzvifSZe41IZPMlkxBw@dpg-d4g68aefu37c739p32g0-a.oregon-postgres.render.com/despacho_gas')
        
        result = urllib.parse.urlparse(database_url)
        
        conn = psycopg2.connect(
            database=result.path[1:],
            user=result.username,
            password=result.password,
            host=result.hostname,
            port=result.port,
            cursor_factory=psycopg2.extras.RealDictCursor
        )
        
        cursor = conn.cursor()
        
        print("=" * 70)
        print("VERIFICACION DE AGENDAMIENTOS Y ESTADISTICAS")
        print("=" * 70)
        
        # 1. Ver agendamientos de hoy
        print("\n1. Agendamientos de hoy:")
        cursor.execute("""
            SELECT id, cliente_id, litros, tipo_combustible, estado, fecha_agendada, codigo_ticket
            FROM agendamientos
            WHERE fecha_agendada = CURRENT_DATE
            ORDER BY codigo_ticket
        """)
        agendamientos = cursor.fetchall()
        
        if agendamientos:
            for ag in agendamientos:
                print(f"   ID: {ag['id']}, Ticket: {ag['codigo_ticket']}, "
                      f"Litros: {ag['litros']}L {ag['tipo_combustible']}, "
                      f"Estado: {ag['estado']}")
        else:
            print("   No hay agendamientos para hoy")
        
        # 2. Calcular lo que debería mostrar la estadística
        print("\n2. Cálculo de estadísticas para HOY:")
        
        # Retiros directos
        cursor.execute("SELECT COALESCE(SUM(litros), 0) as total FROM retiros WHERE DATE(fecha) = CURRENT_DATE")
        retiros_hoy = cursor.fetchone()['total']
        print(f"   Retiros directos: {retiros_hoy}L")
        
        # Agendamientos entregados
        cursor.execute("SELECT COALESCE(SUM(litros), 0) as total FROM agendamientos WHERE fecha_agendada = CURRENT_DATE AND estado = 'entregado'")
        agendamientos_entregados = cursor.fetchone()['total']
        print(f"   Agendamientos entregados: {agendamientos_entregados}L")
        
        # Total
        total = retiros_hoy + agendamientos_entregados
        print(f"   TOTAL (lo que debería mostrar la gráfica): {total}L")
        
        # 3. Ver todos los estados posibles
        print("\n3. Estados únicos en agendamientos:")
        cursor.execute("SELECT DISTINCT estado FROM agendamientos")
        estados = cursor.fetchall()
        for estado in estados:
            cursor.execute("SELECT COUNT(*) as count FROM agendamientos WHERE estado = %s", (estado['estado'],))
            count = cursor.fetchone()['count']
            print(f"   '{estado['estado']}': {count} registros")
        
        conn.close()
        
        print("\n" + "=" * 70)
        print("Verificación completada")
        print("=" * 70)
        
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import sys
    import io
    
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    verificar_estado()
