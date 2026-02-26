-- Performance and integrity indexes for high-traffic API paths.

-- Jornadas: frequent filters by employee/date and compensation state.
CREATE INDEX IF NOT EXISTS idx_jornadas_empleado_fecha
  ON jornadas (empleado_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_jornadas_estado_compensacion_fecha
  ON jornadas (estado_compensacion, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_jornadas_registrado_por
  ON jornadas (registrado_por);

CREATE INDEX IF NOT EXISTS idx_jornadas_aprobado_por
  ON jornadas (aprobado_por);

-- Solicitudes de tiempo: queue/history queries and per-user balance checks.
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_estado_fecha_inicio
  ON solicitudes_tiempo (usuario_id, estado, fecha_inicio DESC);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado_fecha_inicio
  ON solicitudes_tiempo (estado, fecha_inicio DESC);

-- Historial de bolsa: user timeline reads.
CREATE INDEX IF NOT EXISTS idx_historial_bolsa_usuario_fecha
  ON historial_bolsa (usuario_id, fecha DESC);

-- Apelaciones: manager queue and history filters.
CREATE INDEX IF NOT EXISTS idx_apelaciones_estado_fecha
  ON apelaciones (estado, fecha DESC);

-- Data integrity: only one active request per user per day.
-- If conflicting legacy data exists, keep running with app-level checks and
-- clean duplicates before enabling this unique index.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND c.relname = 'ux_solicitudes_activas_por_dia'
      AND n.nspname = 'public'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM solicitudes_tiempo
      WHERE estado <> 'RECHAZADO'
      GROUP BY usuario_id, (fecha_inicio::date)
      HAVING COUNT(*) > 1
    ) THEN
      RAISE NOTICE 'Unique index ux_solicitudes_activas_por_dia not created: duplicate active requests already exist.';
    ELSE
      EXECUTE '
        CREATE UNIQUE INDEX ux_solicitudes_activas_por_dia
        ON solicitudes_tiempo (usuario_id, (fecha_inicio::date))
        WHERE estado <> ''RECHAZADO''
      ';
    END IF;
  END IF;
END $$;
