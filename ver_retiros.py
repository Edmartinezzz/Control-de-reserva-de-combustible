"""
Script para ver los últimos retiros registrados
"""

import os
import sys
import psycopg2
import psycopg2.extras
import urllib.parse

def ver_retiros():
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL no esta configurada")
        sys.exit(1)
    
    try:
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
        
        print("="*60)
        print("ULTIMOS 5 RETIROS REGISTRADOS")
        print("="*60)
        
        cursor.execute("""
            SELECT r.id, r.fecha, r.hora, r.litros, c.nombre as cliente, r.tipo_combustible
            FROM retiros r
            JOIN clientes c ON r.cliente_id = c.id
            ORDER BY r.fecha DESC, r.hora DESC
            LIMIT 5
        """)
        
        retiros = cursor.fetchall()
        
        if not retiros:
            print("No hay retiros registrados en la base de datos.")
        else:
            for r in retiros:
                print(f"ID: {r['id']} | Fecha: {r['fecha']} {r['hora']} | Cliente: {r['cliente']} | {r['litros']}L {r['tipo_combustible']}")
        
        print("-" * 60)
        
        # Verificar fecha actual de la DB de nuevo
        cursor.execute("SELECT CURRENT_DATE")
        print(f"Fecha actual DB: {cursor.fetchone()['current_date']}")
        
        conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    ver_retiros()
