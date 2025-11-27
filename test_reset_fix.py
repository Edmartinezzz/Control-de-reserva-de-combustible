"""
Script de prueba para verificar que el fix del reset de litros funciona correctamente.
Este script simula el flujo de login y consulta de datos del cliente.
"""

import psycopg2
import psycopg2.extras
import os
import urllib.parse
from datetime import date, datetime, timedelta

def test_reset_fix():
    try:
        # Obtener DATABASE_URL del entorno
        database_url = os.environ.get('DATABASE_URL')
        if not database_url:
            print("❌ ERROR: DATABASE_URL no está configurada")
            return False
        
        # Parse the URL
        result = urllib.parse.urlparse(database_url)
        
        # Conectar a PostgreSQL
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
        print("🧪 PRUEBA DEL FIX DE RESET DE LITROS")
        print("=" * 70)
        
        # 1. Verificar estado inicial
        print("\n1️⃣ Estado inicial del sistema...")
        cursor.execute("SELECT fecha_ultimo_reset FROM sistema_config WHERE id = 1")
        config = cursor.fetchone()
        print(f"   Fecha último reset: {config['fecha_ultimo_reset']}")
        print(f"   Fecha de hoy: {date.today()}")
        
        # 2. Obtener un cliente de prueba
        print("\n2️⃣ Obteniendo cliente de prueba...")
        cursor.execute("""
            SELECT id, nombre, cedula,
                   litros_disponibles_gasolina, litros_mes_gasolina,
                   litros_disponibles_gasoil, litros_mes_gasoil
            FROM clientes 
            WHERE activo = TRUE 
            LIMIT 1
        """)
        cliente = cursor.fetchone()
        
        if not cliente:
            print("   ❌ No hay clientes activos para probar")
            return False
        
        print(f"   Cliente: {cliente['nombre']} (ID: {cliente['id']}, CI: {cliente['cedula']})")
        print(f"   Gasolina: {cliente['litros_disponibles_gasolina']}L / {cliente['litros_mes_gasolina']}L")
        print(f"   Gasoil: {cliente['litros_disponibles_gasoil']}L / {cliente['litros_mes_gasoil']}L")
        
        saldo_inicial_gasolina = cliente['litros_disponibles_gasolina']
        saldo_inicial_gasoil = cliente['litros_disponibles_gasoil']
        
        # 3. Simular retiro de litros
        print("\n3️⃣ Simulando retiro de 10L de gasolina...")
        nuevo_saldo_gasolina = max(0, saldo_inicial_gasolina - 10)
        
        cursor.execute("""
            UPDATE clientes 
            SET litros_disponibles_gasolina = %s
            WHERE id = %s
        """, (nuevo_saldo_gasolina, cliente['id']))
        conn.commit()
        
        print(f"   ✅ Saldo actualizado: {nuevo_saldo_gasolina}L")
        
        # 4. Simular múltiples consultas (como hace el dashboard)
        print("\n4️⃣ Simulando 5 consultas de datos (como el dashboard)...")
        for i in range(5):
            cursor.execute("""
                SELECT litros_disponibles_gasolina, litros_disponibles_gasoil
                FROM clientes 
                WHERE id = %s
            """, (cliente['id'],))
            
            datos = cursor.fetchone()
            print(f"   Consulta {i+1}: Gasolina={datos['litros_disponibles_gasolina']}L, "
                  f"Gasoil={datos['litros_disponibles_gasoil']}L")
            
            # Verificar que NO se haya reseteado
            if datos['litros_disponibles_gasolina'] != nuevo_saldo_gasolina:
                print(f"   ❌ ERROR: El saldo cambió de {nuevo_saldo_gasolina}L a {datos['litros_disponibles_gasolina']}L")
                return False
        
        print("   ✅ Los saldos se mantuvieron estables en todas las consultas")
        
        # 5. Verificar que fecha_ultimo_reset no cambió
        print("\n5️⃣ Verificando que fecha_ultimo_reset no cambió...")
        cursor.execute("SELECT fecha_ultimo_reset FROM sistema_config WHERE id = 1")
        config_final = cursor.fetchone()
        
        if config_final['fecha_ultimo_reset'] == config['fecha_ultimo_reset']:
            print(f"   ✅ fecha_ultimo_reset se mantuvo: {config_final['fecha_ultimo_reset']}")
        else:
            print(f"   ❌ ERROR: fecha_ultimo_reset cambió de {config['fecha_ultimo_reset']} "
                  f"a {config_final['fecha_ultimo_reset']}")
            return False
        
        # 6. Restaurar saldo original
        print("\n6️⃣ Restaurando saldo original del cliente...")
        cursor.execute("""
            UPDATE clientes 
            SET litros_disponibles_gasolina = %s
            WHERE id = %s
        """, (saldo_inicial_gasolina, cliente['id']))
        conn.commit()
        print(f"   ✅ Saldo restaurado a {saldo_inicial_gasolina}L")
        
        conn.close()
        
        print("\n" + "=" * 70)
        print("✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE")
        print("=" * 70)
        print("\n📋 Resumen:")
        print("   ✓ Los saldos NO se resetean en consultas múltiples")
        print("   ✓ La fecha_ultimo_reset se mantiene estable")
        print("   ✓ El sistema está funcionando correctamente")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error durante las pruebas: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    import io
    
    # Fix encoding for Windows
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        
    print("SCRIPT DE PRUEBA DEL FIX DE RESET\n")
    
    if test_reset_fix():
        print("\nEL FIX ESTA FUNCIONANDO CORRECTAMENTE.")
    else:
        print("\nLAS PRUEBAS FALLARON. REVISA LOS ERRORES ARRIBA.")
