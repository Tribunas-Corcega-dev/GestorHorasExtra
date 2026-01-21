
-- Table to store the accumulated overtime balance for each user
-- Uses a JSONB column to flexible store minutes per type.
CREATE TABLE IF NOT EXISTS resumen_horas_extra (
    usuario_id UUID REFERENCES usuarios(id) PRIMARY KEY,
    
    -- JSON structure: { "extra_diurna": 120, "recargo_nocturno": 60, ... }
    acumulado_hhmm JSONB DEFAULT '{}'::jsonb,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_resumen_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_resumen_timestamp
    BEFORE UPDATE ON resumen_horas_extra
    FOR EACH ROW
    EXECUTE FUNCTION update_resumen_updated_at();

COMMENT ON TABLE resumen_horas_extra IS 'Stores the running total of accumulated overtime minutes per type for each user in a JSONB object.';
