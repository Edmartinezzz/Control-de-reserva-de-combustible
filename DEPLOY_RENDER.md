# 🚀 Guía de Despliegue en Render (GRATIS)

## Paso 1: Crear cuenta en Render

1. Ve a https://render.com
2. Click en **Sign Up**
3. Selecciona **Continue with GitHub** (recomendado)
4. Autoriza Render

## Paso 2: Crear un nuevo Web Service

1. En el dashboard de Render, click en **New +**
2. Selecciona **Web Service**
3. Conecta tu repositorio de GitHub:
   - Selecciona el repositorio `despacho-gas`
   - O haz click en **Connect GitHub** si no está conectado

## Paso 3: Configurar el servicio

### Configuración básica:
- **Name**: `despacho-gas-backend`
- **Region**: `Oregon (US West)` (o la más cercana a ti)
- **Branch**: `main` (o la rama que uses)
- **Root Directory**: Deja vacío (o `.` si es necesario)

### Build & Deploy:
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn -w 2 -b 0.0.0.0:$PORT --timeout 120 server:app`

### Plan:
- **Free** (selecciona el plan gratuito)

## Paso 4: Configurar variables de entorno

En la sección **Environment Variables**, agrega:

```
ALLOWED_ORIGINS=https://control-de-reserva-de-combustible-gtotjq0x1.vercel.app
ADMIN_PASSWORD=tu_contraseña_segura
SECRET_KEY=una_clave_muy_larga_y_segura_minimo_32_caracteres
FLASK_ENV=production
DATA_DIR=/opt/render/project/src
```

> **Nota:** Render usa `/opt/render/project/src` como directorio de trabajo por defecto

## Paso 5: Desplegar

1. Click en **Create Web Service**
2. Render comenzará a construir y desplegar tu aplicación
3. Espera 2-5 minutos mientras se completa el deploy

## Paso 6: Obtener la URL

Una vez completado el deploy, Render te dará una URL tipo:
```
https://despacho-gas-backend.onrender.com
```

## Paso 7: Actualizar Vercel

1. Ve a Vercel → Tu proyecto → Settings → Environment Variables
2. Actualiza:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://despacho-gas-backend.onrender.com`
   - `BACKEND_API_BASE_URL` = `https://despacho-gas-backend.onrender.com`
3. Guarda y haz **Redeploy**

## Paso 8: Verificar que funciona

Abre en el navegador:
```
https://despacho-gas-backend.onrender.com/
```

Deberías ver:
```json
{
  "status": "online",
  "message": "API de Despacho Gas+ funcionando correctamente",
  "version": "1.0.0"
}
```

## ⚠️ Notas importantes sobre Render Free

1. **Sleep Mode**: El servicio se duerme después de 15 minutos sin tráfico
   - Se reactiva automáticamente cuando recibe una petición
   - La primera petición después de dormir puede tardar 30-60 segundos

2. **Base de datos**: SQLite funciona, pero los datos se reinician si el servicio se reinicia
   - Para datos persistentes, considera usar Render PostgreSQL (también tiene free tier)

3. **Logs**: Puedes ver logs en tiempo real en el dashboard de Render

## Comandos útiles

- **Ver logs**: Dashboard → Tu servicio → Logs
- **Redeploy**: Dashboard → Tu servicio → Manual Deploy → Deploy latest commit
- **Variables de entorno**: Dashboard → Tu servicio → Environment

## Solución de problemas

### Error: "Build failed"
- Verifica que `requirements.txt` tenga todas las dependencias
- Revisa los logs de build en Render

### Error: "Application failed to respond"
- Verifica que el `Start Command` sea correcto
- Asegúrate de que el puerto use `$PORT` (variable de entorno de Render)

### La app se duerme muy rápido
- Esto es normal en el plan gratuito
- La primera petición después de dormir tarda más, pero luego funciona normal

