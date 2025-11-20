# Solución: Datos se Borran en Cada Deploy

## Problema

Cada vez que haces redeploy en Render, se borran:
- Inventario de litros
- Trabajadores (subclientes) de los clientes
- Cualquier otro dato en la base de datos

## Causa

Render usa un **sistema de archivos efímero** por defecto. Esto significa que todo lo que no esté en un disco persistente se borra en cada deploy.

## Solución: Configurar Disco Persistente en Render

### Paso 1: Crear Disco Persistente

1. Ve a tu dashboard de Render
2. Selecciona tu servicio `despacho-gas-backend`
3. Ve a la pestaña **"Disks"** (Discos)
4. Haz clic en **"Add Disk"** (Agregar Disco)
5. Configura:
   - **Name**: `data-disk` (o cualquier nombre)
   - **Mount Path**: `/data`
   - **Size**: 1 GB (suficiente para SQLite)
6. Haz clic en **"Create Disk"**

### Paso 2: Configurar Variable de Entorno

1. Ve a la pestaña **"Environment"**
2. Agrega o verifica que exista:
   ```
   DATA_DIR=/data
   ```
3. Guarda los cambios

### Paso 3: Redeploy

1. Haz un redeploy manual
2. La base de datos ahora se guardará en `/data/gas_delivery.db`
3. Este directorio persistirá entre deploys

## Cómo Funciona

El código en `server.py` ya está preparado:

```python
DATA_DIR = os.environ.get('DATA_DIR', '/data')

if DATA_DIR and os.path.isdir(DATA_DIR):
    DEFAULT_DB_PATH = os.path.join(DATA_DIR, 'gas_delivery.db')
else:
    DEFAULT_DB_PATH = os.path.join(BASE_DIR, 'gas_delivery.db')
```

- Si existe `/data` (disco persistente), usa ese directorio
- Si no existe, usa el directorio del proyecto (efímero)

## Verificación

Después de configurar el disco persistente:

1. Agrega datos de prueba (inventario, trabajadores)
2. Haz un redeploy
3. Verifica que los datos sigan ahí

## Alternativa: PostgreSQL

Si prefieres una solución más robusta:

1. Usa PostgreSQL en lugar de SQLite
2. Render ofrece PostgreSQL gratis
3. Los datos siempre persisten
4. Mejor para producción

**Nota**: SQLite con disco persistente es suficiente para tu caso de uso actual.

## Resumen

✅ **Solución inmediata**: Agregar disco persistente en Render
✅ **Costo**: Gratis (1 GB incluido en plan gratuito)
✅ **Tiempo**: 5 minutos de configuración
✅ **Resultado**: Datos persisten entre deploys
