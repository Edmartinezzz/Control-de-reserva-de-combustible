-- Migration: Add fecha_ultimo_reset column to sistema_config
-- This prevents the daily fuel reset from running multiple times

-- Check if column exists first (SQLite doesn't have IF NOT EXISTS for columns)
-- Run this in your production database

-- Add the column
ALTER TABLE sistema_config ADD COLUMN fecha_ultimo_reset TEXT;

-- Set initial value to today to prevent immediate reset
UPDATE sistema_config SET fecha_ultimo_reset = date('now') WHERE id = 1;

-- Verify the change
SELECT * FROM sistema_config WHERE id = 1;
