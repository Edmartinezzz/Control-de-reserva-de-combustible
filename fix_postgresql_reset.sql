-- Script para agregar fecha_ultimo_reset a PostgreSQL en producción
-- Ejecutar esto en el Shell de Render con psql

-- Conectar a la base de datos
-- psql $DATABASE_URL

-- Agregar la columna si no existe
ALTER TABLE sistema_config ADD COLUMN IF NOT EXISTS fecha_ultimo_reset TEXT;

-- Establecer la fecha de hoy para evitar reset inmediato
UPDATE sistema_config SET fecha_ultimo_reset = CURRENT_DATE WHERE id = 1;

-- Verificar
SELECT * FROM sistema_config WHERE id = 1;
