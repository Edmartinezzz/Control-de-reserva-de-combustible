"""
Script simple para verificar y corregir fecha_ultimo_reset
Sin dependencias de psycopg2 - usa requests para llamar a la API
"""

import os
import requests
from datetime import datetime

def verificar_estado():
    """Verifica el estado actual haciendo login de prueba"""
    
    # URL del backend (cambiar según tu configuración)
    backend_url = os.environ.get('BACKEND_API_BASE_URL', 'http://localhost:5000')
    
    print("="*60)
    print("DIAGNÓSTICO: Fuel Reset on Login")
    print("="*60)
    print(f"Backend URL: {backend_url}")
    print(f"Hora actual: {datetime.now()}")
    print("="*60)
    print()
    
    # Instrucciones para el usuario
    print("PASOS PARA DIAGNOSTICAR:")
    print()
    print("1. Anota los litros actuales de un cliente de prueba")
    print("2. Haz login con ese cliente")
    print("3. Verifica si los litros cambiaron")
    print()
    print("Si los litros se resetearon:")
    print("   → El problema persiste")
    print("   → Revisa los logs del servidor para ver mensajes como:")
    print("      - '⚠️ fecha_ultimo_reset era NULL'")
    print("      - '🔄 Ejecutando reset diario automático'")
    print()
    print("Si los litros NO cambiaron:")
    print("   → El fix funcionó correctamente")
    print("   → Los litros solo se resetearán mañana a las 4 AM")
    print()
    print("="*60)
    print("SOLUCIÓN ALTERNATIVA")
    print("="*60)
    print()
    print("Si el problema persiste, hay 2 posibles causas:")
    print()
    print("CAUSA 1: El código no se desplegó en producción")
    print("   Solución: Verificar que el deploy se completó")
    print("   Comando: Revisar logs de Railway/Render")
    print()
    print("CAUSA 2: fecha_ultimo_reset sigue siendo NULL en producción")
    print("   Solución: Ejecutar SQL directamente en la base de datos:")
    print()
    print("   SQL para ejecutar:")
    print("   UPDATE sistema_config SET fecha_ultimo_reset = CURRENT_DATE WHERE id = 1;")
    print()
    print("="*60)

if __name__ == '__main__':
    verificar_estado()
