"""
Script para diagnosticar por qué los litros se siguen reiniciando en producción.
Este script verifica:
1. Si la columna fecha_ultimo_reset existe
2. Cuál es el valor actual
3. Si los litros de los clientes están siendo modificados
"""

import sqlite3
import sys
from datetime import date

def diagnosticar_reset(db_path='gas_delivery.db'):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("=" * 60)
        print("🔍 DIAGNÓSTICO DE RESET DE LITROS")
        print("=" * 60)
        
        # 1. Verificar estructura de sistema_config
        print("\n1️⃣ Verificando tabla sistema_config...")
        cursor.execute("PRAGMA table_info(sistema_config)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'fecha_ultimo_reset' in column_names:
            print("   ✅ La columna 'fecha_ultimo_reset' EXISTE")
        else:
            print("   ❌ La columna 'fecha_ultimo_reset' NO EXISTE")
            print("   ⚠️  ESTE ES EL PROBLEMA: Ejecuta migrate_add_fecha_reset.py")
            conn.close()
            return False
        
        # 2. Ver valor actual de fecha_ultimo_reset
        print("\n2️⃣ Verificando fecha del último reset...")
        cursor.execute("SELECT fecha_ultimo_reset FROM sistema_config WHERE id = 1")
        result = cursor.fetchone()
        
        if result and result[0]:
            fecha_reset = result[0]
            hoy = date.today().isoformat()
            print(f"   Fecha último reset: {fecha_reset}")
            print(f"   Fecha de hoy: {hoy}")
            
            if fecha_reset == hoy:
                print("   ✅ El reset ya se ejecutó hoy (no debería ejecutarse de nuevo)")
            else:
                print(f"   ⚠️  El reset NO se ha ejecutado hoy (se ejecutará en el próximo inicio)")
        else:
            print("   ❌ No hay fecha de reset registrada")
            print("   ⚠️  Esto causará que el reset se ejecute en cada inicio del servidor")
        
        # 3. Ver estado de algunos clientes
        print("\n3️⃣ Estado de clientes (primeros 3)...")
        cursor.execute("""
            SELECT id, nombre, 
                   litros_disponibles, litros_mes,
                   litros_disponibles_gasolina, litros_mes_gasolina,
                   litros_disponibles_gasoil, litros_mes_gasoil
            FROM clientes 
            WHERE activo = 1 
            LIMIT 3
        """)
        
        clientes = cursor.fetchall()
        for cliente in clientes:
            print(f"\n   Cliente: {cliente[1]} (ID: {cliente[0]})")
            print(f"      Disponibles (legacy): {cliente[2]} / Mes: {cliente[3]}")
            print(f"      Gasolina: {cliente[4]} / Mes: {cliente[5]}")
            print(f"      Gasoil: {cliente[6]} / Mes: {cliente[7]}")
            
            # Verificar si están en su máximo (recién reseteados)
            if cliente[4] == cliente[5] and cliente[6] == cliente[7]:
                print(f"      ⚠️  Este cliente tiene litros AL MÁXIMO (posible reset reciente)")
            elif cliente[4] < cliente[5] or cliente[6] < cliente[7]:
                print(f"      ✅ Este cliente tiene litros consumidos (no reseteado)")
        
        # 4. Ver retiros recientes
        print("\n4️⃣ Retiros recientes (últimos 5)...")
        cursor.execute("""
            SELECT r.id, c.nombre, r.litros, r.tipo_combustible, r.fecha
            FROM retiros r
            JOIN clientes c ON r.cliente_id = c.id
            ORDER BY r.fecha DESC
            LIMIT 5
        """)
        
        retiros = cursor.fetchall()
        if retiros:
            for retiro in retiros:
                print(f"   - {retiro[1]}: {retiro[2]}L de {retiro[3]} ({retiro[4]})")
        else:
            print("   ⚠️  No hay retiros registrados")
        
        conn.close()
        
        print("\n" + "=" * 60)
        print("✅ Diagnóstico completado")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ Error durante el diagnóstico: {e}")
        return False

if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'gas_delivery.db'
    print(f"📊 Base de datos: {db_path}\n")
    
    diagnosticar_reset(db_path)
