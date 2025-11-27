# Guía: Cómo Ejecutar el Fix de Base de Datos

## Opción 1: Usar el Script Automático (Recomendado)

### Paso 1: Instalar psycopg2

```bash
pip install psycopg2-binary
```

### Paso 2: Obtener la DATABASE_URL de Render

1. Ve a [render.com](https://render.com)
2. Selecciona tu base de datos PostgreSQL
3. En la sección "Connections", copia la **Internal Database URL** o **External Database URL**
   - Se ve algo así: `postgresql://usuario:password@host:puerto/database`

### Paso 3: Configurar DATABASE_URL

**En Windows (PowerShell):**
```powershell
$env:DATABASE_URL="postgresql://usuario:password@host:puerto/database"
```

**En Windows (CMD):**
```cmd
set DATABASE_URL=postgresql://usuario:password@host:puerto/database
```

**En Linux/Mac:**
```bash
export DATABASE_URL="postgresql://usuario:password@host:puerto/database"
```

### Paso 4: Ejecutar el Script

```bash
python ejecutar_fix_db.py
```

El script:
- ✅ Se conectará a tu base de datos
- ✅ Verificará el estado de `fecha_ultimo_reset`
- ✅ Si está en NULL, lo corregirá automáticamente
- ✅ Te mostrará el resultado

---

## Opción 2: Usar la Interfaz Web de Render

### Paso 1: Acceder al Shell de Render

1. Ve a [render.com](https://render.com)
2. Selecciona tu base de datos PostgreSQL
3. Click en **"Shell"** en el menú lateral (si está disponible)

### Paso 2: Ejecutar SQL

Si Render tiene un shell SQL, ejecuta:

```sql
UPDATE sistema_config
SET fecha_ultimo_reset = CURRENT_DATE
WHERE id = 1;
```

---

## Opción 3: Usar un Cliente SQL Externo

### Paso 1: Descargar un Cliente SQL

Opciones gratuitas:
- **DBeaver** (recomendado): https://dbeaver.io/download/
- **pgAdmin**: https://www.pgadmin.org/download/
- **TablePlus**: https://tableplus.com/

### Paso 2: Obtener Credenciales de Render

1. Ve a tu base de datos en Render
2. Copia las credenciales:
   - **Host**
   - **Port**
   - **Database**
   - **Username**
   - **Password**

### Paso 3: Conectar con el Cliente

En DBeaver/pgAdmin/TablePlus:
1. Nueva conexión → PostgreSQL
2. Ingresa las credenciales de Render
3. Conectar

### Paso 4: Ejecutar SQL

```sql
UPDATE sistema_config
SET fecha_ultimo_reset = CURRENT_DATE
WHERE id = 1;
```

---

## Verificación

Después de ejecutar el fix, verifica:

1. **Login sin reset:**
   - Haz login con un cliente
   - Los litros NO deben cambiar

2. **Múltiples logins:**
   - Haz login varias veces
   - Los litros deben permanecer iguales

3. **Retiros funcionan:**
   - Haz un retiro
   - Los litros deben disminuir correctamente

---

## ¿Necesitas Ayuda?

Si tienes problemas, comparte:
- El mensaje de error que ves
- Qué opción estás intentando usar
- Si estás en Windows, Mac o Linux
