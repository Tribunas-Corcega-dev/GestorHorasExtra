
-- Function to calculate and update the overtime summary for a user
CREATE OR REPLACE FUNCTION sync_resumen_horas()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
    total_produced JSONB;
    total_banked JSONB;
    net_balance JSONB;
BEGIN
    -- Determine the user ID (handle DELETE vs INSERT/UPDATE)
    IF (TG_OP = 'DELETE') THEN
        target_user_id := OLD.empleado_id;
    ELSE
        target_user_id := NEW.empleado_id;
    END IF;

    -- 1. Calculate Total Produced Hours (grouped by type)
    -- We parse the breakdowns and sum them up.
    -- Note: This requires Postgres 12+ for jsonb_path_query or heavy casting.
    -- Simplified approach: We assume specific keys or iterate.
    -- For robustness, we'll use a Common Table Expression to extract and sum.

    WITH exploded AS (
        -- Extract Key/Value pairs from horas_extra_hhmm -> breakdown
        -- Support multiple breakdown structures (flat vs nested)
        SELECT 
            key, 
            value::int as mins
        FROM jornadas, jsonb_each_text(
            COALESCE(
                horas_extra_hhmm->'breakdown'->'overtime',
                horas_extra_hhmm->'breakdown',
                horas_extra_hhmm
            ) 
        )
        WHERE empleado_id = target_user_id
        
        UNION ALL
        
        -- Also get surcharges if separate
        SELECT 
            key, 
            value::int as mins
        FROM jornadas, jsonb_each_text(
            COALESCE(
                horas_extra_hhmm->'breakdown'->'surcharges', 
                '{}'::jsonb
            )
        )
        WHERE empleado_id = target_user_id
        
        UNION ALL
        
        -- SUBTRACT Banked Hours (desglose_compensacion)
        SELECT 
            key, 
            (value::int * -1) as mins
        FROM jornadas, jsonb_each_text(COALESCE(desglose_compensacion, '{}'::jsonb))
        WHERE empleado_id = target_user_id
    ),
    sums AS (
        SELECT key, SUM(mins) as total
        FROM exploded
        GROUP BY key
    )
    SELECT jsonb_object_agg(key, total) INTO net_balance
    FROM sums
    WHERE total > 0; -- Only keep positive balances

    -- 2. Upsert into resumen_horas_extra
    INSERT INTO resumen_horas_extra (usuario_id, acumulado_hhmm, updated_at)
    VALUES (target_user_id, COALESCE(net_balance, '{}'::jsonb), NOW())
    ON CONFLICT (usuario_id) 
    DO UPDATE SET 
        acumulado_hhmm = EXCLUDED.acumulado_hhmm,
        updated_at = NOW();

    RETURN NULL; -- Helper trigger, return value ignored
END;
$$ LANGUAGE plpgsql;

-- Create the Trigger
DROP TRIGGER IF EXISTS trigger_sync_resumen ON jornadas;

CREATE TRIGGER trigger_sync_resumen
    AFTER INSERT OR UPDATE OR DELETE ON jornadas
    FOR EACH ROW
    EXECUTE FUNCTION sync_resumen_horas();

COMMENT ON FUNCTION sync_resumen_horas IS 'Automatically re-calculates volume of available overtime from jornadas history.';

-- Force backfill for existing data
-- We update 'id' to itself to simply fire the trigger for every row without changing data
UPDATE jornadas SET id = id;

