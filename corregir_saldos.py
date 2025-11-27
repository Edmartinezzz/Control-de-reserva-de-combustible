"""
Script para recalcular y corregir los saldos de los clientes
basado en los retiros realizados hoy.

Uso: python corregir_saldos.py
"""

import os
import sys
import psycopg2
import psycopg2.extras
import urllib.parse
from datetime import datetime

def corregir_saldos():
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
        print("CORRECCION DE SALDOS")
        print("="*60)
        
        # 1. Obtener todos los clientes activos
        cursor.execute("SELECT id, nombre, litros_mes_gasolina, litros_mes_gasoil FROM clientes WHERE activo = TRUE")
        clientes = cursor.fetchall()
        
        print(f"Procesando {len(clientes)} clientes...")
        print("-" * 60)
        
        clientes_corregidos = 0
        
        for cliente in clientes:
            cliente_id = cliente['id']
            litros_diarios_gasolina = cliente['litros_mes_gasolina'] or 0
            litros_diarios_gasoil = cliente['litros_mes_gasoil'] or 0
            
            # 2. Sumar retiros de hoy por tipo de combustible
            # Gasolina
            cursor.execute("""
                SELECT SUM(litros) as total 
                FROM retiros 
                WHERE cliente_id = %s 
                AND DATE(fecha) = CURRENT_DATE 
                AND tipo_combustible = 'gasolina'
            """, (cliente_id,))
            retiros_gasolina = cursor.fetchone()['total'] or 0
            
            # Gasoil
            cursor.execute("""
                SELECT SUM(litros) as total 
                FROM retiros 
                WHERE cliente_id = %s 
                AND DATE(fecha) = CURRENT_DATE 
                AND tipo_combustible = 'gasoil'
            """, (cliente_id,))
            retiros_gasoil = cursor.fetchone()['total'] or 0
            
            # 3. Calcular saldo real
            saldo_real_gasolina = litros_diarios_gasolina - retiros_gasolina
            saldo_real_gasoil = litros_diarios_gasoil - retiros_gasoil
            
            # Asegurar que no sea negativo (opcional, pero por seguridad)
            if saldo_real_gasolina < 0: saldo_real_gasolina = 0
            if saldo_real_gasoil < 0: saldo_real_gasoil = 0
            
            # 4. Actualizar cliente
            if retiros_gasolina > 0 or retiros_gasoil > 0:
                cursor.execute("""
                    UPDATE clientes 
                    SET litros_disponibles_gasolina = %s,
                        litros_disponibles_gasoil = %s,
                        litros_disponibles = %s
                    WHERE id = %s
                """, (
                    saldo_real_gasolina, 
                    saldo_real_gasoil, 
                    saldo_real_gasolina + saldo_real_gasoil, # Total general (legacy)
                    cliente_id
                ))
                print(f"✅ {cliente['nombre']}: Corregido (Retiros hoy: {retiros_gasolina}L Gasolina, {retiros_gasoil}L Gasoil)")
                clientes_corregidos += 1
        
        # Asegurar que fecha_ultimo_reset esté en hoy
        cursor.execute("UPDATE sistema_config SET fecha_ultimo_reset = CURRENT_DATE WHERE id = 1")
        
        conn.commit()
        print("-" * 60)
        print(f"Resumen: {clientes_corregidos} clientes corregidos de {len(clientes)}.")
        print("La fecha de ultimo reset se ha forzado a HOY.")
        
        conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")
        conn.rollback()

if __name__ == '__main__':
    corregir_saldos()
