"""
Script para ejecutar SQL en la base de datos de Render/Railway
Version sin emojis para evitar problemas de encoding
"""

import os
import sys

try:
    import psycopg2
    import psycopg2.extras
    import urllib.parse
except ImportError:
    print("ERROR: psycopg2 no esta instalado")
    print("\nPara instalar, ejecuta:")
    print("pip install psycopg2-binary")
    sys.exit(1)

def ejecutar_fix():
    """Ejecuta el SQL para corregir fecha_ultimo_reset"""
    
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL no esta configurada")
        sys.exit(1)
    
    print("="*60)
    print("EJECUTANDO FIX: Inicializar fecha_ultimo_reset")
    print("="*60)
    print()
    
    try:
        # Parse the URL
        result = urllib.parse.urlparse(database_url)
        
        # Conectar a la base de datos
        print("Conectando a la base de datos...")
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
        
        print("OK - Conectado exitosamente")
        print()
        
        # Verificar estado actual
        print("Verificando estado actual...")
        cursor.execute('SELECT id, fecha_ultimo_reset, retiros_bloqueados FROM sistema_config WHERE id = 1')
        config = cursor.fetchone()
        
        if not config:
            print("ADVERTENCIA: No existe registro en sistema_config con id = 1")
            print("Creando registro...")
            cursor.execute('''
                INSERT INTO sistema_config (id, retiros_bloqueados, fecha_ultimo_reset) 
                VALUES (1, 0, CURRENT_DATE)
            ''')
            conn.commit()
            print("OK - Registro creado con fecha_ultimo_reset = hoy")
        else:
            print(f"ID: {config['id']}")
            print(f"Retiros bloqueados: {config['retiros_bloqueados']}")
            print(f"Fecha ultimo reset: {config['fecha_ultimo_reset']}")
            print()
            
            if config['fecha_ultimo_reset'] is None:
                print("PROBLEMA DETECTADO: fecha_ultimo_reset es NULL")
                print()
                print("Ejecutando fix...")
                cursor.execute('UPDATE sistema_config SET fecha_ultimo_reset = CURRENT_DATE WHERE id = 1')
                conn.commit()
                print("OK - fecha_ultimo_reset actualizada a hoy")
                print()
                print("*** FIX APLICADO EXITOSAMENTE ***")
                print()
                print("Los litros ya NO se resetearan en cada login.")
                print("Solo se resetearan una vez al dia a las 4:00 AM.")
            else:
                print("OK - fecha_ultimo_reset ya esta configurada correctamente")
                print()
                print("Si los litros aun se resetean en cada login,")
                print("verifica que el codigo del backend este actualizado.")
        
        print()
        print("="*60)
        print("VERIFICACION")
        print("="*60)
        print()
        print("Para verificar que el fix funciono:")
        print("1. Anota los litros actuales de un cliente")
        print("2. Haz login con ese cliente")
        print("3. Verifica que los litros NO cambiaron")
        print("4. Haz login nuevamente")
        print("5. Los litros deben permanecer iguales")
        print()
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"ERROR: {e}")
        print()
        print("Verifica que:")
        print("1. DATABASE_URL este correcta")
        print("2. Tengas acceso a la base de datos")
        print("3. La base de datos este en linea")
        sys.exit(1)

if __name__ == '__main__':
    ejecutar_fix()
