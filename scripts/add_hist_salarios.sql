ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS hist_salarios JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.usuarios.hist_salarios IS 'Array of salary history objects: [{date: "YYYY-MM-DD", salary: 1300000, hourlyRate: 5416, monthlyHours: 240, weeklyHours: 48}]';
