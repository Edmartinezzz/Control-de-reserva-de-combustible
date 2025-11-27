"""
Script para verificar la fecha y hora de la base de datos
"""

import os
import sys
import psycopg2
import psycopg2.extras
import urllib.parse
from datetime import datetime

def verificar_fecha_db():
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
        print("DIAGNOSTICO DE FECHA Y HORA")
        print("="*60)
        
        # Consultar fecha actual de la DB
        cursor.execute("SELECT CURRENT_DATE, CURRENT_TIMESTAMP, CURRENT_TIME")
        row = cursor.fetchone()
        
        print(f"Fecha DB (CURRENT_DATE): {row['current_date']}")
        print(f"Timestamp DB: {row['current_timestamp']}")
        
        # Consultar zona horaria
        cursor.execute("SHOW TIMEZONE")
        timezone = cursor.fetchone()
        print(f"Zona Horaria DB: {timezone['TimeZone']}")
        
        # Consultar ultimo reset guardado
        cursor.execute("SELECT fecha_ultimo_reset FROM sistema_config WHERE id = 1")
        config = cursor.fetchone()
        print(f"Ultimo Reset Guardado: {config['fecha_ultimo_reset']}")
        
        conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    verificar_fecha_db()
