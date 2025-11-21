-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  nombre TEXT UNIQUE NOT NULL
);

-- Tabla local de usuarios (SIN email)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT,
  foto_url TEXT,
  cargo TEXT,
  area TEXT,
  tipo_trabajador TEXT,
  salario_base NUMERIC,
  jornada_fija_hhmm TEXT,
  rol TEXT REFERENCES roles(nombre)
);

-- Semilla inicial de roles
INSERT INTO roles (nombre)
VALUES ('COORDINADOR'),
       ('JEFE'),
       ('TALENTO_HUMANO'),
       ('ASISTENTE_GERENCIA'),
       ('OPERARIO')
ON CONFLICT DO NOTHING;
