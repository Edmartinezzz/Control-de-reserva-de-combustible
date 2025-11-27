"""
Script de prueba para simular el comportamiento de verificar_reset_diario
y entender por qué los litros se siguen reseteando
"""

from datetime import datetime, timedelta

def simular_verificar_reset_diario(ultimo_reset_str, hora_actual=None):
    """
    Simula la función verificar_reset_diario para debugging
    
    Args:
        ultimo_reset_str: String con la fecha del último reset (formato: 'YYYY-MM-DD') o None
        hora_actual: Hora actual en formato HH:MM (opcional, por defecto usa hora actual)
    """
    # Hora actual en Venezuela (UTC-4)
    if hora_actual:
        hora, minuto = map(int, hora_actual.split(':'))
        venezuela_now = datetime.now().replace(hour=hora, minute=minuto)
    else:
        utc_now = datetime.utcnow()
        venezuela_now = utc_now - timedelta(hours=4)
    
    hoy_venezuela = venezuela_now.date()
    
    print(f"\n{'='*60}")
    print(f"SIMULACIÓN DE verificar_reset_diario()")
    print(f"{'='*60}")
    print(f"Fecha/Hora actual (Venezuela): {venezuela_now}")
    print(f"Hoy (Venezuela): {hoy_venezuela}")
    print(f"ultimo_reset en DB: {ultimo_reset_str}")
    print(f"{'='*60}\n")
    
    # Si fecha_ultimo_reset es NULL
    if ultimo_reset_str is None:
        print("⚠️ fecha_ultimo_reset es NULL")
        print(f"   → Inicializando a hoy: {hoy_venezuela}")
        print("   → RETURN (no reset)")
        print("\n✅ RESULTADO: NO SE RESETEAN LOS LITROS")
        return False
    
    # Convertir string a date
    ultimo_reset = datetime.strptime(ultimo_reset_str, '%Y-%m-%d').date()
    print(f"ultimo_reset parseado: {ultimo_reset}")
    
    # Si ya se reseteó hoy
    if ultimo_reset >= hoy_venezuela:
        print(f"\n✅ ultimo_reset ({ultimo_reset}) >= hoy ({hoy_venezuela})")
        print(f"   → Reset ya ejecutado hoy, no se requiere acción")
        print("   → RETURN (no reset)")
        print("\n✅ RESULTADO: NO SE RESETEAN LOS LITROS")
        return False
    
    print(f"\n⚠️ ultimo_reset ({ultimo_reset}) < hoy ({hoy_venezuela})")
    print(f"   → Es un nuevo día, verificando hora...")
    
    # Solo resetear si es después de las 4:00 AM
    if venezuela_now.hour >= 4:
        print(f"\n🔄 Hora actual: {venezuela_now.hour}:{venezuela_now.minute:02d} >= 4:00 AM")
        print(f"   → EJECUTANDO RESET DIARIO")
        print(f"   → UPDATE clientes SET litros_disponibles = litros_mes")
        print(f"   → UPDATE sistema_config SET fecha_ultimo_reset = {hoy_venezuela}")
        print("\n❌ RESULTADO: SE RESETEAN LOS LITROS")
        return True
    else:
        print(f"\n⏰ Hora actual: {venezuela_now.hour}:{venezuela_now.minute:02d} < 4:00 AM")
        print(f"   → Esperando hasta las 4:00 AM para resetear")
        print("   → RETURN (no reset todavía)")
        print("\n✅ RESULTADO: NO SE RESETEAN LOS LITROS (aún)")
        return False

# Casos de prueba
print("\n" + "="*60)
print("CASOS DE PRUEBA")
print("="*60)

print("\n\n### CASO 1: Primera vez (fecha_ultimo_reset es NULL) ###")
simular_verificar_reset_diario(None, "10:00")

print("\n\n### CASO 2: Ya se reseteó hoy ###")
hoy = datetime.now().date().strftime('%Y-%m-%d')
simular_verificar_reset_diario(hoy, "10:00")

print("\n\n### CASO 3: Último reset fue ayer, hora actual 10:00 AM ###")
ayer = (datetime.now().date() - timedelta(days=1)).strftime('%Y-%m-%d')
simular_verificar_reset_diario(ayer, "10:00")

print("\n\n### CASO 4: Último reset fue ayer, hora actual 2:00 AM ###")
simular_verificar_reset_diario(ayer, "02:00")

print("\n\n### CASO 5: Último reset fue hace 3 días ###")
hace_3_dias = (datetime.now().date() - timedelta(days=3)).strftime('%Y-%m-%d')
simular_verificar_reset_diario(hace_3_dias, "10:00")

print("\n\n" + "="*60)
print("CONCLUSIÓN")
print("="*60)
print("""
El reset SOLO ocurre cuando:
1. ultimo_reset < hoy (es un nuevo día)
2. Y la hora actual >= 4:00 AM

Si fecha_ultimo_reset es NULL o ya se reseteó hoy, NO se resetea.

Si los litros se están reseteando en cada login, significa que:
- fecha_ultimo_reset está en NULL cada vez, O
- fecha_ultimo_reset está siendo modificada a una fecha anterior, O
- Hay otro código que está reseteando los litros
""")
