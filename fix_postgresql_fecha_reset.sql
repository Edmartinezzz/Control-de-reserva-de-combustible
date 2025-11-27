-- Migration: Add and initialize fecha_ultimo_reset column in PostgreSQL
-- This prevents the daily fuel reset from running multiple times

-- Step 1: Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sistema_config' 
        AND column_name = 'fecha_ultimo_reset'
    ) THEN
        ALTER TABLE sistema_config ADD COLUMN fecha_ultimo_reset DATE;
        RAISE NOTICE 'Column fecha_ultimo_reset added successfully';
    ELSE
        RAISE NOTICE 'Column fecha_ultimo_reset already exists';
    END IF;
END $$;

-- Step 2: Set initial value to yesterday to prevent immediate reset
-- Only update if the value is NULL
UPDATE sistema_config 
SET fecha_ultimo_reset = CURRENT_DATE - INTERVAL '1 day'
WHERE id = 1 AND fecha_ultimo_reset IS NULL;

-- Step 3: Verify the change
SELECT id, retiros_bloqueados, fecha_ultimo_reset, 
       CURRENT_DATE as today,
       CASE 
           WHEN fecha_ultimo_reset IS NULL THEN 'NULL - WILL RESET ON NEXT CHECK'
           WHEN fecha_ultimo_reset >= CURRENT_DATE THEN 'Already reset today'
           ELSE 'Will reset after 4:00 AM'
       END as status
FROM sistema_config 
WHERE id = 1;
