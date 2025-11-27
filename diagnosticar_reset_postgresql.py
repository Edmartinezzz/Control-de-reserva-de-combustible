"""
Script para diagnosticar por qué los litros se siguen reiniciando en producción PostgreSQL.
Este script verifica:
1. Si la columna fecha_ultimo_reset existe
2. Cuál es el valor actual
3. Si los litros de los clientes están siendo modificados
"""

import psycopg2
import psycopg2.extras
import os
import urllib.parse
from datetime import date

def diagnosticar_reset_postgresql():
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
        print("🔍 DIAGNÓSTICO DE RESET DE LITROS (PostgreSQL)")
        print("=" * 60)
        
        # 1. Verificar estructura de sistema_config
        print("\n1️⃣ Verificando tabla sistema_config...")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'sistema_config'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        
        column_names = [col['column_name'] for col in columns]
        
        print(f"   Columnas encontradas: {', '.join(column_names)}")
        
        if 'fecha_ultimo_reset' in column_names:
            print("   ✅ La columna 'fecha_ultimo_reset' EXISTE")
            # Mostrar tipo de dato
            fecha_col = next(col for col in columns if col['column_name'] == 'fecha_ultimo_reset')
            print(f"      Tipo: {fecha_col['data_type']}, Nullable: {fecha_col['is_nullable']}")
        else:
            print("   ❌ La columna 'fecha_ultimo_reset' NO EXISTE")
            print("   ⚠️  ESTE ES EL PROBLEMA: Ejecuta fix_postgresql_fecha_reset.sql")
            conn.close()
            return False
        
        # 2. Ver valor actual de fecha_ultimo_reset
        print("\n2️⃣ Verificando fecha del último reset...")
        cursor.execute("SELECT fecha_ultimo_reset, retiros_bloqueados FROM sistema_config WHERE id = 1")
        result = cursor.fetchone()
        
        if result:
            fecha_reset = result['fecha_ultimo_reset']
            hoy = date.today()
            print(f"   Fecha último reset: {fecha_reset}")
            print(f"   Fecha de hoy: {hoy}")
            print(f"   Retiros bloqueados: {result['retiros_bloqueados']}")
            
            if fecha_reset:
                # Convertir a date si es datetime
                if hasattr(fecha_reset, 'date'):
                    fecha_reset = fecha_reset.date()
                
                if fecha_reset == hoy:
                    print("   ✅ El reset ya se ejecutó hoy (no debería ejecutarse de nuevo)")
                elif fecha_reset < hoy:
                    print(f"   ⚠️  El reset NO se ha ejecutado hoy (última vez: {fecha_reset})")
                    print(f"      Se ejecutará en el próximo login después de las 4:00 AM")
                else:
                    print(f"   ⚠️  ADVERTENCIA: fecha_ultimo_reset está en el futuro!")
            else:
                print("   ❌ fecha_ultimo_reset es NULL")
                print("   ⚠️  Esto causará que el reset se ejecute en cada inicio del servidor")
        else:
            print("   ❌ No se encontró registro en sistema_config con id = 1")
        
        # 3. Ver estado de algunos clientes
        print("\n3️⃣ Estado de clientes (primeros 5)...")
        cursor.execute("""
            SELECT id, nombre, cedula,
                   litros_disponibles, litros_mes,
                   litros_disponibles_gasolina, litros_mes_gasolina,
                   litros_disponibles_gasoil, litros_mes_gasoil
            FROM clientes 
            WHERE activo = TRUE 
            ORDER BY id
            LIMIT 5
        """)
        
        clientes = cursor.fetchall()
        if clientes:
            for cliente in clientes:
                print(f"\n   Cliente: {cliente['nombre']} (ID: {cliente['id']}, CI: {cliente['cedula']})")
                print(f"      Gasolina: {cliente['litros_disponibles_gasolina']}L disponibles / {cliente['litros_mes_gasolina']}L mes")
                print(f"      Gasoil: {cliente['litros_disponibles_gasoil']}L disponibles / {cliente['litros_mes_gasoil']}L mes")
                
                # Verificar si están en su máximo (recién reseteados)
                gasolina_max = cliente['litros_disponibles_gasolina'] == cliente['litros_mes_gasolina']
                gasoil_max = cliente['litros_disponibles_gasoil'] == cliente['litros_mes_gasoil']
                
                if gasolina_max and gasoil_max:
                    print(f"      ⚠️  Este cliente tiene litros AL MÁXIMO (posible reset reciente)")
                elif cliente['litros_disponibles_gasolina'] < cliente['litros_mes_gasolina'] or \
                     cliente['litros_disponibles_gasoil'] < cliente['litros_mes_gasoil']:
                    print(f"      ✅ Este cliente tiene litros consumidos (no reseteado)")
        else:
            print("   ⚠️  No hay clientes activos en la base de datos")
        
        # 4. Ver retiros recientes
        print("\n4️⃣ Retiros/Agendamientos recientes (últimos 5)...")
        cursor.execute("""
            SELECT a.id, c.nombre, a.litros, a.tipo_combustible, a.fecha_agendada, a.estado
            FROM agendamientos a
            JOIN clientes c ON a.cliente_id = c.id
            ORDER BY a.fecha_creacion DESC
            LIMIT 5
        """)
        
        agendamientos = cursor.fetchall()
        if agendamientos:
            for ag in agendamientos:
                print(f"   - {ag['nombre']}: {ag['litros']}L de {ag['tipo_combustible']} "
                      f"(Fecha: {ag['fecha_agendada']}, Estado: {ag['estado']})")
        else:
            print("   ⚠️  No hay agendamientos registrados")
        
        # 5. Verificar timezone de la base de datos
        print("\n5️⃣ Verificando configuración de timezone...")
        cursor.execute("SHOW timezone")
        tz = cursor.fetchone()
        # Handle different return formats
        timezone_val = tz['TimeZone'] if 'TimeZone' in tz else tz.get('timezone', 'Unknown')
        print(f"   Timezone de PostgreSQL: {timezone_val}")
        
        cursor.execute("SELECT NOW() as now, CURRENT_DATE as today")
        time_info = cursor.fetchone()
        print(f"   Hora actual del servidor DB: {time_info['now']}")
        print(f"   Fecha actual del servidor DB: {time_info['today']}")
        
        conn.close()
        
        print("\n" + "=" * 60)
        print("✅ Diagnóstico completado")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ Error durante el diagnóstico: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    import io
    
    # Fix encoding for Windows
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    
    print("DIAGNOSTICO DE RESET DE LITROS - PostgreSQL\n")
    
    diagnosticar_reset_postgresql()
