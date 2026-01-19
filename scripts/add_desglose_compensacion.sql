-- Add JSONB column to track detailed compensation breakdown per jornada
ALTER TABLE jornadas 
ADD COLUMN IF NOT EXISTS desglose_compensacion JSONB DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN jornadas.desglose_compensacion IS 'Stores the breakdown of minutes requested/banked per overtime type (e.g. {"extra_diurna": 60})';
