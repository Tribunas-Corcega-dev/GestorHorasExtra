-- Cleanup helper for duplicate active compensatory requests per user/day.
-- Active means estado <> 'RECHAZADO'.
--
-- Usage:
-- 1) Run section A to inspect duplicates.
-- 2) If results are correct, run section B to reject extra rows.

-- ==========================================================
-- A) PREVIEW DUPLICATES (NO CHANGES)
-- ==========================================================

SELECT
  usuario_id,
  (fecha_inicio::date) AS fecha_dia,
  COUNT(*) AS total_activas
FROM solicitudes_tiempo
WHERE estado <> 'RECHAZADO'
GROUP BY usuario_id, (fecha_inicio::date)
HAVING COUNT(*) > 1
ORDER BY fecha_dia DESC, usuario_id;

SELECT
  st.id,
  st.usuario_id,
  st.fecha_inicio,
  st.fecha_fin,
  st.estado,
  st.minutos_solicitados,
  st.tipo,
  st.fecha_creacion,
  st.updated_at
FROM solicitudes_tiempo st
JOIN (
  SELECT usuario_id, (fecha_inicio::date) AS fecha_dia
  FROM solicitudes_tiempo
  WHERE estado <> 'RECHAZADO'
  GROUP BY usuario_id, (fecha_inicio::date)
  HAVING COUNT(*) > 1
) d
  ON d.usuario_id = st.usuario_id
 AND d.fecha_dia = (st.fecha_inicio::date)
WHERE st.estado <> 'RECHAZADO'
ORDER BY st.usuario_id, st.fecha_inicio, st.fecha_creacion;

-- ==========================================================
-- B) APPLY CLEANUP (UNCOMMENT TO EXECUTE)
-- Keeps the newest active request per user/day and rejects older ones.
-- ==========================================================

-- BEGIN;
--
-- WITH ranked AS (
--   SELECT
--     id,
--     ROW_NUMBER() OVER (
--       PARTITION BY usuario_id, (fecha_inicio::date)
--       ORDER BY
--         COALESCE(updated_at, fecha_creacion, fecha_inicio) DESC,
--         id DESC
--     ) AS rn
--   FROM solicitudes_tiempo
--   WHERE estado <> 'RECHAZADO'
-- )
-- UPDATE solicitudes_tiempo st
-- SET
--   estado = 'RECHAZADO',
--   updated_at = NOW(),
--   motivo = CONCAT(
--     COALESCE(st.motivo, ''),
--     CASE WHEN COALESCE(st.motivo, '') = '' THEN '' ELSE ' | ' END,
--     'Auto-rechazada por limpieza de duplicados'
--   )
-- FROM ranked r
-- WHERE st.id = r.id
--   AND r.rn > 1;
--
-- COMMIT;
