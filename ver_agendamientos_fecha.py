"""
Script para ver agendamientos de los próximos días
"""

import psycopg2
import psycopg2.extras
import os
import urllib.parse
from datetime import date, timedelta

def ver_agendamientos():
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
        print("AGENDAMIENTOS POR FECHA")
        print("=" * 70)
        
        # Ver agendamientos de los últimos 3 días y próximos 3 días
        for i in range(-3, 4):
            fecha = date.today() + timedelta(days=i)
            
            cursor.execute("""
                SELECT id, cliente_id, litros, tipo_combustible, estado, fecha_agendada, codigo_ticket
                FROM agendamientos
                WHERE fecha_agendada = %s
                ORDER BY codigo_ticket
            """, (fecha,))
            
            agendamientos = cursor.fetchall()
            
            if agendamientos:
                label = "HOY" if i == 0 else ("MAÑANA" if i == 1 else ("AYER" if i == -1 else str(fecha)))
                print(f"\n{label} ({fecha}):")
                for ag in agendamientos:
                    print(f"   Ticket #{ag['codigo_ticket']}: {ag['litros']}L {ag['tipo_combustible']}, Estado: {ag['estado']}")
        
        conn.close()
        
        print("\n" + "=" * 70)
        
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import sys
    import io
    
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    ver_agendamientos()
