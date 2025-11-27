"""
Script para simular un retiro directo a la base de datos
"""

import os
import sys
import psycopg2
import psycopg2.extras
import urllib.parse

def simular_retiro():
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
        print("SIMULANDO RETIRO DIRECTO")
        print("="*60)
        
        # Buscar el cliente de prueba
        cursor.execute("SELECT id, litros_disponibles FROM clientes WHERE nombre LIKE 'CLIENTE PRUEBA%' LIMIT 1")
        cliente = cursor.fetchone()
        
        if not cliente:
            print("ERROR: No se encontro el cliente de prueba.")
            return
            
        cliente_id = cliente['id']
        litros_antes = cliente['litros_disponibles']
        litros_retiro = 5.0
        
        print(f"Cliente ID: {cliente_id}")
        print(f"Saldo antes: {litros_antes}")
        
        # Insertar retiro
        cursor.execute("""
            INSERT INTO retiros (cliente_id, fecha, hora, litros, usuario_id, tipo_combustible)
            VALUES (%s, CURRENT_DATE, CURRENT_TIME, %s, 1, 'gasolina')
            RETURNING id
        """, (cliente_id, litros_retiro))
        
        retiro_id = cursor.fetchone()['id']
        
        # Actualizar saldo
        cursor.execute("""
            UPDATE clientes 
            SET litros_disponibles = litros_disponibles - %s,
                litros_disponibles_gasolina = litros_disponibles_gasolina - %s
            WHERE id = %s
        """, (litros_retiro, litros_retiro, cliente_id))
        
        conn.commit()
        
        print(f"OK - Retiro registrado exitosamente! ID: {retiro_id}")
        print(f"Retirado: {litros_retiro}L")
        
        # Verificar saldo nuevo
        cursor.execute("SELECT litros_disponibles FROM clientes WHERE id = %s", (cliente_id,))
        litros_despues = cursor.fetchone()['litros_disponibles']
        print(f"Saldo despues: {litros_despues}")
        
        conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == '__main__':
    simular_retiro()
