-- Add 'minimo' column to 'usuarios' table if it doesn't exist
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS minimo BOOLEAN DEFAULT FALSE;
