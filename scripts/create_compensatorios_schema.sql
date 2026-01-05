-- Migration script for Compensatory Time System (Bolsa de Horas)

-- 1. Add 'bolsa_horas_minutos' to 'usuarios' table
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bolsa_horas_minutos INTEGER DEFAULT 0;

-- 2. Add 'limite_bolsa_horas' to 'parametros' table
ALTER TABLE parametros ADD COLUMN IF NOT EXISTS limite_bolsa_horas INTEGER DEFAULT NULL;

-- 3. Add columns to 'jornadas' table
ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS horas_para_bolsa_minutos INTEGER DEFAULT 0;
ALTER TABLE jornadas ADD COLUMN IF NOT EXISTS estado_compensacion TEXT DEFAULT 'NINGUNO' CHECK (estado_compensacion IN ('NINGUNO', 'SOLICITADO', 'APROBADO', 'RECHAZADO', 'PAGADO'));

-- 4. Create 'solicitudes_tiempo' table
CREATE TABLE IF NOT EXISTS solicitudes_tiempo (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_fin TIMESTAMP WITH TIME ZONE NOT NULL,
  minutos_solicitados INTEGER NOT NULL CHECK (minutos_solicitados > 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('LLEGADA_TARDIA', 'SALIDA_TEMPRANA', 'DIA_COMPLETO')),
  motivo TEXT,
  estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
  aprobado_por UUID REFERENCES usuarios(id),
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create 'historial_bolsa' table (Audit Trail)
CREATE TABLE IF NOT EXISTS historial_bolsa (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id) NOT NULL,
  tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('ACUMULACION', 'USO', 'AJUSTE')),
  minutos INTEGER NOT NULL, 
  referencia_id UUID, -- Can be ID from jornadas or solicitudes_tiempo
  saldo_resultante INTEGER NOT NULL,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  observacion TEXT,
  realizado_por UUID REFERENCES usuarios(id) -- Who authorized/triggered this
);
