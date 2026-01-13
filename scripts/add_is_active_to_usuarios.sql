ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.usuarios.is_active IS 'Soft delete flag. Active users are TRUE.';
