import sqlite3
import sys

db_path = 'gas_delivery.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Verificar estructura de sistema_config
    print("=== Estructura de sistema_config ===")
    cursor.execute("PRAGMA table_info(sistema_config)")
    columns = cursor.fetchall()
    for col in columns:
        print(f"  {col[1]} ({col[2]})")
    
    print("\n=== Datos de sistema_config ===")
    cursor.execute("SELECT * FROM sistema_config WHERE id = 1")
    config = cursor.fetchone()
    if config:
        print(f"  Datos: {config}")
    else:
        print("  No hay registro con id=1")
    
    # Verificar un cliente de ejemplo
    print("\n=== Cliente de ejemplo (primero en la lista) ===")
    cursor.execute("SELECT id, nombre, litros_disponibles, litros_disponibles_gasolina, litros_disponibles_gasoil, litros_mes, litros_mes_gasolina, litros_mes_gasoil FROM clientes WHERE activo = 1 LIMIT 1")
    cliente = cursor.fetchone()
    if cliente:
        print(f"  ID: {cliente[0]}")
        print(f"  Nombre: {cliente[1]}")
        print(f"  Litros disponibles (legacy): {cliente[2]}")
        print(f"  Litros disponibles gasolina: {cliente[3]}")
        print(f"  Litros disponibles gasoil: {cliente[4]}")
        print(f"  Litros mes (legacy): {cliente[5]}")
        print(f"  Litros mes gasolina: {cliente[6]}")
        print(f"  Litros mes gasoil: {cliente[7]}")
    else:
        print("  No hay clientes activos")
    
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
