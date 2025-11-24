import sqlite3
import sys
from datetime import date

"""
Script para agregar la columna fecha_ultimo_reset a la tabla sistema_config
en la base de datos de producción.

Esto soluciona el problema de que los litros se reinician en cada login.
"""

def migrate_database(db_path='gas_delivery.db'):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔍 Verificando estructura actual de sistema_config...")
        cursor.execute("PRAGMA table_info(sistema_config)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        print(f"   Columnas actuales: {', '.join(column_names)}")
        
        if 'fecha_ultimo_reset' in column_names:
            print("✅ La columna 'fecha_ultimo_reset' ya existe.")
        else:
            print("⚠️  La columna 'fecha_ultimo_reset' NO existe. Agregando...")
            
            # Agregar la columna
            cursor.execute("ALTER TABLE sistema_config ADD COLUMN fecha_ultimo_reset TEXT")
            
            # Establecer valor inicial a la fecha de hoy
            today = date.today().isoformat()
            cursor.execute("UPDATE sistema_config SET fecha_ultimo_reset = ? WHERE id = 1", [today])
            
            conn.commit()
            print(f"✅ Columna agregada exitosamente. Valor inicial: {today}")
        
        # Verificar el resultado
        print("\n📊 Estado actual de sistema_config:")
        cursor.execute("SELECT * FROM sistema_config WHERE id = 1")
        config = cursor.fetchone()
        if config:
            cursor.execute("PRAGMA table_info(sistema_config)")
            columns = cursor.fetchall()
            for i, col in enumerate(columns):
                value = config[i] if i < len(config) else 'NULL'
                print(f"   {col[1]}: {value}")
        
        conn.close()
        print("\n✅ Migración completada exitosamente!")
        return True
        
    except Exception as e:
        print(f"\n❌ Error durante la migración: {e}")
        return False

if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'gas_delivery.db'
    print(f"🚀 Iniciando migración en: {db_path}\n")
    
    success = migrate_database(db_path)
    sys.exit(0 if success else 1)
