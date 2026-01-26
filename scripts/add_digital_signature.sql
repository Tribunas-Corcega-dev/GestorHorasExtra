
-- Add signature column to users
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS firma_digital TEXT; -- Stores Base64 data URL

-- Create table for period approvals
CREATE TABLE IF NOT EXISTS aprobaciones_periodo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id UUID REFERENCES usuarios(id),
    jefe_id UUID REFERENCES usuarios(id),
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    fecha_aprobacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    firma_snapshot TEXT, -- Copy of signature at time of approval
    estado TEXT DEFAULT 'APROBADO',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_aprobaciones_empleado ON aprobaciones_periodo(empleado_id);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_periodo ON aprobaciones_periodo(periodo_inicio, periodo_fin);
