# 🚀 Guía de Despliegue en Fly.io

## Paso 1: Instalar Fly CLI

### Windows (PowerShell):
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### macOS/Linux:
```bash
curl -L https://fly.io/install.sh | sh
```

## Paso 2: Iniciar sesión en Fly.io

```bash
fly auth login
```

Esto abrirá tu navegador para autenticarte.

## Paso 3: Crear la aplicación en Fly.io

Desde la raíz del proyecto (donde está `fly.toml`):

```bash
fly launch
```

Fly CLI te preguntará:
- **App name**: Deja el sugerido o pon uno personalizado (ej: `despacho-gas-backend`)
- **Region**: Elige la más cercana (ej: `iad` para Virginia, `gru` para São Paulo)
- **Postgres/Redis**: No, presiona Enter (usamos SQLite)

## Paso 4: Crear el volumen para la base de datos

```bash
fly volumes create despacho_gas_data --size 1 --region iad
```

> **Nota**: Reemplaza `iad` con la región que elegiste en el paso anterior.

## Paso 5: Configurar variables de entorno

```bash
# Secret key para JWT
fly secrets set SECRET_KEY="tu_clave_secreta_muy_segura_y_unica"

# Orígenes permitidos (URL de tu frontend en Vercel)
fly secrets set ALLOWED_ORIGINS="https://control-de-reserva-de-combustible-gtotjq0x1.vercel.app,https://tu-dominio.vercel.app"

# Contraseña del admin
fly secrets set ADMIN_PASSWORD="admin123"

# (Opcional) Ruta personalizada para la base de datos
fly secrets set DB_PATH="/data/gas_delivery.db"
```

## Paso 6: Desplegar

```bash
fly deploy
```

Esto construirá la imagen Docker y la desplegará en Fly.io.

## Paso 7: Obtener la URL de tu aplicación

```bash
fly status
```

O ve a: https://fly.io/dashboard y busca tu app. La URL será: `https://tu-app.fly.dev`

## Paso 8: Actualizar variables en Vercel

1. Ve a Vercel → Tu proyecto → Settings → Environment Variables
2. Actualiza:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://tu-app.fly.dev`
   - `BACKEND_API_BASE_URL` = `https://tu-app.fly.dev`
3. Haz **Redeploy** en Vercel

## Comandos útiles

```bash
# Ver logs en tiempo real
fly logs

# Ver estado de la app
fly status

# Abrir una consola SSH en el contenedor
fly ssh console

# Ver variables de entorno
fly secrets list

# Reiniciar la app
fly apps restart

# Escalar (si necesitas más recursos)
fly scale count 1
```

## Solución de problemas

### Error: "Volume not found"
- Asegúrate de crear el volumen con el mismo nombre que en `fly.toml` (`despacho_gas_data`)
- Verifica que esté en la misma región

### Error: "Port not accessible"
- Verifica que `PORT=8080` esté en las variables de entorno
- Revisa que `fly.toml` tenga `internal_port = 8080`

### Base de datos no persiste
- Verifica que el volumen esté montado: `fly volumes list`
- Revisa que el path en `server.py` use `/data/gas_delivery.db` (o define `DB_PATH`)

## Monitoreo

- **Dashboard**: https://fly.io/dashboard
- **Logs**: `fly logs` o en el dashboard
- **Métricas**: Disponibles en el dashboard de Fly.io

