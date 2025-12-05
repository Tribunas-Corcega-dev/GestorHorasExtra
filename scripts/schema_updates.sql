-- Table: cierres_quincenales
-- Stores the bi-weekly closing data for each employee.

CREATE TABLE IF NOT EXISTS cierres_quincenales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  empleado_id UUID REFERENCES usuarios(id) NOT NULL,
  periodo_anio INT NOT NULL, -- e.g., 2025
  periodo_mes INT NOT NULL,  -- e.g., 12 (December)
  periodo_quincena INT NOT NULL CHECK (periodo_quincena IN (1, 2)), -- 1 (Days 1-15) or 2 (Days 16-End)
  
  -- Snapshot of Fixed Schedule Surcharges (Calculated automatically based on schedule + holidays)
  recargos_fijos JSONB DEFAULT '{}'::jsonb, 
  -- Example: { "recargo_nocturno": 2880, "dominical_festivo": 960 } (in minutes)

  -- Aggregated Reported Overtime (Sum of jornadas for that period)
  horas_extra_reportadas JSONB DEFAULT '{}'::jsonb,
  -- Example: { "extra_diurna": 120, "extra_nocturna": 60 }

  valor_total NUMERIC(12, 2) DEFAULT 0, -- Total monetary value to pay (Fixed + Variable)
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'aprobado', 'pagado')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per employee per period
  UNIQUE(empleado_id, periodo_anio, periodo_mes, periodo_quincena)
);

-- Table: festivos
-- Stores the official holidays for the country (Colombia).
-- Used to automatically calculate surcharges for fixed schedules on these days.

CREATE TABLE IF NOT EXISTS festivos (
  fecha DATE PRIMARY KEY,
  descripcion TEXT
);

-- Example Insert for Colombia 2025 (Partial)
INSERT INTO festivos (fecha, descripcion) VALUES
('2025-01-01', 'Año Nuevo'),
('2025-01-06', 'Día de los Reyes Magos'),
('2025-03-24', 'Día de San José'),
('2025-04-17', 'Jueves Santo'),
('2025-04-18', 'Viernes Santo'),
('2025-05-01', 'Día del Trabajo'),
('2025-05-29', 'Ascensión del Señor'),
('2025-06-19', 'Corpus Christi'),
('2025-06-26', 'Sagrado Corazón'),
('2025-06-30', 'San Pedro y San Pablo'),
('2025-07-20', 'Día de la Independencia'),
('2025-08-07', 'Batalla de Boyacá'),
('2025-08-18', 'La Asunción de la Virgen'),
('2025-10-13', 'Día de la Raza'),
('2025-11-03', 'Todos los Santos'),
('2025-11-17', 'Independencia de Cartagena'),
('2025-12-08', 'Inmaculada Concepción'),
('2025-12-25', 'Navidad')
ON CONFLICT (fecha) DO NOTHING;
