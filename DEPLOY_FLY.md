# 🚀 Guía de Despliegue en Fly.io

## Paso 1: Instalar Fly CLI

### Windows (PowerShell)
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

### macOS/Linux
```bash
curl -L https://fly.io/install.sh | sh
```

## Paso 2: Iniciar sesión

```bash
fly auth login
```

## Paso 3: Crear el volumen para la base de datos

```bash
fly volumes create despacho_gas_data --size 1 --region iad
```

> **Nota:** Cambia `iad` por la región más cercana a ti (ej: `bog` para Bogotá, `gru` para São Paulo)

## Paso 4: Configurar variables de entorno

```bash
# URL de tu frontend en Vercel
fly secrets set ALLOWED_ORIGINS=https://tu-app.vercel.app

# Contraseña del admin
fly secrets set ADMIN_PASSWORD=tu_contraseña_segura

# Secret key para JWT
fly secrets set SECRET_KEY=tu_clave_secreta_muy_larga_y_segura

# Directorio de datos (ya configurado en server.py)
fly secrets set DATA_DIR=/data
```

## Paso 5: Desplegar

```bash
fly deploy
```

## Paso 6: Verificar el despliegue

```bash
# Ver logs en tiempo real
fly logs

# Ver información de la app
fly status

# Abrir la app en el navegador
fly open
```

## Paso 7: Actualizar Vercel

1. Ve a Vercel → Tu proyecto → Settings → Environment Variables
2. Actualiza `NEXT_PUBLIC_API_BASE_URL` con la URL de Fly.io (ej: `https://despacho-gas-backend.fly.dev`)
3. Actualiza `BACKEND_API_BASE_URL` con la misma URL
4. Haz redeploy en Vercel

## Comandos útiles

```bash
# Ver logs
fly logs

# Conectar a la máquina (SSH)
fly ssh console

# Ver variables de entorno
fly secrets list

# Escalar recursos
fly scale memory 512

# Reiniciar la app
fly apps restart despacho-gas-backend
```

## Solución de problemas

### Error: "Volume not found"
```bash
fly volumes create despacho_gas_data --size 1 --region iad
```

### Error: "Port already in use"
Verifica que `fly.toml` tenga `internal_port = 8080` y que el Dockerfile use el mismo puerto.

### La base de datos no persiste
Asegúrate de que el volumen esté montado correctamente en `fly.toml`:
```toml
[[mounts]]
  source = "despacho_gas_data"
  destination = "/data"
```

### Ver logs de errores
```bash
fly logs --app despacho-gas-backend
```

