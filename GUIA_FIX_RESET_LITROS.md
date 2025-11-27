# Guía de Aplicación del Fix - Reset de Litros

## 🎯 Problema Resuelto

Se ha corregido el bug crítico donde los saldos de litros de los clientes se reseteaban cada vez que iniciaban sesión en su dashboard. 

**Causa raíz**: La función `verificar_reset_diario()` se estaba ejecutando cada 60 segundos cuando el dashboard obtenía datos actualizados del cliente, en lugar de ejecutarse solo una vez al día a las 4:00 AM.

**Solución**: Se removió la llamada a `verificar_reset_diario()` del endpoint `/api/clientes/<id>`, dejándola solo en el login del cliente.

---

## 📋 Cambios Realizados

### 1. Archivos Modificados

- **`server.py`**:
  - ✅ Removida llamada a `verificar_reset_diario()` del endpoint `obtener_cliente()` (línea 582)
  - ✅ Mejorada función `verificar_reset_diario()` con mejor logging y documentación
  - ✅ La función ahora solo se ejecuta en el login del cliente

### 2. Archivos Nuevos Creados

- **`diagnosticar_reset_postgresql.py`**: Script para diagnosticar el estado de la base de datos
- **`fix_postgresql_fecha_reset.sql`**: Migración SQL para PostgreSQL
- **`aplicar_migracion_postgresql.py`**: Script Python para aplicar la migración
- **`test_reset_fix.py`**: Script de pruebas para verificar que el fix funciona

---

## 🚀 Pasos para Aplicar el Fix

### Opción A: Aplicación Local (Desarrollo)

1. **Verificar el estado actual**:
   ```bash
   python diagnosticar_reset_postgresql.py
   ```

2. **Aplicar la migración** (si `fecha_ultimo_reset` no existe o es NULL):
   ```bash
   python aplicar_migracion_postgresql.py
   ```

3. **Ejecutar pruebas**:
   ```bash
   python test_reset_fix.py
   ```

4. **Reiniciar el servidor**:
   ```bash
   # Detener el servidor actual (Ctrl+C)
   python server.py
   ```

### Opción B: Aplicación en Producción (Railway/Render)

#### Para Railway:

1. **Conectar a la base de datos**:
   ```bash
   # Obtener la DATABASE_URL desde Railway dashboard
   # Variables → DATABASE_URL
   ```

2. **Aplicar migración SQL directamente**:
   ```bash
   # Desde Railway dashboard → Database → Query
   # Copiar y pegar el contenido de fix_postgresql_fecha_reset.sql
   ```

   O usando psql:
   ```bash
   psql $DATABASE_URL < fix_postgresql_fecha_reset.sql
   ```

3. **Hacer commit y push de los cambios**:
   ```bash
   git add server.py
   git commit -m "Fix: Prevent balance reset on every login"
   git push origin main
   ```

4. **Railway desplegará automáticamente** los cambios.

#### Para Render:

Similar a Railway, pero usando el dashboard de Render para ejecutar el SQL.

---

## ✅ Verificación Post-Despliegue

### 1. Verificar Logs del Servidor

Busca estos mensajes en los logs:

```
✅ Reset ya ejecutado hoy (2025-11-27), no se requiere acción
```

O si es la primera vez:

```
⚠️ fecha_ultimo_reset era NULL, inicializando a hoy: 2025-11-27
✅ fecha_ultimo_reset inicializada correctamente
```

### 2. Prueba Manual

1. **Login como cliente**:
   - Inicia sesión con una cédula de cliente
   - Anota el saldo actual (ej: 80L de gasolina)

2. **Esperar 2-3 minutos**:
   - El dashboard hace fetch cada 60 segundos
   - El saldo debe mantenerse en 80L

3. **Cerrar sesión y volver a entrar**:
   - El saldo debe seguir siendo 80L
   - NO debe resetearse a 120L (o el cupo mensual)

4. **Hacer un retiro**:
   - Agenda un retiro de 20L
   - El saldo debe bajar a 60L
   - Cierra sesión y vuelve a entrar
   - El saldo debe seguir siendo 60L

### 3. Verificar Reset Diario

El reset diario debe ocurrir **solo a las 4:00 AM Venezuela time**.

Para probarlo:

1. **Simular día anterior**:
   ```sql
   UPDATE sistema_config 
   SET fecha_ultimo_reset = CURRENT_DATE - INTERVAL '1 day'
   WHERE id = 1;
   ```

2. **Hacer login después de las 4:00 AM**:
   - Los saldos deben resetearse a los cupos mensuales
   - Verás en los logs:
     ```
     🔄 EJECUTANDO RESET DIARIO AUTOMÁTICO
     ✅ RESET DIARIO COMPLETADO EXITOSAMENTE
     ```

---

## 🔧 Troubleshooting

### Problema: "fecha_ultimo_reset es NULL"

**Solución**: Ejecuta la migración:
```bash
python aplicar_migracion_postgresql.py
```

### Problema: "Los saldos aún se resetean"

**Verificar**:
1. ¿Se aplicaron los cambios en `server.py`?
2. ¿Se reinició el servidor después de los cambios?
3. ¿La columna `fecha_ultimo_reset` existe y tiene un valor?

**Diagnóstico**:
```bash
python diagnosticar_reset_postgresql.py
```

### Problema: "El reset no ocurre a las 4:00 AM"

**Causa**: El servidor necesita estar ejecutándose a las 4:00 AM para que el reset se active.

**Soluciones**:
1. **Opción 1**: Asegurarse de que el servidor esté siempre corriendo (Railway/Render hacen esto automáticamente)
2. **Opción 2**: Configurar un cron job o scheduled task que llame al endpoint de login a las 4:00 AM
3. **Opción 3**: El reset se ejecutará en el primer login después de las 4:00 AM

---

## 📊 Monitoreo

### Logs a Monitorear

Busca estos patrones en los logs:

✅ **Funcionamiento Normal**:
```
✅ Reset ya ejecutado hoy (2025-11-27), no se requiere acción
```

✅ **Reset Diario Exitoso**:
```
🔄 EJECUTANDO RESET DIARIO AUTOMÁTICO
   Fecha: 2025-11-27
   Hora Venezuela: 04:15
   Último reset: 2025-11-26
✅ RESET DIARIO COMPLETADO EXITOSAMENTE
   Clientes actualizados: 45
```

⚠️ **Antes de las 4:00 AM**:
```
⏰ Es antes de las 4:00 AM (03:45)
   Esperando hasta las 4:00 AM para ejecutar reset
```

❌ **Error**:
```
❌ ERROR en reset diario: [mensaje de error]
```

---

## 📝 Notas Importantes

1. **El reset ya NO ocurre en cada login**, solo a las 4:00 AM
2. **Los clientes pueden hacer login múltiples veces** sin perder su saldo
3. **El dashboard puede refrescar datos cada 60 segundos** sin causar resets
4. **La columna `fecha_ultimo_reset` es crítica** - debe existir y tener un valor válido
5. **El servidor debe estar corriendo a las 4:00 AM** para que el reset automático funcione

---

## 🎉 Resultado Esperado

Después de aplicar este fix:

- ✅ Los clientes pueden hacer login sin que se reseteen sus saldos
- ✅ Los saldos se mantienen estables durante toda la sesión
- ✅ El reset diario ocurre solo una vez al día a las 4:00 AM
- ✅ El sistema de cupos diarios funciona correctamente
- ✅ No más quejas de clientes sobre saldos incorrectos
