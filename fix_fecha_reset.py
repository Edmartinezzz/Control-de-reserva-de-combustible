"""
Script para verificar y corregir el estado de fecha_ultimo_reset en la base de datos
Este script ayuda a diagnosticar y solucionar el problema de reset de litros en cada login
"""

import os
import sys
import urllib.parse
from datetime import datetime, timedelta

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("❌ Error: psycopg2 no está instalado")
    print("Instala con: pip install psycopg2-binary")
    sys.exit(1)

def main():
    # Obtener DATABASE_URL del entorno
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("❌ Error: DATABASE_URL no está configurada")
        print("Configura la variable de entorno DATABASE_URL con la URL de tu base de datos PostgreSQL")
        sys.exit(1)
    
    # Parse the URL
    result = urllib.parse.urlparse(database_url)
    
    try:
        # Conectar a la base de datos
        conn = psycopg2.connect(
            database=result.path[1:],
            user=result.username,
            password=result.password,
            host=result.hostname,
            port=result.port,
            cursor_factory=psycopg2.extras.RealDictCursor
        )
        conn.set_session(autocommit=False)
        cursor = conn.cursor()
        
        print("✅ Conectado a la base de datos PostgreSQL")
        print()
        
        # Verificar estado actual de sistema_config
        print("📊 Estado actual de sistema_config:")
        cursor.execute('SELECT id, retiros_bloqueados, fecha_ultimo_reset FROM sistema_config WHERE id = 1')
        config = cursor.fetchone()
        
        if not config:
            print("⚠️ No existe registro en sistema_config con id = 1")
            print("Creando registro...")
            cursor.execute('''
                INSERT INTO sistema_config (id, retiros_bloqueados, fecha_ultimo_reset) 
                VALUES (1, 0, CURRENT_DATE)
            ''')
            conn.commit()
            print("✅ Registro creado con fecha_ultimo_reset = hoy")
        else:
            print(f"   ID: {config['id']}")
            print(f"   Retiros bloqueados: {config['retiros_bloqueados']}")
            print(f"   Fecha último reset: {config['fecha_ultimo_reset']}")
            
            if config['fecha_ultimo_reset'] is None:
                print()
                print("⚠️ PROBLEMA DETECTADO: fecha_ultimo_reset es NULL")
                print("   Esto causa que los litros se reseteen en cada login")
                print()
                
                # Preguntar si desea corregir
                respuesta = input("¿Deseas corregir esto estableciendo fecha_ultimo_reset a hoy? (s/n): ")
                if respuesta.lower() == 's':
                    cursor.execute('UPDATE sistema_config SET fecha_ultimo_reset = CURRENT_DATE WHERE id = 1')
                    conn.commit()
                    print("✅ fecha_ultimo_reset actualizada a hoy")
                    print("   Los litros ya NO se resetearán en cada login")
                else:
                    print("❌ No se realizaron cambios")
            else:
                print()
                print("✅ fecha_ultimo_reset está configurada correctamente")
        
        print()
        print("📊 Verificando algunos clientes:")
        cursor.execute('''
            SELECT id, nombre, cedula, 
                   litros_disponibles_gasolina, litros_mes_gasolina,
                   litros_disponibles_gasoil, litros_mes_gasoil
            FROM clientes 
            WHERE activo = TRUE 
            LIMIT 5
        ''')
        
        clientes = cursor.fetchall()
        for cliente in clientes:
            print(f"\n   Cliente: {cliente['nombre']} (Cédula: {cliente['cedula']})")
            print(f"   Gasolina: {cliente['litros_disponibles_gasolina']:.2f} / {cliente['litros_mes_gasolina']:.2f} litros")
            print(f"   Gasoil: {cliente['litros_disponibles_gasoil']:.2f} / {cliente['litros_mes_gasoil']:.2f} litros")
        
        cursor.close()
        conn.close()
        
        print()
        print("✅ Verificación completada")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
