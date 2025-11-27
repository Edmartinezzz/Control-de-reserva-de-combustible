"""
Script para probar la lógica de estadísticas
"""

import os
import sys
import psycopg2
import psycopg2.extras
import urllib.parse

def probar_estadisticas():
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
        print("PRUEBA DE CONSULTAS DE ESTADISTICAS")
        print("="*60)
        
        # 1. Litros hoy
        print("Consulta: SELECT SUM(litros) FROM retiros WHERE DATE(fecha) = CURRENT_DATE")
        cursor.execute("SELECT SUM(litros) as total FROM retiros WHERE DATE(fecha) = CURRENT_DATE")
        res = cursor.fetchone()
        litros_hoy = res['total']
        print(f"Resultado Litros Hoy: {litros_hoy}")
        
        # 2. Ver fecha del retiro insertado
        cursor.execute("SELECT id, fecha, litros FROM retiros ORDER BY id DESC LIMIT 1")
        ultimo = cursor.fetchone()
        print(f"Ultimo retiro: ID {ultimo['id']}, Fecha {ultimo['fecha']}, Litros {ultimo['litros']}")
        
        # 3. Ver CURRENT_DATE de la DB
        cursor.execute("SELECT CURRENT_DATE")
        print(f"CURRENT_DATE DB: {cursor.fetchone()['current_date']}")
        
        conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    probar_estadisticas()
