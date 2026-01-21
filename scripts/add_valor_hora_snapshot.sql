ALTER TABLE public.jornadas 
ADD COLUMN IF NOT EXISTS valor_hora_snapshot NUMERIC;

COMMENT ON COLUMN public.jornadas.valor_hora_snapshot IS 'Value of employee hourly rate at the moment of registration.';
