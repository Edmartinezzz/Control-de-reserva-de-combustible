# Migración de SQLite a PostgreSQL en Render

## 🎯 Objetivo
Migrar la base de datos de SQLite a PostgreSQL para que los datos persistan correctamente en Render (gratis).

## 📋 Pasos de Migración

### Paso 1: Crear Base de Datos PostgreSQL en Render

1. **Ve a tu Dashboard de Render**: https://dashboard.render.com
2. **Haz clic en "New +"** → Selecciona **"PostgreSQL"**
3. **Configura la base de datos:**
   - **Name**: `despacho-gas-db` (o el nombre que prefieras)
   - **Database**: `despacho_gas` (nombre de la BD)
   - **User**: Se genera automáticamente
   - **Region**: Selecciona la misma región que tu backend
   - **PostgreSQL Version**: 16 (la más reciente)
   - **Plan**: **Free** (0 GB de almacenamiento, suficiente para empezar)
4. **Haz clic en "Create Database"**
5. **Espera 2-3 minutos** mientras Render crea la base de datos

### Paso 2: Obtener la URL de Conexión

1. Una vez creada la base de datos, ve a la pestaña **"Info"**
2. Busca **"Internal Database URL"** (es la que usaremos)
3. Copia la URL completa, se verá así:
   ```
   postgresql://user:password@hostname:5432/database_name
   ```
4. **Guárdala**, la necesitarás en el siguiente paso

### Paso 3: Configurar Variables de Entorno en el Backend

1. Ve a tu servicio backend en Render (`despacho-gas-backend`)
2. Ve a la pestaña **"Environment"**
3. **Agrega esta nueva variable:**
   - **Key**: `DATABASE_URL`
   - **Value**: Pega la "Internal Database URL" que copiaste
4. **Guarda los cambios**

### Paso 4: Instalar Dependencias de PostgreSQL

El archivo `requirements.txt` ya debe incluir `psycopg2-binary`. Si no está, agrégalo.

**Contenido actualizado de `requirements.txt`:**
```
Flask==3.0.0
Flask-CORS==4.0.0
PyJWT==2.8.0
python-dotenv==1.0.0
psycopg2-binary==2.9.9
gunicorn==21.2.0
```

### Paso 5: Actualizar `server.py`

El código de `server.py` necesita ser modificado para soportar PostgreSQL. Los cambios principales son:

1. **Importar psycopg2** en lugar de sqlite3
2. **Cambiar las consultas SQL** de sintaxis SQLite a PostgreSQL
3. **Actualizar la función de conexión a la base de datos**
4. **Modificar el esquema de tablas** para PostgreSQL

> **Nota:** Los archivos modificados ya están listos. Solo necesitas hacer el redeploy.

### Paso 6: Redeploy del Backend

1. Una vez que los cambios estén en GitHub (yo los subiré)
2. Ve a tu servicio backend en Render
3. Haz clic en **"Manual Deploy"** → **"Deploy latest commit"**
4. Espera a que el deploy termine (3-5 minutos)

### Paso 7: Verificar la Migración

1. **Inicia sesión** en tu aplicación web
2. **Crea un cliente de prueba**
3. **Agrega inventario**
4. **Espera 20 minutos** (para que Render "duerma" el servicio)
5. **Vuelve a entrar** y verifica que los datos sigan ahí ✅

## 🔄 Diferencias Clave: SQLite vs PostgreSQL

| Característica | SQLite | PostgreSQL |
|----------------|--------|------------|
| **Tipo de dato AUTO_INCREMENT** | `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| **Booleanos** | `BOOLEAN` (0/1) | `BOOLEAN` (true/false) |
| **Timestamps** | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` |
| **Placeholder** | `?` | `%s` |
| **Conexión** | `sqlite3.connect()` | `psycopg2.connect()` |
| **Cursor** | `.cursor()` | `.cursor()` |
| **Commit** | `.commit()` | `.commit()` |

## ✅ Ventajas de PostgreSQL

- ✅ **Persistencia garantizada** (los datos nunca se borran)
- ✅ **Gratis en Render** (hasta 1 GB)
- ✅ **Más robusto** para producción
- ✅ **Mejor rendimiento** con múltiples usuarios
- ✅ **Soporte para transacciones** más avanzadas

## ⚠️ Importante

- **Los datos actuales de SQLite NO se migran automáticamente**
- Tendrás que volver a crear:
  - Usuario admin
  - Clientes
  - Inventario
  - Agendamientos
- **Esto es normal** en una migración de base de datos

## 🆘 Solución de Problemas

### Error: "relation does not exist"
- **Causa:** Las tablas no se crearon
- **Solución:** Verifica que `init_db()` se ejecute correctamente en el primer deploy

### Error: "could not connect to server"
- **Causa:** URL de conexión incorrecta
- **Solución:** Verifica que `DATABASE_URL` esté correctamente configurada

### Error: "password authentication failed"
- **Causa:** Credenciales incorrectas
- **Solución:** Usa la "Internal Database URL" de Render, no la "External"

## 📞 Siguiente Paso

Una vez que confirmes que entiendes estos pasos, procederé a:
1. Modificar `server.py` para PostgreSQL
2. Actualizar `requirements.txt`
3. Subir los cambios a GitHub
4. Darte instrucciones para el redeploy

¿Listo para continuar? 🚀
