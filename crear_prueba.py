"""
Script para crear un cliente de prueba y verificar conexión
Version sin emojis
"""

import os
import sys
import psycopg2
import psycopg2.extras
import urllib.parse
import random

def crear_cliente_prueba():
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
        
        # Generar datos aleatorios
        cedula = f"V-{random.randint(10000000, 99999999)}"
        nombre = f"CLIENTE PRUEBA {random.randint(1, 100)}"
        
        print("="*60)
        print("CREANDO CLIENTE DE PRUEBA")
        print("="*60)
        
        cursor.execute("""
            INSERT INTO clientes (nombre, cedula, telefono, direccion, litros_mes, litros_disponibles, activo)
            VALUES (%s, %s, '04120000000', 'DIRECCION PRUEBA', 100, 100, TRUE)
            RETURNING id
        """, (nombre, cedula))
        
        cliente_id = cursor.fetchone()['id']
        conn.commit()
        
        print(f"OK - Cliente creado exitosamente!")
        print(f"ID: {cliente_id}")
        print(f"Nombre: {nombre}")
        print(f"Cedula: {cedula}")
        print("-" * 60)
        print("POR FAVOR, VE A TU DASHBOARD Y BUSCA ESTE CLIENTE.")
        print("Si NO lo ves, estamos conectados a bases de datos diferentes.")
        
        conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    crear_cliente_prueba()
