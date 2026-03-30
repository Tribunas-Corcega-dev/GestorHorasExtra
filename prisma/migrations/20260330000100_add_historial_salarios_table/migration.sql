-- Normalize salary history from usuarios.hist_salarios JSONB to relational table.

CREATE TABLE IF NOT EXISTS public.historial_salarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  fecha_vigencia date NOT NULL,
  salario_base numeric,
  valor_hora numeric,
  horas_semanales numeric(10,2),
  horas_mensuales numeric(10,2),
  motivo text,
  origen text DEFAULT 'MANUAL',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hist_salarios_usuario_fecha_desc
  ON public.historial_salarios (usuario_id, fecha_vigencia DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hist_salarios_usuario_created_desc
  ON public.historial_salarios (usuario_id, created_at DESC);

-- Backfill from legacy JSONB array: usuarios.hist_salarios
INSERT INTO public.historial_salarios (
  usuario_id,
  fecha_vigencia,
  salario_base,
  valor_hora,
  horas_semanales,
  horas_mensuales,
  motivo,
  origen,
  created_at
)
SELECT
  u.id,
  COALESCE(NULLIF((e->>'date')::text, '')::date, DATE '2000-01-01') AS fecha_vigencia,
  NULLIF(e->>'salary', '')::numeric AS salario_base,
  NULLIF(e->>'hourlyRate', '')::numeric AS valor_hora,
  NULLIF(e->>'weeklyHours', '')::numeric(10,2) AS horas_semanales,
  NULLIF(e->>'monthlyHours', '')::numeric(10,2) AS horas_mensuales,
  NULLIF(e->>'reason', '')::text AS motivo,
  'MIGRACION_JSONB'::text AS origen,
  now()
FROM public.usuarios u
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(u.hist_salarios, '[]'::jsonb)) e
WHERE NOT EXISTS (
  SELECT 1
  FROM public.historial_salarios hs
  WHERE hs.usuario_id = u.id
    AND hs.fecha_vigencia = COALESCE(NULLIF((e->>'date')::text, '')::date, DATE '2000-01-01')
    AND COALESCE(hs.salario_base, -1) = COALESCE(NULLIF(e->>'salary', '')::numeric, -1)
    AND COALESCE(hs.valor_hora, -1) = COALESCE(NULLIF(e->>'hourlyRate', '')::numeric, -1)
);

-- Baseline entry for users without JSON history but with current salary snapshot.
INSERT INTO public.historial_salarios (
  usuario_id,
  fecha_vigencia,
  salario_base,
  valor_hora,
  horas_semanales,
  horas_mensuales,
  motivo,
  origen,
  created_at
)
SELECT
  u.id,
  DATE '2000-01-01',
  u.salario_base,
  u.valor_hora,
  u.horas_semanales,
  u.horas_mensuales,
  'Linea base inicial',
  'MIGRACION_BASELINE',
  now()
FROM public.usuarios u
WHERE (u.salario_base IS NOT NULL OR u.valor_hora IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.historial_salarios hs WHERE hs.usuario_id = u.id
  );
