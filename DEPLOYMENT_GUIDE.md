# 🚀 Guía de Deployment: Despacho Gas+

Esta guía te llevará paso a paso para subir tu proyecto **Despacho Gas+** a la web y accederlo desde cualquier dispositivo.

---

## ✅ Archivos Ya Preparados

Ya hemos preparado los siguientes archivos de configuración:
- ✅ `Procfile` - Configuración para Railway
- ✅ `requirements.txt` - Dependencias Python actualizadas
- ✅ `server.py` - Configurado para producción
- ✅ `.gitignore` - Archivos a excluir de GitHub

---

## 📋 PASO 1: Crear Cuenta en GitHub

GitHub es donde guardaremos el código de tu proyecto.

### 1.1 Crear cuenta
1. Ve a [github.com](https://github.com)
2. Haz clic en **Sign up**
3. Completa el registro con tu email
4. Verifica tu cuenta

### 1.2 Instalar GitHub Desktop (Opcional pero recomendado)
1. Descarga desde: [desktop.github.com](https://desktop.github.com)
2. Instálalo y ábrelo
3. Inicia sesión con tu cuenta de GitHub

---

## 📤 PASO 2: Subir tu Proyecto a GitHub

### Opción A: Usando GitHub Desktop (Fácil)

1. **Abrir GitHub Desktop**
2. **Add Local Repository:**
   - Click en `File` → `Add local repository`
   - Buscar: `C:\Users\Usuario\Desktop\Despacho gas+\despacho-gas`
   - Click `Add repository`

3. **Si dice "no es un repositorio git":**
   - Click en `create a repository`
   - Deja el nombre como está
   - Click `Create repository`

4. **Hacer tu primer commit:**
   - Verás todos los archivos listados
   - En el campo de abajo escribe: "Preparar proyecto para deployment"
   - Click en `Commit to main`

5. **Publicar en GitHub:**
   - Click en `Publish repository`
   - Desmarca "Keep this code private" si quieres que sea público
   - Click `Publish repository`

### Opción B: Usando Comandos (Avanzado)

```bash
cd "C:\Users\Usuario\Desktop\Despacho gas+\despacho-gas"
git init
git add .
git commit -m "Preparar proyecto para deployment"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/despacho-gas.git
git push -u origin main
```

---

## 🐍 PASO 3: Deploy del Backend en Railway

Railway alojará tu servidor Node.js (Express).

### 3.1 Crear cuenta en Railway
1. Ve a [railway.app](https://railway.app)
2. Click en **Login**
3. Selecciona **Login with GitHub**
4. Autoriza Railway

### 3.2 Crear nuevo proyecto
1. Click en **New Project**
2. Selecciona **Deploy from GitHub repo**
3. Busca y selecciona tu repositorio `despacho-gas`
4. Click en el repositorio para seleccionarlo

### 3.3 Configurar el servicio
1. Railway detectará automáticamente que es Node.js gracias al `package.json` o `Procfile`
2. Espera a que termine el deploy (2-3 minutos)
3. Verás el estado "Success" cuando esté listo

### 3.4 Configurar variables de entorno
1. En tu proyecto, click en tu servicio
2. Ve a la pestaña **Variables**
3. Click en **+ New Variable**
4. Agrega estas variables:

   ```
   NODE_ENV = production
   ALLOWED_ORIGINS = https://tu-proyecto.vercel.app
   JWT_SECRET = tu_clave_secreta_muy_segura
   ADMIN_PASSWORD = tu_password_admin
   ```
   
   > **Nota:** Por ahora deja `ALLOWED_ORIGINS` vacío, lo actualizaremos después de crear el frontend

### 3.5 Obtener la URL de tu backend
1. En la pestaña **Settings**
2. Busca la sección **Networking**
3. Click en **Generate Domain**
4. Copia la URL generada (ejemplo: `despacho-gas-production.up.railway.app`)
5. **GUARDA ESTA URL** - la necesitarás en el siguiente paso

### 3.6 Probar que funciona
1. Abre tu navegador
2. Ve a: `https://TU-URL-RAILWAY.railway.app/api/login`
3. Deberías ver un mensaje de error (esperado porque no enviaste credenciales)
4. Si ves algo, ¡el backend está funcionando! ✅

---

## 🌐 PASO 4: Deploy del Frontend en Vercel

Vercel alojará tu aplicación Next.js.

### 4.1 Crear cuenta en Vercel
1. Ve a [vercel.com](https://vercel.com)
2. Click en **Sign Up**
3. Selecciona **Continue with GitHub**
4. Autoriza Vercel

### 4.2 Importar tu proyecto
1. En el dashboard de Vercel, click **Add New...**
2. Selecciona **Project**
3. Busca tu repositorio `despacho-gas`
4. Click en **Import**

### 4.3 Configurar el proyecto
1. **Framework Preset:** Next.js (detectado automáticamente)
2. **Root Directory:** Deja como está (`.`)
3. **Build Command:** `npm run build` (por defecto)
4. **Output Directory:** `.next` (por defecto)

### 4.4 Configurar variables de entorno
1. Antes de hacer deploy, expande **Environment Variables**
2. Agrega esta variable:

   ```
   Variable: BACKEND_API_BASE_URL
   Value: https://TU-URL-RAILWAY.railway.app
   ```
   
   > **Importante:** Reemplaza `TU-URL-RAILWAY.railway.app` con la URL que copiaste en el Paso 3.5

3. Click en **Deploy**

### 4.5 Esperar el deploy
1. Vercel comenzará a construir tu proyecto (2-5 minutos)
2. Verás logs en tiempo real
3. Cuando termine, verás: **"Congratulations! 🎉"**

### 4.6 Obtener la URL de tu aplicación
1. Verás tu URL (ejemplo: `despacho-gas.vercel.app`)
2. Click en la URL para abrir tu aplicación
3. **COPIA ESTA URL** - la necesitarás en el siguiente paso

---

## 🔗 PASO 5: Conectar Backend y Frontend

Ahora debemos actualizar el backend para permitir peticiones desde el frontend.

### 5.1 Actualizar variables en Railway
1. Regresa a [railway.app](https://railway.app)
2. Abre tu proyecto
3. Click en tu servicio
4. Ve a **Variables**
5. Edita la variable `ALLOWED_ORIGINS`:
   ```
   ALLOWED_ORIGINS = https://tu-proyecto.vercel.app
   ```
   > **Importante:** Reemplaza con tu URL real de Vercel (sin barra al final)

6. Railway redesplegará automáticamente (1-2 minutos)

---

## 🧪 PASO 6: Probar tu Aplicación

### 6.1 Probar el login
1. Abre tu aplicación en Vercel: `https://tu-proyecto.vercel.app`
2. Ve a la página de login
3. Usa las credenciales:
   - **Usuario:** `admin`
   - **Contraseña:** `admin123`
4. Si puedes entrar, ¡todo funciona! ✅

### 6.2 Probar funcionalidades
1. **Registrar un cliente:**
   - Ve a "Registrar Cliente"
   - Completa el formulario
   - Guarda

2. **Buscar cliente:**
   - Ve a "Clientes"
   - Busca por teléfono
   - Verifica que aparezca

3. **Registrar retiro:**
   - Busca un cliente
   - Registra un retiro
   - Verifica que se descuente del saldo

### 6.3 Probar desde otros dispositivos
1. **Desde tu celular:**
   - Abre el navegador
   - Ve a `https://tu-proyecto.vercel.app`
   - Haz login
   - ¡Ya funciona desde cualquier dispositivo! 📱

2. **Desde otra computadora:**
   - Comparte la URL con alguien
   - Que prueben hacer login
   - ¡Funciona desde cualquier lugar! 💻

---

## ⚠️ IMPORTANTE: Cambios Post-Deployment

### 1. Cambiar contraseña de admin
Después del primer deploy, cambia la contraseña por seguridad:
1. En `server.py`, actualiza la contraseña en la base de datos
2. O crea un endpoint para cambiar contraseñas

### 2. Cambiar SECRET_KEY
En `server.py` línea 10:
```python
app.config['SECRET_KEY'] = 'tu_clave_secreta_muy_segura'
```
Cambia esto por algo único y seguro.

### 3. Configurar dominio personalizado (Opcional)
- En Vercel: Settings → Domains → Add Domain
- Conecta tu propio dominio (ej: `despachog

as.com`)

---

## 🐛 Solución de Problemas

### Error: "CORS policy"
- Verifica que `ALLOWED_ORIGINS` en Railway tenga la URL correcta de Vercel
- Debe ser HTTPS, no HTTP
- Sin barra al final

### Error: "Failed to fetch"
- Verifica que `BACKEND_API_BASE_URL` en Vercel sea correcto
- Debe apuntar a tu URL de Railway

### Error: "Cannot read properties"
- Revisa los logs en Vercel: Settings → Functions → Logs
- Revisa los logs en Railway: Click en tu servicio → Logs

### Backend no responde
- Ve a Railway → tu servicio → Logs
- Busca errores de Python
- Verifica que el Procfile esté en la raíz del proyecto

### Frontend no carga
- Ve a Vercel → tu proyecto → Deployments → Click en el último
- Revisa el Build Log para ver errores

---

## 📊 Monitoreo

### Ver logs del Backend (Railway)
1. Railway → tu proyecto → tu servicio
2. Click en **Logs** (arriba)
3. Verás logs en tiempo real

### Ver logs del Frontend (Vercel)
1. Vercel → tu proyecto → Deployments
2. Click en el deployment activo
3. Click en **Functions** para ver logs

---

## 🔄 Actualizaciones Futuras

Cada vez que hagas cambios:

1. **Hacer cambios en tu código local**
2. **Guardar y probar localmente**
3. **Subir a GitHub:**
   - GitHub Desktop: Commit → Push
   - O: `git add .` → `git commit -m "mensaje"` → `git push`
4. **Deploy automático:**
   - Vercel detecta el push y redespliega automáticamente
   - Railway detecta el push y redespliega automáticamente

---

## 📱 URLs Importantes

**Tu aplicación:**
- Frontend: `https://tu-proyecto.vercel.app`
- Backend: `https://tu-proyecto.railway.app`

**Dashboards:**
- Vercel: [vercel.com/dashboard](https://vercel.com/dashboard)
- Railway: [railway.app/dashboard](https://railway.app/dashboard)
- GitHub: [github.com](https://github.com)

---

## 🎉 ¡Felicidades!

Tu aplicación **Despacho Gas+** ahora está en la web y accesible desde cualquier dispositivo con internet.

**Lo que lograste:**
- ✅ Backend Flask en Railway
- ✅ Frontend Next.js en Vercel
- ✅ Base de datos SQLite funcionando
- ✅ HTTPS automático (seguro)
- ✅ Deploy automático con cada cambio
- ✅ Acceso desde cualquier dispositivo

---

## 💡 Próximos Pasos Opcionales

1. **Migrar a PostgreSQL** (para datos permanentes)
2. **Configurar dominio personalizado**
3. **Agregar autenticación de dos factores**
4. **Configurar backups automáticos**
5. **Agregar analytics**

---

**¿Necesitas ayuda?**
- Railway docs: [docs.railway.app](https://docs.railway.app)
- Vercel docs: [vercel.com/docs](https://vercel.com/docs)
