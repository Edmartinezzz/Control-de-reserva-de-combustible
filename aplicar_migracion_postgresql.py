"""
Script para aplicar la migración de fecha_ultimo_reset en PostgreSQL.
Este script ejecuta el archivo SQL fix_postgresql_fecha_reset.sql
"""

import psycopg2
import psycopg2.extras
import os
import urllib.parse

def aplicar_migracion():
    try:
        # Obtener DATABASE_URL del entorno
        database_url = os.environ.get('DATABASE_URL')
        if not database_url:
            print("❌ ERROR: DATABASE_URL no está configurada en las variables de entorno")
            print("   Configúrala con: export DATABASE_URL='tu_url_de_postgresql'")
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
        
        print("=" * 60)
        print("🔧 APLICANDO MIGRACIÓN: fecha_ultimo_reset")
        print("=" * 60)
        
        # Leer el archivo SQL
        print("\n📄 Leyendo archivo SQL...")
        with open('fix_postgresql_fecha_reset.sql', 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print("✅ Archivo SQL cargado correctamente\n")
        
        # Ejecutar el SQL
        print("🔄 Ejecutando migración...")
        cursor.execute(sql_content)
        
        # Obtener resultados de la verificación
        results = cursor.fetchall()
        
        conn.commit()
        
        print("\n✅ MIGRACIÓN APLICADA EXITOSAMENTE\n")
        
        # Mostrar resultados
        if results:
            print("📊 Estado de sistema_config:")
            for row in results:
                print(f"   ID: {row['id']}")
                print(f"   Retiros bloqueados: {row['retiros_bloqueados']}")
                print(f"   Fecha último reset: {row['fecha_ultimo_reset']}")
                print(f"   Fecha de hoy: {row['today']}")
                print(f"   Estado: {row['status']}")
        
        conn.close()
        
        print("\n" + "=" * 60)
        print("✅ Proceso completado")
        print("=" * 60)
        return True
        
    except FileNotFoundError:
        print("\n❌ ERROR: No se encontró el archivo fix_postgresql_fecha_reset.sql")
        print("   Asegúrate de ejecutar este script desde el directorio del proyecto")
        return False
    except Exception as e:
        print(f"\n❌ Error durante la migración: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 Aplicador de Migración PostgreSQL\n")
    
    if aplicar_migracion():
        print("\n✅ La migración se aplicó correctamente.")
        print("   Ahora puedes reiniciar el servidor para que los cambios surtan efecto.")
    else:
        print("\n❌ La migración falló. Revisa los errores arriba.")
